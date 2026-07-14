create table public.scout_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  original_query text not null check (char_length(original_query) between 1 and 1200),
  structured_filters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(structured_filters) = 'object'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scout_runs (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references public.scout_searches(id) on delete set null,
  original_query text not null check (char_length(original_query) between 1 and 1200),
  structured_filters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(structured_filters) = 'object'),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  candidate_pool_count integer not null default 0 check (candidate_pool_count >= 0),
  ranked_count integer not null default 0 check (ranked_count >= 0),
  model text,
  error_message text check (error_message is null or char_length(error_message) <= 1000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.scout_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.scout_runs(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  rank smallint not null check (rank between 1 and 50),
  scout_score smallint not null check (scout_score between 0 and 100),
  fit_reason text not null check (char_length(fit_reason) between 1 and 2000),
  strengths text[] not null default '{}',
  concerns text[] not null default '{}',
  recommended_project text not null default '',
  interview_questions text[] not null default '{}',
  comparison jsonb not null default '{}'::jsonb
    check (jsonb_typeof(comparison) = 'object'),
  created_at timestamptz not null default now(),
  unique (run_id, candidate_id),
  unique (run_id, rank)
);

create index scout_searches_created_by_updated_idx
  on public.scout_searches (created_by, updated_at desc);
create index scout_runs_created_by_started_idx
  on public.scout_runs (created_by, started_at desc);
create index scout_runs_search_started_idx
  on public.scout_runs (search_id, started_at desc)
  where search_id is not null;
create index scout_results_candidate_idx
  on public.scout_results (candidate_id, created_at desc);

create function public.set_scout_search_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create trigger scout_searches_set_audit_fields
before insert or update on public.scout_searches
for each row execute function public.set_scout_search_audit_fields();

alter table public.scout_searches enable row level security;
alter table public.scout_runs enable row level security;
alter table public.scout_results enable row level security;

create policy "Users can select own scout searches"
on public.scout_searches for select
to authenticated
using ((select auth.uid()) = created_by);

create policy "Users can insert own scout searches"
on public.scout_searches for insert
to authenticated
with check ((select auth.uid()) = created_by);

create policy "Users can update own scout searches"
on public.scout_searches for update
to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by);

create policy "Users can delete own scout searches"
on public.scout_searches for delete
to authenticated
using ((select auth.uid()) = created_by);

create policy "Users can select own scout runs"
on public.scout_runs for select
to authenticated
using ((select auth.uid()) = created_by);

create policy "Users can insert own scout runs"
on public.scout_runs for insert
to authenticated
with check ((select auth.uid()) = created_by);

create policy "Users can update own scout runs"
on public.scout_runs for update
to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by);

create policy "Users can delete own scout runs"
on public.scout_runs for delete
to authenticated
using ((select auth.uid()) = created_by);

create policy "Users can select own scout results"
on public.scout_results for select
to authenticated
using (
  exists (
    select 1 from public.scout_runs
    where scout_runs.id = scout_results.run_id
      and scout_runs.created_by = (select auth.uid())
  )
);

create policy "Users can insert own scout results"
on public.scout_results for insert
to authenticated
with check (
  exists (
    select 1 from public.scout_runs
    where scout_runs.id = scout_results.run_id
      and scout_runs.created_by = (select auth.uid())
  )
);

create policy "Users can delete own scout results"
on public.scout_results for delete
to authenticated
using (
  exists (
    select 1 from public.scout_runs
    where scout_runs.id = scout_results.run_id
      and scout_runs.created_by = (select auth.uid())
  )
);

grant select, insert, update, delete on table public.scout_searches to authenticated;
grant select, insert, update, delete on table public.scout_runs to authenticated;
grant select, insert, delete on table public.scout_results to authenticated;

comment on table public.scout_searches is 'Saved AI Scout searches owned by one authenticated user.';
comment on table public.scout_runs is 'Auditable AI Scout executions; errors must not contain secrets.';
comment on table public.scout_results is 'Requirement-relative rankings. Scout score is separate from candidate AI score.';
