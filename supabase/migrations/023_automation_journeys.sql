begin;
-- Phase 19: multi-channel journey orchestration, delays and event conditions.
insert into public.permissions(key,description) values
('automation.view','View automation journeys'),
('automation.manage','Create and manage automation journeys')
on conflict(key) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.key in ('automation.view','automation.manage')
where r.key in ('super_admin','administrator','campaign_manager')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.key='automation.view'
where r.key in ('marketing_officer','viewer','auditor')
on conflict do nothing;

create table if not exists public.automation_journeys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check(status in ('draft','active','paused','archived')),
  trigger_type text not null default 'manual' check(trigger_type in ('manual','list','segment','contact_created','campaign_event')),
  trigger_config jsonb not null default '{}'::jsonb,
  list_id uuid references public.contact_lists(id) on delete set null,
  segment_id uuid references public.segments(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,name)
);
create index if not exists automation_journeys_org_idx on public.automation_journeys(organization_id,status,updated_at desc);
drop trigger if exists automation_journeys_set_updated_at on public.automation_journeys;
create trigger automation_journeys_set_updated_at before update on public.automation_journeys for each row execute function public.set_updated_at();

create table if not exists public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_id uuid not null references public.automation_journeys(id) on delete cascade,
  step_order int not null check(step_order > 0),
  step_type text not null check(step_type in ('email','sms','whatsapp','delay','condition')),
  name text,
  config jsonb not null default '{}'::jsonb,
  wait_minutes int not null default 0 check(wait_minutes between 0 and 525600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(automation_id,step_order)
);
create index if not exists automation_steps_order_idx on public.automation_steps(automation_id,step_order);
drop trigger if exists automation_steps_set_updated_at on public.automation_steps;
create trigger automation_steps_set_updated_at before update on public.automation_steps for each row execute function public.set_updated_at();

create table if not exists public.automation_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_id uuid not null references public.automation_journeys(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'active' check(status in ('active','completed','paused','cancelled','failed')),
  current_step_order int not null default 1,
  trigger_event_id bigint references public.message_events(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text,
  unique(automation_id,contact_id,status)
);
create index if not exists automation_enrollments_org_idx on public.automation_enrollments(organization_id,automation_id,status,enrolled_at desc);

create table if not exists public.automation_step_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_id uuid not null references public.automation_journeys(id) on delete cascade,
  enrollment_id uuid not null references public.automation_enrollments(id) on delete cascade,
  step_id uuid not null references public.automation_steps(id) on delete cascade,
  step_order int not null,
  status text not null default 'pending' check(status in ('pending','running','completed','failed','skipped','waiting')),
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  attempts int not null default 0,
  provider_message_id text,
  result jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  unique(enrollment_id,step_id)
);
create index if not exists automation_step_runs_due_idx on public.automation_step_runs(status,scheduled_for) where status in ('pending','waiting');

alter table public.message_events
  add column if not exists automation_id uuid references public.automation_journeys(id) on delete set null,
  add column if not exists automation_enrollment_id uuid references public.automation_enrollments(id) on delete set null,
  add column if not exists automation_step_id uuid references public.automation_steps(id) on delete set null;

alter table public.communication_history
  add column if not exists automation_id uuid references public.automation_journeys(id) on delete set null,
  add column if not exists automation_enrollment_id uuid references public.automation_enrollments(id) on delete set null;

alter table public.automation_journeys enable row level security;
alter table public.automation_steps enable row level security;
alter table public.automation_enrollments enable row level security;
alter table public.automation_step_runs enable row level security;
create policy "automation viewers" on public.automation_journeys for select using(public.has_permission(organization_id,'automation.view'));
create policy "automation managers" on public.automation_journeys for all using(public.has_permission(organization_id,'automation.manage')) with check(public.has_permission(organization_id,'automation.manage'));
create policy "automation step viewers" on public.automation_steps for select using(public.has_permission(organization_id,'automation.view'));
create policy "automation step managers" on public.automation_steps for all using(public.has_permission(organization_id,'automation.manage')) with check(public.has_permission(organization_id,'automation.manage'));
create policy "automation enrollment viewers" on public.automation_enrollments for select using(public.has_permission(organization_id,'automation.view'));
create policy "automation enrollment managers" on public.automation_enrollments for all using(public.has_permission(organization_id,'automation.manage')) with check(public.has_permission(organization_id,'automation.manage'));
create policy "automation run viewers" on public.automation_step_runs for select using(public.has_permission(organization_id,'automation.view'));
create policy "automation run managers" on public.automation_step_runs for all using(public.has_permission(organization_id,'automation.manage')) with check(public.has_permission(organization_id,'automation.manage'));

create or replace function public.reserve_due_automation_runs(p_limit int default 20)
returns setof public.automation_step_runs
language plpgsql security definer set search_path=public as $$
begin
  return query
  update public.automation_step_runs r
     set status='running', started_at=now(), attempts=r.attempts+1
   where r.id in (
     select id from public.automation_step_runs
      where status in ('pending','waiting') and scheduled_for <= now()
      order by scheduled_for asc
      for update skip locked
      limit greatest(1,least(p_limit,100))
   )
  returning r.*;
end; $$;
revoke all on function public.reserve_due_automation_runs(int) from public,anon,authenticated;
grant execute on function public.reserve_due_automation_runs(int) to service_role;

-- Event-driven automations are enrolled server-side after message events are stored.
commit;
