begin;
-- Phase 11: consent, suppression and public unsubscribe foundation.
alter table public.campaign_recipients add column if not exists unsubscribe_token uuid default gen_random_uuid();
create unique index if not exists campaign_recipients_unsubscribe_token_idx on public.campaign_recipients(unsubscribe_token);
create table if not exists public.suppression_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  channel text not null default 'email' check(channel in ('email','sms','whatsapp')),
  destination text not null,
  reason text not null check(reason in ('unsubscribe','hard_bounce','complaint','manual_block','invalid_address')),
  source text,
  campaign_id uuid references public.campaigns(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(organization_id,channel,destination)
);
create index if not exists suppression_org_channel_idx on public.suppression_entries(organization_id,channel,created_at desc);

create table if not exists public.unsubscribe_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  destination text not null,
  scope text not null default 'all_marketing' check(scope in ('campaign','all_marketing')),
  token uuid not null default gen_random_uuid() unique,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists unsubscribe_org_idx on public.unsubscribe_events(organization_id,created_at desc);

create or replace function public.email_is_suppressed(p_org uuid,p_email text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.suppression_entries s where s.organization_id=p_org and s.channel='email' and lower(s.destination)=lower(p_email));
$$;

alter table public.suppression_entries enable row level security;
alter table public.unsubscribe_events enable row level security;
create policy "suppression viewers" on public.suppression_entries for select using(public.has_permission(organization_id,'contacts.view') or public.has_permission(organization_id,'campaigns.view'));
create policy "suppression managers" on public.suppression_entries for all using(public.has_permission(organization_id,'contacts.edit')) with check(public.has_permission(organization_id,'contacts.edit'));
create policy "unsubscribe viewers" on public.unsubscribe_events for select using(public.has_permission(organization_id,'contacts.view') or public.has_permission(organization_id,'analytics.view'));
commit;
