begin;
-- Phase 18: WhatsApp Cloud API, inbound message storage and richer delivery events.
insert into public.permissions(key,description) values
('whatsapp.view','View WhatsApp configuration and activity'),
('whatsapp.manage','Manage WhatsApp provider and templates'),
('whatsapp.send','Send WhatsApp campaigns')
on conflict(key) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.key in ('whatsapp.view','whatsapp.manage','whatsapp.send')
where r.key in ('super_admin','administrator','campaign_manager')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.key='whatsapp.view'
where r.key in ('marketing_officer','viewer','auditor')
on conflict do nothing;

alter table public.integrations
  add column if not exists external_account_id text,
  add column if not exists webhook_path_key uuid not null default gen_random_uuid();
create unique index if not exists integrations_webhook_path_key_idx on public.integrations(webhook_path_key);

alter table public.integrations drop constraint if exists integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check check(provider in ('brevo','resend','mailjet','custom_smtp','termii','custom_sms','meta_whatsapp'));

alter table public.message_events drop constraint if exists message_events_event_type_check;
alter table public.message_events add constraint message_events_event_type_check check(event_type in ('queued','sent','accepted','delivered','opened','read','clicked','bounced','complained','undelivered','failed','unsubscribed','received'));

create table if not exists public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  channel text not null check(channel in ('sms','whatsapp')),
  provider text not null,
  provider_message_id text,
  sender text not null,
  recipient text,
  message_type text,
  body text,
  media jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique(provider,provider_message_id)
);
create index if not exists inbound_messages_org_idx on public.inbound_messages(organization_id,channel,received_at desc);
alter table public.inbound_messages enable row level security;
create policy "inbound message viewers" on public.inbound_messages for select using(public.has_permission(organization_id,'contacts.view') or public.has_permission(organization_id,'campaigns.view'));

commit;

begin;
alter table public.campaign_recipients drop constraint if exists campaign_recipients_status_check;
alter table public.campaign_recipients add constraint campaign_recipients_status_check check(status in ('pending','queued','processing','sent','accepted','delivered','opened','read','clicked','bounced','undelivered','failed','unsubscribed','skipped'));
create or replace function public.refresh_campaign_metrics(p_campaign_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.campaigns where id=p_campaign_id;
  if v_org is null then return; end if;
  insert into public.campaign_metrics(organization_id,campaign_id,recipients,queued,sent,delivered,opened,clicked,bounced,failed,unsubscribed,updated_at)
  select v_org,p_campaign_id,count(*)::int,
    count(*) filter(where status='queued')::int,
    count(*) filter(where status in ('sent','accepted','delivered','opened','read','clicked'))::int,
    count(*) filter(where status in ('delivered','opened','read','clicked'))::int,
    count(*) filter(where status in ('opened','read','clicked'))::int,
    count(*) filter(where status='clicked')::int,
    count(*) filter(where status='bounced')::int,
    count(*) filter(where status in ('failed','undelivered'))::int,
    count(*) filter(where status='unsubscribed')::int,now()
  from public.campaign_recipients where campaign_id=p_campaign_id
  on conflict(campaign_id) do update set recipients=excluded.recipients,queued=excluded.queued,sent=excluded.sent,delivered=excluded.delivered,opened=excluded.opened,clicked=excluded.clicked,bounced=excluded.bounced,failed=excluded.failed,unsubscribed=excluded.unsubscribed,updated_at=now();
end; $$;
revoke all on function public.refresh_campaign_metrics(uuid) from public,anon,authenticated;
grant execute on function public.refresh_campaign_metrics(uuid) to service_role;
commit;
