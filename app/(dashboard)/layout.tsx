import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { getCurrentContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ipAllowed } from "@/lib/security/ip";

export default async function DashboardLayout({children}:{children:React.ReactNode}){
 const context=await getCurrentContext();if(!context?.user)redirect("/login");if(!context.membership)redirect("/setup");const orgId=context.membership.organization_id as string;const supabase=await createClient();
 const{data:security}=await supabase.from("security_settings").select("require_mfa,session_timeout_minutes,allowed_ip_cidrs").eq("organization_id",orgId).maybeSingle();
 if(security){
  const signIn=context.user.last_sign_in_at?new Date(context.user.last_sign_in_at).getTime():Date.now();if(Date.now()-signIn>Number(security.session_timeout_minutes||480)*60000){await supabase.auth.signOut();redirect("/login?reason=session_expired");}
  const h=await headers();const ip=h.get("x-forwarded-for")?.split(",")[0]?.trim()||h.get("x-real-ip");if(!ipAllowed(ip,security.allowed_ip_cidrs||[])){const admin=createAdminClient();await admin.from("security_events").insert({organization_id:orgId,user_id:context.user.id,event_type:"access.ip_blocked",severity:"warning",ip_address:ip||null,user_agent:h.get("user-agent"),resource:"dashboard"});redirect("/security/blocked");}
  if(security.require_mfa){const{data:aal}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(aal?.currentLevel!=="aal2")redirect("/security/mfa");}
 }
 const org=context.membership.organizations as unknown as {name:string}|null;return <div className="min-h-screen lg:flex"><Sidebar organizationName={org?.name??"Organization"}/><MobileSidebar organizationName={org?.name??"Organization"}/><div className="min-w-0 flex-1"><Topbar title="Overview" email={context.user.email??""}/><main className="p-4 sm:p-6 lg:p-8">{children}</main></div></div>;
}
