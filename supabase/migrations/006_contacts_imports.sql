begin;

-- Phase 2: contact data quality, import jobs, staging rows and source traceability.
alter table public.contacts
  add column if not exists source text,
  add column if not exists source_import_id uuid,
  add column if not exists normalized_email text,
  add column if not exists normalized_phone text,
  add column if not exists last_contacted_at timestamptz;

update public.contacts set normalized_email = lower(trim(email)) where email is not null and normalized_email is null;
update public.contacts set normalized_phone = regexp_replace(coalesce(phone,''), '[^0-9+]', '', 'g') where phone is not null and normalized_phone is null;

create index if not exists contacts_org_name_idx on public.contacts(organization_id, full_name);
create index if not exists contacts_org_phone_idx on public.contacts(organization_id, normalized_phone);
create index if not exists contacts_org_customer_idx on public.contacts(organization_id, external_customer_id);
create index if not exists contacts_org_account_idx on public.contacts(organization_id, account_number);
create index if not exists contacts_org_email_lookup_idx on public.contacts(organization_id, normalized_email) where normalized_email is not null and normalized_email <> '';

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  filename text not null,
  file_size bigint,
  worksheet_name text,
  header_row int not null default 1 check(header_row > 0),
  start_row int check(start_row is null or start_row > 0),
  end_row int check(end_row is null or end_row > 0),
  duplicate_strategy text not null default 'skip' check(duplicate_strategy in ('skip','update','create_new_only')),
  total_rows int not null default 0,
  valid_rows int not null default 0,
  invalid_rows int not null default 0,
  duplicate_rows int not null default 0,
  new_rows int not null default 0,
  updated_rows int not null default 0,
  failed_rows int not null default 0,
  status text not null default 'uploaded' check(status in ('uploaded','mapping','validating','ready','processing','completed','failed','cancelled')),
  error_message text,
  mapping jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists imports_org_created_idx on public.imports(organization_id, created_at desc);
drop trigger if exists imports_set_updated_at on public.imports;
create trigger imports_set_updated_at before update on public.imports for each row execute function public.set_updated_at();

create table if not exists public.import_rows (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_id uuid not null references public.imports(id) on delete cascade,
  row_number int not null,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','valid','invalid','duplicate','imported','updated','skipped','failed')),
  errors jsonb not null default '[]'::jsonb,
  matched_contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(import_id,row_number)
);
create index if not exists import_rows_import_idx on public.import_rows(import_id,row_number);
create index if not exists import_rows_org_status_idx on public.import_rows(organization_id,status);

alter table public.imports enable row level security;
alter table public.import_rows enable row level security;

drop policy if exists "members read imports" on public.imports;
create policy "members read imports" on public.imports for select using(public.is_org_member(organization_id));
drop policy if exists "contact importers create imports" on public.imports;
create policy "contact importers create imports" on public.imports for insert with check(public.has_permission(organization_id,'contacts.import'));
drop policy if exists "contact importers update imports" on public.imports;
create policy "contact importers update imports" on public.imports for update using(public.has_permission(organization_id,'contacts.import')) with check(public.has_permission(organization_id,'contacts.import'));

drop policy if exists "members read import rows" on public.import_rows;
create policy "members read import rows" on public.import_rows for select using(public.is_org_member(organization_id));
drop policy if exists "contact importers manage rows" on public.import_rows;
create policy "contact importers manage rows" on public.import_rows for all using(public.has_permission(organization_id,'contacts.import')) with check(public.has_permission(organization_id,'contacts.import'));

commit;
