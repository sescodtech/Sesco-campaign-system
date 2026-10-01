begin;
-- Phase 9: scheduling and idempotent dispatch support.
alter table public.campaigns add column if not exists dispatched_at timestamptz;
create index if not exists campaigns_due_schedule_idx on public.campaigns(scheduled_at) where status='scheduled';

create or replace function public.reserve_due_campaign_jobs(p_limit int default 10)
returns setof public.campaign_jobs
language plpgsql security definer set search_path=public as $$
begin
  return query
  update public.campaign_jobs j
     set status='running', lock_token=gen_random_uuid(), locked_at=now(), updated_at=now()
   where j.id in (
     select id from public.campaign_jobs
      where status='pending' and scheduled_for <= now()
      order by scheduled_for asc
      for update skip locked
      limit greatest(1,least(p_limit,50))
   )
  returning j.*;
end; $$;
revoke all on function public.reserve_due_campaign_jobs(int) from public, anon, authenticated;
grant execute on function public.reserve_due_campaign_jobs(int) to service_role;
commit;
