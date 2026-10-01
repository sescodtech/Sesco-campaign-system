import { createClient } from "@/lib/supabase/server";
import { resolveCampaignAudience } from "@/lib/campaigns/audience";

function destinationFor(contact:any, channel:string){
  if(channel==="email") return contact.email ? String(contact.email).trim().toLowerCase() : null;
  const raw=channel==="sms"?contact.phone:(contact.whatsapp_phone||contact.phone);
  if(!raw)return null;
  return String(raw).replace(/\D/g,"");
}
function hasConsent(contact:any, channel:string){
  if(channel==="email") return contact.email_consent === true;
  if(channel==="sms") return contact.sms_consent === true;
  if(channel==="whatsapp") return contact.whatsapp_consent === true;
  return false;
}

export async function materializeCampaign(campaignId:string, organizationId:string, provider:string, scheduledFor:string, dailyLimit:number, batchSize=50){
  const supabase=await createClient();
  const {data:campaign,error}=await supabase.from("campaigns").select("*").eq("organization_id",organizationId).eq("id",campaignId).single();
  if(error||!campaign) throw error||new Error("Campaign not found.");
  const channel=campaign.channel || "email";
  const contacts=await resolveCampaignAudience(organizationId,campaign.audience_type,campaign.list_id,campaign.segment_id);
  const candidates=contacts.filter((c:any)=>c.is_active && destinationFor(c,channel) && hasConsent(c,channel));
  const destinations=candidates.map((c:any)=>String(destinationFor(c,channel)).trim().toLowerCase());
  const {data:suppressedRows}=destinations.length?await supabase.from("suppression_entries").select("destination").eq("organization_id",organizationId).eq("channel",channel).in("destination",destinations):{data:[] as {destination:string}[]};
  const suppressed=new Set((suppressedRows||[]).map((x:any)=>String(x.destination).trim().toLowerCase()));
  const eligible=candidates.filter((c:any)=>!suppressed.has(String(destinationFor(c,channel)).trim().toLowerCase()));
  const start=new Date(scheduledFor); const perDay=Math.max(1,dailyLimit||eligible.length||1);
  const recipientRows=eligible.map((c:any,index:number)=>{
    const available=new Date(start); available.setDate(available.getDate()+Math.floor(index/perDay));
    return {organization_id:organizationId,campaign_id:campaignId,contact_id:c.id,email:c.email,phone:c.phone,whatsapp_phone:c.whatsapp_phone,channel,destination:destinationFor(c,channel),status:"queued",queued_at:new Date().toISOString(),available_at:available.toISOString()};
  });
  if(recipientRows.length){const{error:recipientError}=await supabase.from("campaign_recipients").upsert(recipientRows,{onConflict:"campaign_id,contact_id",ignoreDuplicates:true});if(recipientError)throw recipientError;}
  const days=Math.max(1,Math.ceil(eligible.length/perDay));
  for(let day=0;day<days;day++){const when=new Date(start);when.setDate(when.getDate()+day);const{error:jobError}=await supabase.from("campaign_jobs").upsert({organization_id:organizationId,campaign_id:campaignId,provider,status:"pending",scheduled_for:when.toISOString(),batch_size:Math.min(batchSize,perDay)},{onConflict:"campaign_id,scheduled_for"});if(jobError)throw jobError;}
  await supabase.from("campaigns").update({status:start.getTime()>Date.now()?"scheduled":"queued",scheduled_at:start.toISOString(),audience_snapshot_count:eligible.length}).eq("id",campaignId);
  return {recipients:eligible.length,days,channel};
}
