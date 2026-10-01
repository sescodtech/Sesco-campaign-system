begin;
create table if not exists public.contacts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 external_customer_id text, account_number text, first_name text, last_name text, full_name text, email text, phone text, whatsapp_phone text,
 gender text, country text, state text, city text, branch text, account_type text, customer_type text, customer_status text, relationship_manager text,
 date_joined date, last_transaction_date date, balance_band text, email_consent boolean not null default true, sms_consent boolean not null default false,
 whatsapp_consent boolean not null default false, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists contacts_org_idx on public.contacts(organization_id);
create index if not exists contacts_org_email_idx on public.contacts(organization_id,email);
create trigger contacts_set_updated_at before update on public.contacts for each row execute function public.set_updated_at();

create table if not exists public.campaigns (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null, description text, channel text not null default 'email' check(channel in ('email','sms','whatsapp')), status text not null default 'draft',
 subject text, sender_name text, sender_email text, reply_to text, scheduled_at timestamptz, started_at timestamptz, completed_at timestamptz,
 created_by uuid references auth.users(id), approved_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists campaigns_org_idx on public.campaigns(organization_id);
create trigger campaigns_set_updated_at before update on public.campaigns for each row execute function public.set_updated_at();

create table if not exists public.campaign_metrics (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, campaign_id uuid not null references public.campaigns(id) on delete cascade,
 recipients int not null default 0, queued int not null default 0, sent int not null default 0, delivered int not null default 0, opened int not null default 0, clicked int not null default 0,
 bounced int not null default 0, failed int not null default 0, unsubscribed int not null default 0, updated_at timestamptz not null default now(), unique(campaign_id)
);
create table if not exists public.integrations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, provider text not null, channel text not null,
 credentials_encrypted text, sender_name text, sender_email text, reply_to text, status text not null default 'not_connected', daily_limit int, monthly_limit int,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,provider,channel)
);
create trigger integrations_set_updated_at before update on public.integrations for each row execute function public.set_updated_at();
create table if not exists public.audit_logs (
 id bigint generated always as identity primary key, organization_id uuid references public.organizations(id) on delete cascade, user_id uuid references auth.users(id) on delete set null,
 action text not null, entity_type text, entity_id text, before_data jsonb, after_data jsonb, ip_address inet, user_agent text, created_at timestamptz not null default now()
);
create index if not exists audit_logs_org_created_idx on public.audit_logs(organization_id,created_at desc);
commit;
