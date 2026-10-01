begin;
-- Phase 15: team invitations and role management metadata.
alter table public.profiles add column if not exists email text;
update public.profiles p set email=u.email from auth.users u where u.id=p.id and (p.email is null or p.email='');
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email) on conflict(id) do update set email=coalesce(public.profiles.email,excluded.email); return new; end $$;
create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role_id uuid not null references public.roles(id) on delete restrict,
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check(status in ('pending','accepted','revoked','expired')),
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz not null default (now()+interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(organization_id,email,status)
);
create index if not exists team_invitations_org_idx on public.team_invitations(organization_id,created_at desc);
alter table public.team_invitations enable row level security;
create policy "team invitation viewers" on public.team_invitations for select using(public.has_permission(organization_id,'team.view'));
create policy "team invitation managers" on public.team_invitations for all using(public.has_permission(organization_id,'team.manage')) with check(public.has_permission(organization_id,'team.manage'));

-- Managers need to update memberships/roles within their own organization.
create policy "team managers update memberships" on public.organization_members for update using(public.has_permission(organization_id,'team.manage')) with check(public.has_permission(organization_id,'team.manage'));
create policy "team managers manage roles" on public.roles for insert with check(public.has_permission(organization_id,'team.manage'));
create policy "team managers update roles" on public.roles for update using(public.has_permission(organization_id,'team.manage')) with check(public.has_permission(organization_id,'team.manage'));
create policy "team managers delete custom roles" on public.roles for delete using(public.has_permission(organization_id,'team.manage') and not is_system);
create policy "team managers manage role permissions" on public.role_permissions for all using(exists(select 1 from public.roles r where r.id=role_id and public.has_permission(r.organization_id,'team.manage'))) with check(exists(select 1 from public.roles r where r.id=role_id and public.has_permission(r.organization_id,'team.manage')));
commit;
