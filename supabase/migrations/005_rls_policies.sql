begin;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_members enable row level security;
alter table public.contacts enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_metrics enable row level security;
alter table public.integrations enable row level security;
alter table public.audit_logs enable row level security;

create policy "members read organization" on public.organizations for select using(public.is_org_member(id));
create policy "users read own profile" on public.profiles for select using(id=auth.uid());
create policy "users update own profile" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy "members read roles" on public.roles for select using(public.is_org_member(organization_id));
create policy "authenticated read permissions" on public.permissions for select to authenticated using(true);
create policy "members read role permissions" on public.role_permissions for select using(exists(select 1 from public.roles r where r.id=role_id and public.is_org_member(r.organization_id)));
create policy "users read memberships" on public.organization_members for select using(user_id=auth.uid() or public.is_org_member(organization_id));

create policy "members read contacts" on public.contacts for select using(public.is_org_member(organization_id));
create policy "contact creators" on public.contacts for insert with check(public.has_permission(organization_id,'contacts.create') or public.has_permission(organization_id,'contacts.import'));
create policy "contact editors" on public.contacts for update using(public.has_permission(organization_id,'contacts.edit')) with check(public.has_permission(organization_id,'contacts.edit'));
create policy "contact deleters" on public.contacts for delete using(public.has_permission(organization_id,'contacts.delete'));

create policy "members read campaigns" on public.campaigns for select using(public.has_permission(organization_id,'campaigns.view'));
create policy "campaign creators" on public.campaigns for insert with check(public.has_permission(organization_id,'campaigns.create'));
create policy "campaign editors" on public.campaigns for update using(public.has_permission(organization_id,'campaigns.edit')) with check(public.has_permission(organization_id,'campaigns.edit'));
create policy "members read metrics" on public.campaign_metrics for select using(public.has_permission(organization_id,'analytics.view'));
create policy "members read integrations" on public.integrations for select using(public.is_org_member(organization_id));
create policy "integration managers" on public.integrations for all using(public.has_permission(organization_id,'integrations.manage')) with check(public.has_permission(organization_id,'integrations.manage'));
create policy "audit viewers" on public.audit_logs for select using(public.has_permission(organization_id,'audit.view'));
commit;
