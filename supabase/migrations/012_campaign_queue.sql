begin;
-- Phase 8: durable recipient and job queue.
create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  email text,
  phone text,
  personalization jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','queued','processing','sent','delivered','opened','clicked','bounced','failed','unsubscribed','skipped')),
  provider_message_id text,
  attempts int not null default 0,
  last_error text,
  queued_at timestamptz,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id,contact_id)
);
create index if not exists campaign_recipients_queue_idx on public.campaign_recipients(organization_id,campaign_id,status,available_at,created_at);
create index if not exists campaign_recipients_provider_id_idx on public.campaign_recipients(provider_message_id) where provider_message_id is not null;
drop trigger if exists campaign_recipients_set_updated_at on public.campaign_recipients;
create trigger campaign_recipients_set_updated_at before update on public.campaign_recipients for each row execute function public.set_updated_at();

create table if not exists public.campaign_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  provider text not null,
  status text not null default 'pending' check(status in ('pending','running','completed','failed','cancelled')),
  scheduled_for timestamptz not null default now(),
  batch_size int not null default 50 check(batch_size between 1 and 500),
  processed_count int not null default 0,
  failed_count int not null default 0,
  retry_count int not null default 0,
  max_retries int not null default 3,
  lock_token uuid,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id,scheduled_for)
);
create index if not exists campaign_jobs_due_idx on public.campaign_jobs(status,scheduled_for) where status='pending';
drop trigger if exists campaign_jobs_set_updated_at on public.campaign_jobs;
create trigger campaign_jobs_set_updated_at before update on public.campaign_jobs for each row execute function public.set_updated_at();

alter table public.campaign_recipients enable row level security;
alter table public.campaign_jobs enable row level security;
create policy "campaign recipient viewers" on public.campaign_recipients for select using(public.has_permission(organization_id,'campaigns.view'));
create policy "campaign recipient managers" on public.campaign_recipients for all using(public.has_permission(organization_id,'campaigns.send')) with check(public.has_permission(organization_id,'campaigns.send'));
create policy "campaign job viewers" on public.campaign_jobs for select using(public.has_permission(organization_id,'campaigns.view'));
create policy "campaign job managers" on public.campaign_jobs for all using(public.has_permission(organization_id,'campaigns.send')) with check(public.has_permission(organization_id,'campaigns.send'));
commit;
