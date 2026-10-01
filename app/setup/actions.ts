"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const schema=z.object({name:z.string().min(2).max(120),slug:z.string().min(2).max(80).regex(/^[a-z0-9-]+$/)});
export async function bootstrap(formData:FormData){const parsed=schema.safeParse({name:String(formData.get("name")||""),slug:String(formData.get("slug")||"")}); if(!parsed.success) redirect("/setup?error=Invalid+organization+details"); const supabase=await createClient(); const {error}=await supabase.rpc("bootstrap_organization",{p_name:parsed.data.name,p_slug:parsed.data.slug}); if(error) redirect(`/setup?error=${encodeURIComponent(error.message)}`); redirect("/dashboard")}
