begin;
-- Phase 14: maker/checker approval workflow.
alter table public.campaigns
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

create or replace function public.enforce_campaign_approval_transition() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null then
    if new.status='approved' and old.status is distinct from 'approved' and not public.has_permission(new.organization_id,'campaigns.approve') then raise exception 'campaign approval permission required'; end if;
    if new.status='pending_approval' and old.status is distinct from 'pending_approval' and not public.has_permission(new.organization_id,'campaigns.submit') then raise exception 'campaign submit permission required'; end if;
    if new.status in ('scheduled','queued') and old.status is distinct from new.status and not public.has_permission(new.organization_id,'campaigns.send') then raise exception 'campaign send permission required'; end if;
  end if;
  return new;
end $$;
drop trigger if exists campaigns_approval_guard on public.campaigns;
create trigger campaigns_approval_guard before update on public.campaigns for each row execute function public.enforce_campaign_approval_transition();

create table if not exists public.campaign_approval_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  action text not null check(action in ('submitted','approved','rejected','returned')),
  actor_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists campaign_approval_events_idx on public.campaign_approval_events(organization_id,campaign_id,created_at desc);
alter table public.campaign_approval_events enable row level security;
create policy "approval viewers" on public.campaign_approval_events for select using(public.has_permission(organization_id,'campaigns.view'));
create policy "approval actors" on public.campaign_approval_events for insert with check(public.has_permission(organization_id,'campaigns.submit') or public.has_permission(organization_id,'campaigns.approve'));
commit;
