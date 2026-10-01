begin;

-- Phase 4: saved dynamic audience segments.
create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  rules jsonb not null default '{"operator":"and","children":[]}'::jsonb,
  cached_count int not null default 0,
  last_evaluated_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,name)
);
create index if not exists segments_org_idx on public.segments(organization_id,created_at desc);
drop trigger if exists segments_set_updated_at on public.segments;
create trigger segments_set_updated_at before update on public.segments for each row execute function public.set_updated_at();
alter table public.segments enable row level security;
create policy "members read segments" on public.segments for select using(public.is_org_member(organization_id));
create policy "contact editors manage segments" on public.segments for all using(public.has_permission(organization_id,'contacts.edit')) with check(public.has_permission(organization_id,'contacts.edit'));

commit;
