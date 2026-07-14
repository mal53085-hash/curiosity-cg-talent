create table public.visual_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  project_type text check (project_type is null or char_length(project_type) <= 120),
  brand_tone text check (brand_tone is null or char_length(brand_tone) <= 200),
  space_type text check (space_type is null or char_length(space_type) <= 120),
  time_of_day text check (time_of_day is null or char_length(time_of_day) <= 80),
  priority_criteria text[] not null default '{}',
  additional_conditions text check (additional_conditions is null or char_length(additional_conditions) <= 2000),
  rights_confirmed boolean not null check (rights_confirmed),
  retention_days smallint not null default 30 check (retention_days between 1 and 30),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.visual_search_images (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.visual_searches(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  width integer not null check (width between 1 and 12000),
  height integer not null check (height between 1 and 12000),
  sha256 text not null check (char_length(sha256) = 64),
  visual_features jsonb not null default '{}'::jsonb check (jsonb_typeof(visual_features) = 'object'),
  analysis_model text,
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.visual_search_runs (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.visual_searches(id) on delete cascade,
  status text not null default 'running' check (status in ('running','succeeded','failed','blocked')),
  reference_image_count smallint not null default 0 check (reference_image_count between 0 and 5),
  candidate_pool_count integer not null default 0 check (candidate_pool_count >= 0),
  reranked_count smallint not null default 0 check (reranked_count between 0 and 20),
  result_count smallint not null default 0 check (result_count between 0 and 10),
  estimated_api_calls smallint not null default 0 check (estimated_api_calls between 0 and 30),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  model text,
  error_code text check (error_code is null or char_length(error_code) <= 80),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.visual_search_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.visual_search_runs(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  rank smallint not null check (rank between 1 and 10),
  visual_fit_score smallint not null check (visual_fit_score between 0 and 100),
  scout_score smallint check (scout_score between 0 and 100),
  similar_features text[] not null default '{}',
  different_features text[] not null default '{}',
  strengths text[] not null default '{}',
  risks text[] not null default '{}',
  recommended_scope text not null default '',
  interview_questions text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (run_id, candidate_id), unique (run_id, rank)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  event_type text not null check (char_length(event_type) between 1 and 100),
  resource_type text not null check (char_length(resource_type) between 1 and 80),
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index visual_searches_owner_expiry_idx on public.visual_searches (created_by, expires_at);
create index visual_search_images_search_idx on public.visual_search_images (search_id);
create index visual_search_runs_owner_started_idx on public.visual_search_runs (created_by, started_at desc);
create index visual_search_runs_search_idx on public.visual_search_runs (search_id, started_at desc);
create index visual_search_results_run_rank_idx on public.visual_search_results (run_id, rank);
create index visual_search_results_candidate_idx on public.visual_search_results (candidate_id);
create index audit_events_resource_idx on public.audit_events (resource_type, resource_id, created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_id, created_at desc);

alter table public.visual_searches enable row level security;
alter table public.visual_search_images enable row level security;
alter table public.visual_search_runs enable row level security;
alter table public.visual_search_results enable row level security;
alter table public.audit_events enable row level security;

create policy "Users manage own visual searches" on public.visual_searches for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "Users manage own visual images" on public.visual_search_images for all to authenticated
  using (exists (select 1 from public.visual_searches s where s.id = search_id and s.created_by = (select auth.uid())))
  with check (exists (select 1 from public.visual_searches s where s.id = search_id and s.created_by = (select auth.uid())));
create policy "Users manage own visual runs" on public.visual_search_runs for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "Users manage own visual results" on public.visual_search_results for all to authenticated
  using (exists (select 1 from public.visual_search_runs r where r.id = run_id and r.created_by = (select auth.uid())))
  with check (exists (select 1 from public.visual_search_runs r where r.id = run_id and r.created_by = (select auth.uid())));
create policy "Users read own audit events" on public.audit_events for select to authenticated using (actor_id = (select auth.uid()));
create policy "Users create own audit events" on public.audit_events for insert to authenticated with check (actor_id = (select auth.uid()));

grant select, insert, update, delete on public.visual_searches to authenticated;
grant select, insert, update, delete on public.visual_search_images to authenticated;
grant select, insert, update, delete on public.visual_search_runs to authenticated;
grant select, insert, delete on public.visual_search_results to authenticated;
grant select, insert on public.audit_events to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('visual-search-quarantine', 'visual-search-quarantine', false, 8388608, array['image/jpeg','image/png','image/webp']),
  ('visual-search-references', 'visual-search-references', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload own visual references" on storage.objects for insert to authenticated
  with check (bucket_id in ('visual-search-quarantine','visual-search-references') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users read own visual references" on storage.objects for select to authenticated
  using (bucket_id in ('visual-search-quarantine','visual-search-references') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update own visual references" on storage.objects for update to authenticated
  using (bucket_id in ('visual-search-quarantine','visual-search-references') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('visual-search-quarantine','visual-search-references') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own visual references" on storage.objects for delete to authenticated
  using (bucket_id in ('visual-search-quarantine','visual-search-references') and (storage.foldername(name))[1] = (select auth.uid())::text);
