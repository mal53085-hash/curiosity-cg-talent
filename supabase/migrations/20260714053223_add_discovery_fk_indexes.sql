create index candidates_created_by_idx on public.candidates (created_by);
create index candidates_updated_by_idx on public.candidates (updated_by)
  where updated_by is not null;

create index discovery_sources_created_by_idx on public.discovery_sources (created_by)
  where created_by is not null;
create index discovery_sources_updated_by_idx on public.discovery_sources (updated_by)
  where updated_by is not null;

create index discovery_items_duplicate_of_idx on public.discovery_items (duplicate_of)
  where duplicate_of is not null;
create index discovery_items_reviewed_by_idx on public.discovery_items (reviewed_by)
  where reviewed_by is not null;
create index discovery_items_created_by_idx on public.discovery_items (created_by)
  where created_by is not null;
create index discovery_items_updated_by_idx on public.discovery_items (updated_by)
  where updated_by is not null;

create index discovery_runs_created_by_idx on public.discovery_runs (created_by)
  where created_by is not null;
create index import_jobs_created_by_idx on public.import_jobs (created_by);
