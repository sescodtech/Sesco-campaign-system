begin;
-- Phase 13: normalized contact communication timeline.
create table if not exists public.communication_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  recipient_id uuid references public.campaign_recipients(id) on delete set null,
  channel text not null check(channel in ('email','sms','whatsapp')),
  direction text not null default 'outbound' check(direction in ('outbound','inbound')),
  status text not null,
  subject text,
  destination text,
  provider text,
  provider_message_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists communication_contact_idx on public.communication_history(organization_id,contact_id,occurred_at desc);
alter table public.communication_history enable row level security;
create policy "communication viewers" on public.communication_history for select using(public.has_permission(organization_id,'contacts.view') or public.has_permission(organization_id,'campaigns.view'));
commit;
