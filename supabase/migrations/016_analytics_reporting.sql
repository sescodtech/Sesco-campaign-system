begin;
-- Phase 12: reporting indexes and organization campaign analytics view.
create index if not exists campaign_metrics_org_updated_idx on public.campaign_metrics(organization_id,updated_at desc);
create index if not exists campaign_recipients_org_status_idx on public.campaign_recipients(organization_id,status,created_at desc);
create index if not exists message_events_org_type_idx on public.message_events(organization_id,event_type,event_timestamp desc);

create or replace view public.campaign_analytics with (security_invoker=true) as
select c.id as campaign_id,c.organization_id,c.name,c.channel,c.status,c.created_at,c.scheduled_at,c.completed_at,
       coalesce(m.recipients,0) recipients,coalesce(m.sent,0) sent,coalesce(m.delivered,0) delivered,
       coalesce(m.opened,0) opened,coalesce(m.clicked,0) clicked,coalesce(m.bounced,0) bounced,
       coalesce(m.failed,0) failed,coalesce(m.unsubscribed,0) unsubscribed,
       case when coalesce(m.sent,0)>0 then round((m.delivered::numeric/m.sent)*100,2) else 0 end delivery_rate,
       case when coalesce(m.delivered,0)>0 then round((m.opened::numeric/m.delivered)*100,2) else 0 end open_rate,
       case when coalesce(m.delivered,0)>0 then round((m.clicked::numeric/m.delivered)*100,2) else 0 end click_rate,
       case when coalesce(m.opened,0)>0 then round((m.clicked::numeric/m.opened)*100,2) else 0 end click_to_open_rate,
       case when coalesce(m.sent,0)>0 then round((m.bounced::numeric/m.sent)*100,2) else 0 end bounce_rate,
       case when coalesce(m.delivered,0)>0 then round((m.unsubscribed::numeric/m.delivered)*100,2) else 0 end unsubscribe_rate
from public.campaigns c left join public.campaign_metrics m on m.campaign_id=c.id;
commit;
