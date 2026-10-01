import { createClient } from "@/lib/supabase/server";
import { evaluateGroup, type SegmentGroup } from "@/lib/segments/evaluator";

export async function resolveCampaignAudience(organizationId: string, audienceType: string | null, listId?: string | null, segmentId?: string | null) {
  const supabase = await createClient();
  if (audienceType === "list" && listId) {
    const { data, error } = await supabase.from("contact_list_members").select("contact_id, contacts(*)").eq("organization_id", organizationId).eq("list_id", listId);
    if (error) throw error;
    return (data || []).map((row: any) => row.contacts).filter(Boolean);
  }
  if (audienceType === "segment" && segmentId) {
    const { data: segment, error } = await supabase.from("segments").select("rules").eq("organization_id", organizationId).eq("id", segmentId).single();
    if (error) throw error;
    const { data, error: contactError } = await supabase.from("contacts").select("*").eq("organization_id", organizationId).eq("is_active", true).limit(5000);
    if (contactError) throw contactError;
    const rules = segment.rules as SegmentGroup;
    return (data || []).filter((contact) => evaluateGroup(contact as Record<string,unknown>, rules));
  }
  return [];
}
