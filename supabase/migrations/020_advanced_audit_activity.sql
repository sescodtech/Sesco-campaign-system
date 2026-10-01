begin;
-- Phase 16: immutable, searchable audit/activity foundation.
alter table public.audit_logs
  add column if not exists category text not null default 'activity',
  add column if not exists severity text not null default 'info',
  add column if not exists source text not null default 'app',
  add column if not exists actor_email text,
  add column if not exists request_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.audit_logs drop constraint if exists audit_logs_severity_check;
alter table public.audit_logs add constraint audit_logs_severity_check check(severity in ('info','notice','warning','critical'));
create index if not exists audit_logs_org_action_idx on public.audit_logs(organization_id,action,created_at desc);
create index if not exists audit_logs_org_category_idx on public.audit_logs(organization_id,category,created_at desc);
create index if not exists audit_logs_org_severity_idx on public.audit_logs(organization_id,severity,created_at desc);

insert into public.permissions(key,description) values
('audit.export','Export audit activity')
on conflict(key) do nothing;

-- Existing application actions write their own audit rows. Restrict inserts to the
-- authenticated actor's active organization and keep UPDATE/DELETE denied by RLS.
drop policy if exists "members insert own audit" on public.audit_logs;
create policy "members insert own audit" on public.audit_logs for insert
with check(public.is_org_member(organization_id) and user_id=auth.uid());

-- Backfill the new audit permission to governance-oriented system roles.
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where p.key='audit.export' and r.key in ('super_admin','administrator','auditor')
on conflict do nothing;

commit;
