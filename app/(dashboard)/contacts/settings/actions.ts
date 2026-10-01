"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export async function createCustomField(formData: FormData) {
  const context = await getCurrentContext(); if (!context?.membership || !context.user) throw new Error("Authentication required");
  const orgId = context.membership.organization_id as string; const supabase = await createClient();
  const name = z.string().min(2).max(80).parse(formData.get("name"));
  const key = name.toLowerCase().trim().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
  const type = z.enum(["text","number","date","boolean","select","multi-select"]).parse(formData.get("type"));
  const options = String(formData.get("options")||"").split(",").map(v=>v.trim()).filter(Boolean);
  const { error } = await supabase.from("custom_field_definitions").insert({ organization_id: orgId, name, key, type, required: formData.get("required")==="on", options });
  if (error) throw new Error(error.message); revalidatePath("/contacts/settings");
}
