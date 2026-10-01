begin;
-- Phase 7: provider integration metadata. Secrets remain encrypted server-side.
alter table public.integrations
  add column if not exists sender_domain text,
  add column if not exists last_tested_at timestamptz,
  add column if not exists last_error text,
  add column if not exists config jsonb not null default '{}'::jsonb;

alter table public.integrations drop constraint if exists integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check check(provider in ('brevo','resend','mailjet','custom_smtp'));
alter table public.integrations drop constraint if exists integrations_channel_check;
alter table public.integrations add constraint integrations_channel_check check(channel in ('email','sms','whatsapp'));
create index if not exists integrations_org_channel_status_idx on public.integrations(organization_id,channel,status);
commit;
