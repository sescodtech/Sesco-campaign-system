"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
const rule=z.object({field:z.string(),operator:z.string(),value:z.string().optional()});
const rules=z.object({operator:z.enum(["and","or"]),children:z.array(rule)});
export async function createSegment(formData:FormData){const context=await getCurrentContext();if(!context?.membership||!context.user)throw new Error("Authentication required");const name=z.string().min(2).max(100).parse(formData.get("name"));const parsedRules=rules.parse(JSON.parse(String(formData.get("rules")||"{}")));const cachedCount=Number(formData.get("cached_count")||0);const supabase=await createClient();const orgId=context.membership.organization_id as string;const {data,error}=await supabase.from("segments").insert({organization_id:orgId,name,rules:parsedRules,cached_count:cachedCount,last_evaluated_at:new Date().toISOString(),created_by:context.user.id}).select("id").single();if(error)throw new Error(error.message);await supabase.from("audit_logs").insert({organization_id:orgId,user_id:context.user.id,action:"segment.create",entity_type:"segment",entity_id:data.id,after_data:{name,rules:parsedRules}});revalidatePath("/contacts/segments");}
