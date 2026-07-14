alter table public.candidates
  add column software text[] not null default '{}',
  add column tags text[] not null default '{}',
  add column project_fit_tags text[] not null default '{}',
  add column work_image_count smallint not null default 0 check (work_image_count between 0 and 100),
  add column data_quality_score smallint not null default 0 check (data_quality_score between 0 and 100),
  add column data_quality_missing text[] not null default '{}',
  add column data_quality_updated_at timestamptz;

alter table public.discovery_items
  add column software text[] not null default '{}',
  add column languages text[] not null default '{}',
  add column employment_types text[] not null default '{}',
  add column work_location_preferences text[] not null default '{}',
  add column tags text[] not null default '{}',
  add column project_fit_tags text[] not null default '{}';

create or replace function public.candidate_quality(input public.candidates)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  score integer := 0;
  missing text[] := '{}';
  axis_count integer := 0;
begin
  if length(trim(input.full_name)) > 0 then score := score + 5; else missing := array_append(missing, 'name'); end if;
  if coalesce(length(trim(input.public_profile)), 0) > 0 then score := score + 10; else missing := array_append(missing, 'public_profile'); end if;
  if coalesce(length(trim(input.source_url)), 0) > 0 then score := score + 5; else missing := array_append(missing, 'source_url'); end if;
  if input.work_image_count >= 3 then score := score + 10;
  elsif input.work_image_count > 0 then score := score + 5; missing := array_append(missing, 'portfolio_images_3');
  else missing := array_append(missing, 'portfolio_images'); end if;
  if cardinality(input.skills) > 0 then score := score + 10; else missing := array_append(missing, 'skills'); end if;
  if cardinality(input.software) > 0 then score := score + 10; else missing := array_append(missing, 'software'); end if;
  if cardinality(input.languages) > 0 then score := score + 5; else missing := array_append(missing, 'languages'); end if;
  if length(trim(input.country)) > 0 then score := score + 5; else missing := array_append(missing, 'region'); end if;
  if cardinality(input.employment_types) > 0 then score := score + 5; else missing := array_append(missing, 'employment_types'); end if;
  if cardinality(input.work_location_preferences) > 0 then score := score + 5; else missing := array_append(missing, 'work_location_preferences'); end if;
  if input.ai_score is not null then score := score + 10; else missing := array_append(missing, 'ai_evaluation'); end if;
  select count(*) into axis_count from jsonb_object_keys(coalesce(input.ai_scores, '{}'::jsonb));
  if axis_count >= 8 then score := score + 10; else missing := array_append(missing, 'ai_8_axes'); end if;
  if cardinality(input.ai_recommended_projects) > 0 then score := score + 5; else missing := array_append(missing, 'recommended_projects'); end if;
  if cardinality(input.ai_strengths) > 0 and cardinality(input.ai_risks) > 0 then score := score + 5; else missing := array_append(missing, 'strengths_concerns'); end if;
  return jsonb_build_object('score', score, 'missing', to_jsonb(missing));
end;
$$;

create or replace function public.set_candidate_quality()
returns trigger language plpgsql set search_path = '' as $$
declare result jsonb;
begin
  result := public.candidate_quality(new);
  new.data_quality_score := (result->>'score')::smallint;
  new.data_quality_missing := array(select jsonb_array_elements_text(result->'missing'));
  new.data_quality_updated_at := now();
  return new;
end;
$$;

create trigger candidates_set_data_quality
before insert or update on public.candidates
for each row execute function public.set_candidate_quality();

update public.candidates set work_image_count = case when image_path is null then 0 else 1 end;

create table public.data_quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  total_candidates integer not null check (total_candidates >= 0),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.scout_test_cases (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  query text not null check (char_length(query) between 1 and 1200),
  human_rating smallint check (human_rating between 1 and 5),
  comments text check (comments is null or char_length(comments) <= 3000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scout_test_expected_results (
  test_case_id uuid not null references public.scout_test_cases(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  expected_rank smallint not null check (expected_rank between 1 and 20),
  created_at timestamptz not null default now(),
  primary key (test_case_id, candidate_id),
  unique (test_case_id, expected_rank)
);

create table public.scout_test_runs (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid not null references public.scout_test_cases(id) on delete cascade,
  scout_version text not null check (char_length(scout_version) between 1 and 100),
  actual_candidate_ids uuid[] not null default '{}',
  precision_at_3 numeric(5,4),
  precision_at_5 numeric(5,4),
  sample_size integer not null default 0 check (sample_size >= 0),
  sample_status text not null check (sample_status in ('insufficient', 'evaluable')),
  status text not null check (status in ('succeeded', 'failed')),
  human_rating smallint check (human_rating between 1 and 5),
  comments text check (comments is null or char_length(comments) <= 3000),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  executed_at timestamptz not null default now()
);

create index candidates_data_quality_score_idx on public.candidates (data_quality_score);
create index scout_test_cases_created_by_idx on public.scout_test_cases (created_by, updated_at desc);
create index scout_test_runs_case_idx on public.scout_test_runs (test_case_id, executed_at desc);
create index scout_test_expected_candidate_idx on public.scout_test_expected_results (candidate_id);

alter table public.data_quality_snapshots enable row level security;
alter table public.scout_test_cases enable row level security;
alter table public.scout_test_expected_results enable row level security;
alter table public.scout_test_runs enable row level security;

create policy "Users manage own quality snapshots" on public.data_quality_snapshots for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "Users manage own scout test cases" on public.scout_test_cases for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "Users manage own expected scout results" on public.scout_test_expected_results for all to authenticated
  using (exists (select 1 from public.scout_test_cases c where c.id = test_case_id and c.created_by = (select auth.uid())))
  with check (exists (select 1 from public.scout_test_cases c where c.id = test_case_id and c.created_by = (select auth.uid())));
create policy "Users manage own scout test runs" on public.scout_test_runs for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

grant select, insert, delete on public.data_quality_snapshots to authenticated;
grant select, insert, update, delete on public.scout_test_cases to authenticated;
grant select, insert, update, delete on public.scout_test_expected_results to authenticated;
grant select, insert, update, delete on public.scout_test_runs to authenticated;
grant execute on function public.candidate_quality(public.candidates) to authenticated;
