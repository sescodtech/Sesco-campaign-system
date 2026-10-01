begin;
-- Phase 20: organization security policy, security events and durable rate limiting.
insert into public.permissions(key,description) values
('security.view','View security settings and events'),
('security.manage','Manage organization security policy')
on conflict(key) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.key in ('security.view','security.manage')
where r.key in ('super_admin','administrator')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.key='security.view'
where r.key='auditor'
on conflict do nothing;

create table if not exists public.security_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  require_mfa boolean not null default false,
  session_timeout_minutes int not null default 480 check(session_timeout_minutes between 15 and 43200),
  webhook_replay_window_seconds int not null default 300 check(webhook_replay_window_seconds between 30 and 3600),
  max_failed_logins int not null default 10 check(max_failed_logins between 3 and 100),
  allow_data_exports boolean not null default true,
  allowed_ip_cidrs text[] not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'notice' check(severity in ('info','notice','warning','critical')),
  ip_address inet,
  user_agent text,
  resource text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_events_org_idx on public.security_events(organization_id,created_at desc);
create index if not exists security_events_type_idx on public.security_events(organization_id,event_type,created_at desc);

create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  hit_count int not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.consume_rate_limit(p_key text,p_limit int,p_window_seconds int)
returns table(allowed boolean, remaining int, reset_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_now timestamptz:=now(); v_row public.rate_limit_buckets%rowtype;
begin
  if p_limit < 1 or p_window_seconds < 1 then raise exception 'invalid rate limit configuration'; end if;
  insert into public.rate_limit_buckets(bucket_key,window_started_at,hit_count,updated_at)
  values(p_key,v_now,1,v_now)
  on conflict(bucket_key) do update set
    window_started_at=case when public.rate_limit_buckets.window_started_at + make_interval(secs=>p_window_seconds) <= v_now then v_now else public.rate_limit_buckets.window_started_at end,
    hit_count=case when public.rate_limit_buckets.window_started_at + make_interval(secs=>p_window_seconds) <= v_now then 1 else public.rate_limit_buckets.hit_count+1 end,
    updated_at=v_now
  returning * into v_row;
  return query select v_row.hit_count <= p_limit, greatest(0,p_limit-v_row.hit_count), v_row.window_started_at + make_interval(secs=>p_window_seconds);
end; $$;
revoke all on function public.consume_rate_limit(text,int,int) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,int,int) to service_role;

alter table public.security_settings enable row level security;
alter table public.security_events enable row level security;
create policy "security settings viewers" on public.security_settings for select using(public.has_permission(organization_id,'security.view'));
create policy "security settings managers" on public.security_settings for all using(public.has_permission(organization_id,'security.manage')) with check(public.has_permission(organization_id,'security.manage'));
create policy "security event viewers" on public.security_events for select using(organization_id is not null and public.has_permission(organization_id,'security.view'));

-- Seed one settings row per existing organization and keep new orgs covered via trigger.
insert into public.security_settings(organization_id) select id from public.organizations on conflict do nothing;
create or replace function public.ensure_org_security_settings() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.security_settings(organization_id) values(new.id) on conflict do nothing; return new; end $$;
drop trigger if exists organizations_security_settings on public.organizations;
create trigger organizations_security_settings after insert on public.organizations for each row execute function public.ensure_org_security_settings();

commit;

begin;
create table if not exists public.webhook_receipts (
  id bigint generated always as identity primary key,
  integration_id uuid references public.integrations(id) on delete cascade,
  provider text not null,
  event_key text not null,
  received_at timestamptz not null default now(),
  unique(provider,integration_id,event_key)
);
create index if not exists webhook_receipts_received_idx on public.webhook_receipts(received_at desc);
alter table public.webhook_receipts enable row level security;
-- Intentionally no authenticated policies: webhook receipts are service-role only.
commit;

begin;
-- Keep default system roles correct for organizations created after these migrations.
create or replace function public.bootstrap_organization(p_name text,p_slug text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_org uuid; v_admin uuid; r record;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if exists(select 1 from public.organization_members where user_id=v_user) then raise exception 'User already belongs to an organization'; end if;
 insert into public.organizations(name,slug) values(p_name,p_slug) returning id into v_org;
 insert into public.roles(organization_id,name,key,description,is_system) values
 (v_org,'Super Admin','super_admin','Full organization access',true),(v_org,'Administrator','administrator','Administrative access',true),(v_org,'Campaign Manager','campaign_manager','Campaign approval and operations',true),(v_org,'Marketing Officer','marketing_officer','Campaign creation and audience work',true),(v_org,'Customer Service','customer_service','Customer engagement visibility',true),(v_org,'Viewer','viewer','Read-only operational access',true),(v_org,'Auditor','auditor','Audit and reporting visibility',true);
 select id into v_admin from public.roles where organization_id=v_org and key='super_admin';
 insert into public.role_permissions(role_id,permission_id) select v_admin,id from public.permissions on conflict do nothing;
 for r in select id,key from public.roles where organization_id=v_org loop
   if r.key='administrator' then insert into public.role_permissions select r.id,id from public.permissions where key <> 'campaigns.approve' on conflict do nothing;
   elsif r.key='campaign_manager' then insert into public.role_permissions select r.id,id from public.permissions where key like 'campaigns.%' or key in ('contacts.view','templates.view','analytics.view','sms.view','sms.manage','sms.send','whatsapp.view','whatsapp.manage','whatsapp.send','automation.view','automation.manage') on conflict do nothing;
   elsif r.key='marketing_officer' then insert into public.role_permissions select r.id,id from public.permissions where key in ('contacts.view','contacts.create','contacts.edit','contacts.import','campaigns.view','campaigns.create','campaigns.edit','campaigns.submit','templates.view','templates.manage','analytics.view','sms.view','whatsapp.view','automation.view') on conflict do nothing;
   elsif r.key='customer_service' then insert into public.role_permissions select r.id,id from public.permissions where key in ('contacts.view','campaigns.view','sms.view','whatsapp.view') on conflict do nothing;
   elsif r.key='viewer' then insert into public.role_permissions select r.id,id from public.permissions where key in ('contacts.view','campaigns.view','templates.view','analytics.view','sms.view','whatsapp.view','automation.view') on conflict do nothing;
   elsif r.key='auditor' then insert into public.role_permissions select r.id,id from public.permissions where key in ('audit.view','audit.export','analytics.view','campaigns.view','contacts.view','security.view','sms.view','whatsapp.view','automation.view') on conflict do nothing; end if;
 end loop;
 insert into public.organization_members(organization_id,user_id,role_id,status) values(v_org,v_user,v_admin,'active');
 return v_org;
end $$;
commit;
