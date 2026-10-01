import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/auth/context";

function csv(v:unknown){const s=String(v??"");return `"${s.replaceAll('"','""')}"`;}
export async function GET(req:NextRequest){
 const ctx=await getCurrentContext();if(!ctx?.membership)return NextResponse.json({error:"Unauthorized"},{status:401});const orgId=ctx.membership.organization_id as string;const supabase=await createClient();
 const{data:allowed}=await supabase.rpc("has_permission",{p_org:orgId,p_permission:"audit.export"});if(!allowed)return NextResponse.json({error:"Audit export permission required"},{status:403});
 const{data:settings}=await supabase.from("security_settings").select("allow_data_exports").eq("organization_id",orgId).maybeSingle();if(settings&&settings.allow_data_exports===false)return NextResponse.json({error:"Data exports are disabled by organization security policy"},{status:403});
 const sp=req.nextUrl.searchParams;let q=supabase.from("audit_logs").select("id,created_at,severity,category,action,actor_email,entity_type,entity_id,ip_address,source").eq("organization_id",orgId).order("created_at",{ascending:false}).limit(5000);if(sp.get("action"))q=q.ilike("action",`%${sp.get("action")}%`);if(sp.get("actor"))q=q.ilike("actor_email",`%${sp.get("actor")}%`);if(sp.get("category"))q=q.eq("category",sp.get("category")!);if(sp.get("severity"))q=q.eq("severity",sp.get("severity")!);if(sp.get("from"))q=q.gte("created_at",new Date(`${sp.get("from")}T00:00:00`).toISOString());if(sp.get("to"))q=q.lte("created_at",new Date(`${sp.get("to")}T23:59:59`).toISOString());const{data,error}=await q;if(error)return NextResponse.json({error:error.message},{status:500});
 const rows=["id,created_at,severity,category,action,actor_email,entity_type,entity_id,ip_address,source",...(data||[]).map((r:any)=>[r.id,r.created_at,r.severity,r.category,r.action,r.actor_email,r.entity_type,r.entity_id,r.ip_address,r.source].map(csv).join(","))];
 return new NextResponse(rows.join("\n"),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="audit-${new Date().toISOString().slice(0,10)}.csv"`,"cache-control":"no-store"}});
}
