import { createClient } from "@/lib/supabase/server";

export async function getCurrentContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("id, organization_id, status, organizations(id,name,slug,logo_url), roles(id,name,key)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return { user, membership };
}
