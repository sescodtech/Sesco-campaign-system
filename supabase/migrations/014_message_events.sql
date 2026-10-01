begin;
-- Phase 10: provider webhook/event tracking.
create table if not exists public.message_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  recipient_id uuid references public.campaign_recipients(id) on delete cascade,
  provider text not null,
  provider_message_id text,
  event_type text not null check(event_type in ('sent','delivered','opened','clicked','bounced','complained','failed','unsubscribed')),
  event_timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists message_events_campaign_idx on public.message_events(organization_id,campaign_id,event_timestamp desc);
create index if not exists message_events_provider_message_idx on public.message_events(provider,provider_message_id);
alter table public.message_events enable row level security;
create policy "message event viewers" on public.message_events for select using(public.has_permission(organization_id,'campaigns.view') or public.has_permission(organization_id,'analytics.view'));

create or replace function public.refresh_campaign_metrics(p_campaign_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.campaigns where id=p_campaign_id;
  if v_org is null then return; end if;
  insert into public.campaign_metrics(organization_id,campaign_id,recipients,queued,sent,delivered,opened,clicked,bounced,failed,unsubscribed,updated_at)
  select v_org,p_campaign_id,count(*)::int,
    count(*) filter(where status='queued')::int,
    count(*) filter(where status in ('sent','delivered','opened','clicked'))::int,
    count(*) filter(where status in ('delivered','opened','clicked'))::int,
    count(*) filter(where status in ('opened','clicked'))::int,
    count(*) filter(where status='clicked')::int,
    count(*) filter(where status='bounced')::int,
    count(*) filter(where status='failed')::int,
    count(*) filter(where status='unsubscribed')::int,now()
  from public.campaign_recipients where campaign_id=p_campaign_id
  on conflict(campaign_id) do update set
    recipients=excluded.recipients,queued=excluded.queued,sent=excluded.sent,delivered=excluded.delivered,opened=excluded.opened,clicked=excluded.clicked,bounced=excluded.bounced,failed=excluded.failed,unsubscribed=excluded.unsubscribed,updated_at=now();
end; $$;
revoke all on function public.refresh_campaign_metrics(uuid) from public, anon, authenticated;
grant execute on function public.refresh_campaign_metrics(uuid) to service_role;
commit;
