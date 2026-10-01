begin;
create table if not exists public.roles (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null, key text not null, description text, is_system boolean not null default false, created_at timestamptz not null default now(),
 unique(organization_id,key)
);
create table if not exists public.permissions (
 id uuid primary key default gen_random_uuid(), key text not null unique, description text, created_at timestamptz not null default now()
);
create table if not exists public.role_permissions (
 role_id uuid not null references public.roles(id) on delete cascade, permission_id uuid not null references public.permissions(id) on delete cascade,
 primary key(role_id,permission_id)
);
create table if not exists public.organization_members (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, role_id uuid references public.roles(id) on delete set null,
 status text not null default 'active' check(status in ('active','invited','disabled')), invited_by uuid references auth.users(id), joined_at timestamptz default now(), created_at timestamptz not null default now(),
 unique(organization_id,user_id)
);
create index if not exists organization_members_user_idx on public.organization_members(user_id);
create index if not exists organization_members_org_idx on public.organization_members(organization_id);

insert into public.permissions(key,description) values
('contacts.view','View contacts'),('contacts.create','Create contacts'),('contacts.edit','Edit contacts'),('contacts.delete','Delete contacts'),('contacts.import','Import contacts'),
('campaigns.view','View campaigns'),('campaigns.create','Create campaigns'),('campaigns.edit','Edit campaigns'),('campaigns.submit','Submit campaigns'),('campaigns.approve','Approve campaigns'),('campaigns.send','Send campaigns'),('campaigns.pause','Pause campaigns'),('campaigns.cancel','Cancel campaigns'),
('templates.view','View templates'),('templates.manage','Manage templates'),('analytics.view','View analytics'),('integrations.manage','Manage integrations'),('team.view','View team'),('team.manage','Manage team'),('audit.view','View audit'),('settings.manage','Manage settings')
on conflict(key) do nothing;

create or replace function public.is_org_member(p_org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_members m where m.organization_id=p_org and m.user_id=auth.uid() and m.status='active')
$$;
create or replace function public.has_permission(p_org uuid,p_permission text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_members m join public.role_permissions rp on rp.role_id=m.role_id join public.permissions p on p.id=rp.permission_id where m.organization_id=p_org and m.user_id=auth.uid() and m.status='active' and p.key=p_permission)
$$;

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
   elsif r.key='campaign_manager' then insert into public.role_permissions select r.id,id from public.permissions where key like 'campaigns.%' or key in ('contacts.view','templates.view','analytics.view') on conflict do nothing;
   elsif r.key='marketing_officer' then insert into public.role_permissions select r.id,id from public.permissions where key in ('contacts.view','contacts.create','contacts.edit','contacts.import','campaigns.view','campaigns.create','campaigns.edit','campaigns.submit','templates.view','templates.manage','analytics.view') on conflict do nothing;
   elsif r.key='customer_service' then insert into public.role_permissions select r.id,id from public.permissions where key in ('contacts.view','campaigns.view') on conflict do nothing;
   elsif r.key='viewer' then insert into public.role_permissions select r.id,id from public.permissions where key in ('contacts.view','campaigns.view','templates.view','analytics.view') on conflict do nothing;
   elsif r.key='auditor' then insert into public.role_permissions select r.id,id from public.permissions where key in ('audit.view','analytics.view','campaigns.view','contacts.view') on conflict do nothing; end if;
 end loop;
 insert into public.organization_members(organization_id,user_id,role_id,status) values(v_org,v_user,v_admin,'active');
 return v_org;
end $$;
commit;
