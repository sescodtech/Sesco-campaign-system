import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail, normalizePhone } from "@/lib/contacts/fields";

const bodySchema = z.object({
  filename: z.string().min(1).max(255),
  fileSize: z.number().nonnegative().max(15 * 1024 * 1024),
  worksheetName: z.string().max(120).nullable().optional(),
  headerRow: z.number().int().positive(),
  startRow: z.number().int().positive(),
  endRow: z.number().int().positive().nullable().optional(),
  mapping: z.record(z.string(), z.string()),
  duplicateStrategy: z.enum(["skip", "update", "create_new_only"]),
  rows: z.array(z.record(z.string(), z.unknown())).max(5000),
});

const allowedFields = new Set([
  "external_customer_id","account_number","first_name","last_name","full_name","email","phone","whatsapp_phone","gender","country","state","city","branch","account_type","customer_type","customer_status","relationship_manager","date_joined","last_transaction_date","balance_band"
]);

function cleanValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function isValidEmail(value: string | null) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string | null) {
  if (!value) return true;
  return /^\+?[0-9]{7,15}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context?.user || !context.membership) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const orgId = context.membership.organization_id as string;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid import payload", details: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const supabase = await createClient();

    const { data: importJob, error: importError } = await supabase.from("imports").insert({
      organization_id: orgId,
      created_by: context.user.id,
      filename: input.filename,
      file_size: input.fileSize,
      worksheet_name: input.worksheetName || null,
      header_row: input.headerRow,
      start_row: input.startRow,
      end_row: input.endRow || null,
      duplicate_strategy: input.duplicateStrategy,
      mapping: input.mapping,
      status: "processing",
      started_at: new Date().toISOString(),
      total_rows: input.rows.length,
    }).select("id").single();
    if (importError || !importJob) return NextResponse.json({ error: importError?.message || "Unable to create import" }, { status: 400 });

    const { data: existingRows } = await supabase.from("contacts").select("id,normalized_email,normalized_phone,external_customer_id,account_number").eq("organization_id", orgId);
    const existingByEmail = new Map<string,string>();
    const existingByPhone = new Map<string,string>();
    const existingByCustomer = new Map<string,string>();
    const existingByAccount = new Map<string,string>();
    for (const row of existingRows || []) {
      if (row.normalized_email) existingByEmail.set(row.normalized_email, row.id);
      if (row.normalized_phone) existingByPhone.set(row.normalized_phone, row.id);
      if (row.external_customer_id) existingByCustomer.set(String(row.external_customer_id).trim(), row.id);
      if (row.account_number) existingByAccount.set(String(row.account_number).trim(), row.id);
    }

    const staged: Array<Record<string, unknown>> = [];
    const toInsert: Array<Record<string, unknown>> = [];
    const toUpdate = new Map<string, Record<string, unknown>>();
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    let validRows = 0, invalidRows = 0, duplicateRows = 0, newRows = 0, updatedRows = 0;

    input.rows.forEach((raw, idx) => {
      const contact: Record<string, unknown> = { organization_id: orgId, source: "spreadsheet", source_import_id: importJob.id };
      for (const [column, field] of Object.entries(input.mapping as Record<string,string>)) {
        if (!field || !allowedFields.has(field)) continue;
        contact[field] = cleanValue(raw[column]);
      }
      if (!contact.full_name) contact.full_name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || null;
      const email = normalizeEmail(contact.email as string | null);
      const phone = normalizePhone(contact.phone as string | null);
      contact.normalized_email = email;
      contact.normalized_phone = phone;
      const errors: string[] = [];
      if (!contact.full_name && !email && !phone && !contact.external_customer_id && !contact.account_number) errors.push("No usable contact identifier");
      if (!isValidEmail(email)) errors.push("Invalid email address");
      if (!isValidPhone(phone)) errors.push("Invalid phone number");

      let matchedId: string | undefined;
      if (email) matchedId = existingByEmail.get(email);
      if (!matchedId && phone) matchedId = existingByPhone.get(phone);
      if (!matchedId && contact.external_customer_id) matchedId = existingByCustomer.get(String(contact.external_customer_id));
      if (!matchedId && contact.account_number) matchedId = existingByAccount.get(String(contact.account_number));
      const duplicateInFile = (!!email && seenEmails.has(email)) || (!!phone && seenPhones.has(phone));
      if (email) seenEmails.add(email);
      if (phone) seenPhones.add(phone);

      let status = "valid";
      if (errors.length) { status = "invalid"; invalidRows++; }
      else if (duplicateInFile) { status = "duplicate"; duplicateRows++; }
      else if (matchedId) {
        duplicateRows++;
        if (input.duplicateStrategy === "update") { toUpdate.set(matchedId, contact); updatedRows++; status = "updated"; }
        else status = "skipped";
      } else {
        toInsert.push(contact); newRows++; validRows++; status = "imported";
      }
      staged.push({ organization_id: orgId, import_id: importJob.id, row_number: input.startRow + idx, raw_data: raw, normalized_data: contact, status, errors, matched_contact_id: matchedId || null });
    });

    for (let i = 0; i < staged.length; i += 500) {
      const { error } = await supabase.from("import_rows").insert(staged.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    for (let i = 0; i < toInsert.length; i += 500) {
      const { error } = await supabase.from("contacts").insert(toInsert.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    for (const [id, values] of toUpdate.entries()) {
      const updateValues = Object.fromEntries(Object.entries(values).filter(([k]) => !["organization_id","source_import_id"].includes(k)));
      const { error } = await supabase.from("contacts").update(updateValues).eq("id", id).eq("organization_id", orgId);
      if (error) throw new Error(error.message);
    }

    const completedAt = new Date().toISOString();
    await supabase.from("imports").update({
      status: "completed", valid_rows: validRows, invalid_rows: invalidRows, duplicate_rows: duplicateRows,
      new_rows: newRows, updated_rows: updatedRows, failed_rows: 0, completed_at: completedAt,
    }).eq("id", importJob.id);
    await supabase.from("audit_logs").insert({ organization_id: orgId, user_id: context.user.id, action: "contact.import", entity_type: "import", entity_id: importJob.id, after_data: { filename: input.filename, totalRows: input.rows.length, newRows, updatedRows, invalidRows, duplicateRows } });

    return NextResponse.json({ importId: importJob.id, totalRows: input.rows.length, validRows, invalidRows, duplicateRows, newRows, updatedRows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 500 });
  }
}
