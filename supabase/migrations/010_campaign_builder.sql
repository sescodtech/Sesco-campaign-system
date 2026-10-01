begin;
-- Phase 6: campaign builder and audience/template linkage.
alter table public.campaigns
  add column if not exists template_id uuid references public.email_templates(id) on delete set null,
  add column if not exists audience_type text check (audience_type in ('list','segment','selected_contacts')),
  add column if not exists list_id uuid references public.contact_lists(id) on delete set null,
  add column if not exists segment_id uuid references public.segments(id) on delete set null,
  add column if not exists content jsonb not null default '[]'::jsonb,
  add column if not exists audience_snapshot_count integer not null default 0,
  add column if not exists timezone text not null default 'UTC';

alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns add constraint campaigns_status_check check(status in ('draft','pending_approval','approved','scheduled','queued','sending','paused','completed','cancelled','failed'));
create index if not exists campaigns_org_status_schedule_idx on public.campaigns(organization_id,status,scheduled_at);
commit;
