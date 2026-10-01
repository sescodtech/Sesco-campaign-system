import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/secrets";
import { makeEmailProvider } from "@/lib/providers/email";
import { makeSmsProvider } from "@/lib/providers/sms";
import { makeWhatsAppProvider } from "@/lib/providers/whatsapp";
import { personalize } from "@/lib/templates/personalize";
import { renderCampaignHtml } from "@/lib/campaigns/render";

function masked(value?:string|null){if(!value)return"";const end=value.slice(-4);return `${"*".repeat(Math.max(4,value.length-4))}${end}`;}
function consentOk(contact:any,channel:string){return channel==="email"?contact.email_consent===true:channel==="sms"?contact.sms_consent===true:contact.whatsapp_consent===true;}
function deepPersonalize(value:unknown,vars:Record<string,string>):unknown{if(typeof value==="string")return personalize(value,vars);if(Array.isArray(value))return value.map(v=>deepPersonalize(v,vars));if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([k,v])=>[k,deepPersonalize(v,vars)]));return value;}

export async function processCampaignJob(jobId:string){
  const admin=createAdminClient();
  const {data:job,error:jobError}=await admin.from("campaign_jobs").select("*").eq("id",jobId).single(); if(jobError||!job)throw jobError||new Error("Campaign job not found.");
  const {data:campaign,error:campaignError}=await admin.from("campaigns").select("*").eq("id",job.campaign_id).single();if(campaignError||!campaign)throw campaignError||new Error("Campaign not found.");
  if(["paused","cancelled","completed"].includes(campaign.status))return{processed:0,failed:0};
  const channel=campaign.channel||"email";
  const {data:integration,error:integrationError}=await admin.from("integrations").select("*").eq("organization_id",job.organization_id).eq("channel",channel).eq("provider",job.provider).eq("status","connected").single();
  if(integrationError||!integration?.credentials_encrypted)throw integrationError||new Error(`${channel} integration is not connected.`);
  const secret=JSON.parse(decryptSecret(integration.credentials_encrypted)) as any;

  const now=new Date();const dayStart=new Date(now);dayStart.setUTCHours(0,0,0,0);const monthStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));
  const[dayUsage,monthUsage]=await Promise.all([
    admin.from("message_events").select("id",{count:"exact",head:true}).eq("organization_id",job.organization_id).eq("provider",job.provider).eq("channel",channel).eq("event_type","sent").gte("event_timestamp",dayStart.toISOString()),
    admin.from("message_events").select("id",{count:"exact",head:true}).eq("organization_id",job.organization_id).eq("provider",job.provider).eq("channel",channel).eq("event_type","sent").gte("event_timestamp",monthStart.toISOString()),
  ]);
  const dailyRemaining=integration.daily_limit?Math.max(0,integration.daily_limit-(dayUsage.count||0)):job.batch_size;
  const monthlyRemaining=integration.monthly_limit?Math.max(0,integration.monthly_limit-(monthUsage.count||0)):job.batch_size;
  const allowed=Math.max(0,Math.min(job.batch_size,dailyRemaining,monthlyRemaining));
  if(!allowed){const tomorrow=new Date(now);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);tomorrow.setUTCHours(0,5,0,0);await admin.from("campaign_jobs").update({status:"pending",scheduled_for:tomorrow.toISOString(),lock_token:null,locked_at:null,last_error:"Provider quota reached; automatically deferred."}).eq("id",job.id);return{processed:0,failed:0,done:false};}

  const {data:recipients,error:recipientError}=await admin.from("campaign_recipients").select("*, contacts(first_name,last_name,full_name,email,phone,whatsapp_phone,branch,account_type,account_number,email_consent,sms_consent,whatsapp_consent)").eq("campaign_id",job.campaign_id).in("status",["pending","queued","failed"]).lte("available_at",new Date().toISOString()).lt("attempts",4).limit(allowed);if(recipientError)throw recipientError;
  const {data:channelTemplate}=campaign.channel_template_id?await admin.from("channel_templates").select("*").eq("id",campaign.channel_template_id).maybeSingle():{data:null as any};
  let processed=0,failed=0;
  for(const recipient of recipients||[]){
    const contact=(recipient as any).contacts||{};const destination=recipient.destination||(channel==="email"?recipient.email:channel==="sms"?recipient.phone:recipient.whatsapp_phone||recipient.phone);
    if(!destination){await admin.from("campaign_recipients").update({status:"skipped",last_error:`No ${channel} destination`}).eq("id",recipient.id);continue;}
    if(!consentOk(contact,channel)){await admin.from("campaign_recipients").update({status:"skipped",last_error:`${channel} consent withdrawn`}).eq("id",recipient.id);continue;}
    const {data:suppression}=await admin.from("suppression_entries").select("id").eq("organization_id",job.organization_id).eq("channel",channel).ilike("destination",String(destination)).limit(1).maybeSingle();
    if(suppression){await admin.from("campaign_recipients").update({status:"skipped",last_error:"Destination is suppressed"}).eq("id",recipient.id);continue;}
    const values:Record<string,string>={first_name:contact.first_name||"",last_name:contact.last_name||"",full_name:contact.full_name||[contact.first_name,contact.last_name].filter(Boolean).join(" "),email:recipient.email||contact.email||"",phone:contact.phone||"",branch:contact.branch||"",account_type:contact.account_type||"",masked_account_number:masked(contact.account_number),unsubscribe_url:`${process.env.APP_URL||""}/unsubscribe?token=${recipient.unsubscribe_token||""}`,...(recipient.personalization||{})};
    await admin.from("campaign_recipients").update({status:"processing",attempts:recipient.attempts+1}).eq("id",recipient.id);
    try{
      let sent:{providerMessageId:string};
      if(channel==="email"){
        const provider=makeEmailProvider(job.provider,secret);
        sent=await provider.sendEmail({to:String(destination),subject:personalize(campaign.subject||campaign.name,values),html:renderCampaignHtml((campaign.content||[])as any[],values),fromName:campaign.sender_name||integration.sender_name||"Campaign",fromEmail:campaign.sender_email||integration.sender_email,replyTo:campaign.reply_to||integration.reply_to});
      }else if(channel==="sms"){
        const provider=makeSmsProvider(job.provider,secret);
        sent=await provider.sendSms({to:String(destination),body:personalize(campaign.text_content||channelTemplate?.body||"",values),senderId:integration.sender_name||secret.senderId||"Campaign"});
      }else{
        const provider=makeWhatsAppProvider(job.provider,secret);
        if(!channelTemplate?.provider_template_name)throw new Error("WhatsApp campaigns require an approved provider template name.");
        sent=await provider.sendTemplate({to:String(destination),templateName:channelTemplate.provider_template_name,language:channelTemplate.provider_template_language||"en",components:deepPersonalize(channelTemplate.provider_components||[],values) as unknown[]});
      }
      await admin.from("campaign_recipients").update({status:"sent",provider_message_id:sent.providerMessageId,sent_at:new Date().toISOString(),last_error:null}).eq("id",recipient.id);
      await admin.from("message_events").insert({organization_id:job.organization_id,campaign_id:job.campaign_id,recipient_id:recipient.id,channel,provider:job.provider,provider_message_id:sent.providerMessageId,event_type:"sent"});
      if(recipient.contact_id)await admin.from("communication_history").insert({organization_id:job.organization_id,contact_id:recipient.contact_id,campaign_id:job.campaign_id,recipient_id:recipient.id,channel,direction:"outbound",status:"sent",subject:channel==="email"?(campaign.subject||campaign.name):campaign.name,destination:String(destination),provider:job.provider,provider_message_id:sent.providerMessageId});
      processed++;
    }catch(error){const message=error instanceof Error?error.message.slice(0,1000):"Provider send failed";await admin.from("campaign_recipients").update({status:"failed",last_error:message}).eq("id",recipient.id);await admin.from("message_events").insert({organization_id:job.organization_id,campaign_id:job.campaign_id,recipient_id:recipient.id,channel,provider:job.provider,event_type:"failed",metadata:{error:message}});failed++;}
  }
  const remaining=await admin.from("campaign_recipients").select("id",{count:"exact",head:true}).eq("campaign_id",job.campaign_id).in("status",["pending","queued","failed"]).lte("available_at",new Date().toISOString());const done=(remaining.count||0)===0;
  await admin.from("campaign_jobs").update({status:done?"completed":"pending",processed_count:job.processed_count+processed,failed_count:job.failed_count+failed,scheduled_for:done?job.scheduled_for:new Date().toISOString(),last_error:null,lock_token:null,locked_at:null}).eq("id",job.id);
  await admin.from("campaigns").update({status:done?"completed":"sending",completed_at:done?new Date().toISOString():null,started_at:campaign.started_at||new Date().toISOString()}).eq("id",campaign.id);
  await admin.rpc("refresh_campaign_metrics",{p_campaign_id:campaign.id});return{processed,failed,done};
}
