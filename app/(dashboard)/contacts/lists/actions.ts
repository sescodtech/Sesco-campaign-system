"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

async function orgContext() {
  const context = await getCurrentContext();
  if (!context?.membership || !context.user) throw new Error("Authentication required");
  return { context, orgId: context.membership.organization_id as string, supabase: await createClient() };
}

export async function createList(formData: FormData) {
  const name = z.string().min(2).max(100).parse(formData.get("name"));
  const description = z.string().max(240).optional().parse(String(formData.get("description") || "")) || null;
  const { context, orgId, supabase } = await orgContext();
  const { data, error } = await supabase.from("contact_lists").insert({ organization_id: orgId, name, description, created_by: context.user.id }).select("id").single();
  if (error) throw new Error(error.message);
  await supabase.from("audit_logs").insert({ organization_id: orgId, user_id: context.user.id, action: "list.create", entity_type: "contact_list", entity_id: data.id, after_data: { name } });
  revalidatePath("/contacts/lists");
}

export async function createTag(formData: FormData) {
  const name = z.string().min(1).max(60).parse(formData.get("name"));
  const color = z.enum(["slate","blue","emerald","amber","rose","violet"]).catch("slate").parse(formData.get("color"));
  const { context, orgId, supabase } = await orgContext();
  const { data, error } = await supabase.from("tags").insert({ organization_id: orgId, name, color }).select("id").single();
  if (error) throw new Error(error.message);
  await supabase.from("audit_logs").insert({ organization_id: orgId, user_id: context.user.id, action: "tag.create", entity_type: "tag", entity_id: data.id, after_data: { name, color } });
  revalidatePath("/contacts/lists");
}
