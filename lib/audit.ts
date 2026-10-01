import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function recordAudit(input:{organizationId:string;userId:string;action:string;entityType?:string;entityId?:string;category?:string;severity?:"info"|"notice"|"warning"|"critical";beforeData?:unknown;afterData?:unknown;metadata?:Record<string,unknown>}){
  const h=await headers();
  const forwarded=h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  await supabase.from("audit_logs").insert({
    organization_id:input.organizationId,user_id:input.userId,action:input.action,entity_type:input.entityType||null,entity_id:input.entityId||null,
    category:input.category||"activity",severity:input.severity||"info",source:"app",actor_email:user?.email||null,ip_address:forwarded||null,user_agent:h.get("user-agent"),
    request_id:crypto.randomUUID(),before_data:input.beforeData||null,after_data:input.afterData||null,metadata:input.metadata||{},
  });
}
