begin;
-- Phase 17: SMS channel, templates and provider-ready campaign delivery.
insert into public.permissions(key,description) values
('sms.view','View SMS configuration and activity'),
('sms.manage','Manage SMS providers and templates'),
('sms.send','Send SMS campaigns')
on conflict(key) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.key in ('sms.view','sms.manage','sms.send')
where r.key in ('super_admin','administrator','campaign_manager')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.key='sms.view'
where r.key in ('marketing_officer','viewer','auditor')
on conflict do nothing;

create table if not exists public.channel_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check(channel in ('sms','whatsapp')),
  name text not null,
  category text not null default 'general',
  body text not null default '',
  provider_template_name text,
  provider_template_language text,
  provider_components jsonb not null default '[]'::jsonb,
  status text not null default 'active' check(status in ('draft','active','archived')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,channel,name)
);
create index if not exists channel_templates_org_idx on public.channel_templates(organization_id,channel,status,updated_at desc);
drop trigger if exists channel_templates_set_updated_at on public.channel_templates;
create trigger channel_templates_set_updated_at before update on public.channel_templates for each row execute function public.set_updated_at();
alter table public.channel_templates enable row level security;
create policy "channel template viewers" on public.channel_templates for select using(public.has_permission(organization_id,'templates.view'));
create policy "channel template creators" on public.channel_templates for insert with check(public.has_permission(organization_id,'templates.manage'));
create policy "channel template editors" on public.channel_templates for update using(public.has_permission(organization_id,'templates.manage')) with check(public.has_permission(organization_id,'templates.manage'));
create policy "channel template deleters" on public.channel_templates for delete using(public.has_permission(organization_id,'templates.manage'));

alter table public.campaigns
  add column if not exists channel_template_id uuid references public.channel_templates(id) on delete set null,
  add column if not exists text_content text;

alter table public.campaign_recipients
  add column if not exists channel text not null default 'email',
  add column if not exists destination text,
  add column if not exists whatsapp_phone text;
update public.campaign_recipients set destination=coalesce(destination,email,phone), channel=coalesce(channel,'email') where destination is null;
create index if not exists campaign_recipients_destination_idx on public.campaign_recipients(organization_id,channel,destination);

alter table public.message_events add column if not exists channel text not null default 'email';

-- Provider list now includes SMS adapters. The actual API credentials remain encrypted.
alter table public.integrations drop constraint if exists integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check check(provider in ('brevo','resend','mailjet','custom_smtp','termii','custom_sms'));

commit;
