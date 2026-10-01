begin;

-- Phase 3: custom fields, tags, lists, saved mappings and import usability.
create table if not exists public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key text not null,
  type text not null check(type in ('text','number','date','boolean','select','multi-select')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,key)
);
drop trigger if exists custom_field_definitions_set_updated_at on public.custom_field_definitions;
create trigger custom_field_definitions_set_updated_at before update on public.custom_field_definitions for each row execute function public.set_updated_at();

create table if not exists public.contact_custom_field_values (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  field_id uuid not null references public.custom_field_definitions(id) on delete cascade,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key(contact_id,field_id)
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default 'slate',
  created_at timestamptz not null default now(),
  unique(organization_id,name)
);

create table if not exists public.contact_tags (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(contact_id,tag_id)
);

create table if not exists public.contact_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,name)
);
drop trigger if exists contact_lists_set_updated_at on public.contact_lists;
create trigger contact_lists_set_updated_at before update on public.contact_lists for each row execute function public.set_updated_at();

create table if not exists public.contact_list_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  list_id uuid not null references public.contact_lists(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(list_id,contact_id)
);
create index if not exists contact_list_members_contact_idx on public.contact_list_members(contact_id);

create table if not exists public.import_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  mapping jsonb not null default '{}'::jsonb,
  header_row int not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,name)
);
drop trigger if exists import_mapping_profiles_set_updated_at on public.import_mapping_profiles;
create trigger import_mapping_profiles_set_updated_at before update on public.import_mapping_profiles for each row execute function public.set_updated_at();

alter table public.custom_field_definitions enable row level security;
alter table public.contact_custom_field_values enable row level security;
alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.contact_lists enable row level security;
alter table public.contact_list_members enable row level security;
alter table public.import_mapping_profiles enable row level security;

create policy "members read custom fields" on public.custom_field_definitions for select using(public.is_org_member(organization_id));
create policy "contact editors manage custom fields" on public.custom_field_definitions for all using(public.has_permission(organization_id,'contacts.edit')) with check(public.has_permission(organization_id,'contacts.edit'));
create policy "members read custom values" on public.contact_custom_field_values for select using(public.is_org_member(organization_id));
create policy "contact editors manage custom values" on public.contact_custom_field_values for all using(public.has_permission(organization_id,'contacts.edit')) with check(public.has_permission(organization_id,'contacts.edit'));
create policy "members read tags" on public.tags for select using(public.is_org_member(organization_id));
create policy "contact editors manage tags" on public.tags for all using(public.has_permission(organization_id,'contacts.edit')) with check(public.has_permission(organization_id,'contacts.edit'));
create policy "members read contact tags" on public.contact_tags for select using(public.is_org_member(organization_id));
create policy "contact editors manage contact tags" on public.contact_tags for all using(public.has_permission(organization_id,'contacts.edit')) with check(public.has_permission(organization_id,'contacts.edit'));
create policy "members read contact lists" on public.contact_lists for select using(public.is_org_member(organization_id));
create policy "contact editors manage lists" on public.contact_lists for all using(public.has_permission(organization_id,'contacts.edit')) with check(public.has_permission(organization_id,'contacts.edit'));
create policy "members read list members" on public.contact_list_members for select using(public.is_org_member(organization_id));
create policy "contact editors manage list members" on public.contact_list_members for all using(public.has_permission(organization_id,'contacts.edit')) with check(public.has_permission(organization_id,'contacts.edit'));
create policy "members read mappings" on public.import_mapping_profiles for select using(public.is_org_member(organization_id));
create policy "contact importers manage mappings" on public.import_mapping_profiles for all using(public.has_permission(organization_id,'contacts.import')) with check(public.has_permission(organization_id,'contacts.import'));

commit;
