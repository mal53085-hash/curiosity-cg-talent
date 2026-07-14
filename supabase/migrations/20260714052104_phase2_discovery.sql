create type public.discovery_source_type as enum (
  'manual',
  'behance',
  'artstation',
  'linkedin',
  'website'
);

create type public.discovery_item_status as enum (
  'new',
  'approved',
  'rejected',
  'duplicate'
);

create type public.discovery_run_status as enum (
  'running',
  'succeeded',
  'partial',
  'failed',
  'skipped'
);

create type public.import_job_status as enum (
  'pending',
  'processing',
  'completed',
  'failed'
);

alter table public.candidates
  add column source_type public.discovery_source_type not null default 'manual',
  add column external_id text,
  add column discovered_at timestamptz,
  add column discovery_item_id uuid;

create unique index candidates_source_url_unique_idx
  on public.candidates (lower(source_url))
  where source_url is not null;

create unique index candidates_external_id_unique_idx
  on public.candidates (source_type, external_id)
  where external_id is not null;

create table public.discovery_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  source_type public.discovery_source_type not null,
  search_query text not null check (char_length(search_query) between 1 and 400),
  country_hint text,
  enabled boolean not null default true,
  daily_limit smallint not null default 10 check (daily_limit between 1 and 20),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  last_run_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.discovery_sources is
  'Human-managed discovery themes. Automated providers must be explicitly enabled and rate limited.';

create unique index discovery_sources_name_unique_idx
  on public.discovery_sources (lower(name));
create index discovery_sources_enabled_idx
  on public.discovery_sources (enabled, source_type);

create table public.discovery_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.discovery_sources(id) on delete set null,
  source_type public.discovery_source_type not null,
  source_url text not null check (char_length(source_url) between 8 and 2048),
  external_id text,
  title text not null check (char_length(title) between 1 and 300),
  author_name text not null check (char_length(author_name) between 1 and 200),
  description text,
  country text,
  skills text[] not null default '{}',
  thumbnail_url text,
  portfolio_image_urls text[] not null default '{}',
  status public.discovery_item_status not null default 'new',
  preliminary_ai_score smallint check (preliminary_ai_score between 0 and 100),
  preliminary_ai_summary text,
  preliminary_ai_evaluation jsonb,
  recruiter_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(recruiter_metadata) = 'object'),
  raw_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_metadata) = 'object'),
  duplicate_of uuid references public.discovery_items(id) on delete set null,
  candidate_id uuid references public.candidates(id) on delete set null,
  discovered_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_by uuid default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discovery_items_approved_candidate_check check (
    (status = 'approved' and candidate_id is not null)
    or (status <> 'approved')
  )
);

create unique index discovery_items_source_url_unique_idx
  on public.discovery_items (lower(source_url));
create unique index discovery_items_external_id_unique_idx
  on public.discovery_items (source_type, external_id)
  where external_id is not null;
create index discovery_items_inbox_idx
  on public.discovery_items (status, discovered_at desc);
create index discovery_items_source_id_idx
  on public.discovery_items (source_id, discovered_at desc);
create index discovery_items_skills_gin_idx
  on public.discovery_items using gin (skills);
create index discovery_items_candidate_id_idx
  on public.discovery_items (candidate_id)
  where candidate_id is not null;

create table public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.discovery_sources(id) on delete set null,
  trigger_type text not null check (trigger_type in ('cron', 'manual')),
  status public.discovery_run_status not null default 'running',
  items_found integer not null default 0 check (items_found >= 0),
  items_created integer not null default 0 check (items_created >= 0),
  duplicates_found integer not null default 0 check (duplicates_found >= 0),
  error_message text,
  log jsonb not null default '{}'::jsonb check (jsonb_typeof(log) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index discovery_runs_source_started_idx
  on public.discovery_runs (source_id, started_at desc);
create index discovery_runs_status_started_idx
  on public.discovery_runs (status, started_at desc);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_type public.discovery_source_type not null,
  filename text not null check (char_length(filename) between 1 and 255),
  status public.import_job_status not null default 'pending',
  total_rows integer not null default 0 check (total_rows >= 0),
  processed_rows integer not null default 0 check (processed_rows >= 0),
  created_rows integer not null default 0 check (created_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  failed_rows integer not null default 0 check (failed_rows >= 0),
  error_log jsonb not null default '[]'::jsonb check (jsonb_typeof(error_log) = 'array'),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index import_jobs_created_at_idx
  on public.import_jobs (created_at desc);

alter table public.candidates
  add constraint candidates_discovery_item_id_fkey
  foreign key (discovery_item_id)
  references public.discovery_items(id)
  on delete set null;

create unique index candidates_discovery_item_id_unique_idx
  on public.candidates (discovery_item_id)
  where discovery_item_id is not null;

create function public.set_discovery_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger set_discovery_sources_audit_fields
before update on public.discovery_sources
for each row execute function public.set_discovery_audit_fields();

create trigger set_discovery_items_audit_fields
before update on public.discovery_items
for each row execute function public.set_discovery_audit_fields();

alter table public.discovery_sources enable row level security;
alter table public.discovery_items enable row level security;
alter table public.discovery_runs enable row level security;
alter table public.import_jobs enable row level security;

create policy "workspace members can manage discovery sources"
on public.discovery_sources for all
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

create policy "workspace members can manage discovery items"
on public.discovery_items for all
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

create policy "workspace members can manage discovery runs"
on public.discovery_runs for all
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

create policy "workspace members can manage import jobs"
on public.import_jobs for all
to authenticated
using ((select auth.uid()) is not null)
with check (
  (select auth.uid()) is not null
  and created_by = (select auth.uid())
);

grant select, insert, update, delete on table public.discovery_sources to authenticated;
grant select, insert, update, delete on table public.discovery_items to authenticated;
grant select, insert, update, delete on table public.discovery_runs to authenticated;
grant select, insert, update, delete on table public.import_jobs to authenticated;

revoke all on table public.discovery_sources from anon;
revoke all on table public.discovery_items from anon;
revoke all on table public.discovery_runs from anon;
revoke all on table public.import_jobs from anon;
