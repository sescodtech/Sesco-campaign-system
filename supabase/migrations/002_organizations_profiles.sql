begin;
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  logo_url text, industry text, website text, country text, timezone text not null default 'Africa/Lagos',
  default_currency text not null default 'NGN', status text not null default 'active' check(status in ('active','suspended','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, full_name text, avatar_url text,
  status text not null default 'active' check(status in ('active','disabled','invited')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
commit;
