begin;

-- Phase 5: structured reusable email templates.
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null default 'general',
  subject text not null default '',
  preheader text,
  content jsonb not null default '[]'::jsonb,
  status text not null default 'active' check(status in ('draft','active','archived')),
  thumbnail_url text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,name)
);
create index if not exists email_templates_org_status_idx on public.email_templates(organization_id,status,updated_at desc);
drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at before update on public.email_templates for each row execute function public.set_updated_at();

alter table public.email_templates enable row level security;
create policy "template viewers" on public.email_templates for select using(public.has_permission(organization_id,'templates.view'));
create policy "template managers create" on public.email_templates for insert with check(public.has_permission(organization_id,'templates.manage'));
create policy "template managers update" on public.email_templates for update using(public.has_permission(organization_id,'templates.manage')) with check(public.has_permission(organization_id,'templates.manage'));
create policy "template managers delete" on public.email_templates for delete using(public.has_permission(organization_id,'templates.manage'));

commit;
