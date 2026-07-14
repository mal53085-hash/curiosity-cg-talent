create table public.style_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.style_profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.style_profiles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  source_visual_search_id uuid references public.visual_searches(id) on delete set null,
  derived_features jsonb not null check (jsonb_typeof(derived_features) = 'object'),
  feature_vector jsonb not null check (jsonb_typeof(feature_vector) = 'array'),
  evaluation_weights jsonb not null default '{}'::jsonb check (jsonb_typeof(evaluation_weights) = 'object'),
  model_version text not null check (char_length(model_version) between 1 and 120),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, version_number)
);

alter table public.visual_searches
  add column style_profile_id uuid references public.style_profiles(id) on delete set null;

alter table public.scout_searches
  add column style_profile_id uuid references public.style_profiles(id) on delete set null;

alter table public.scout_runs
  add column style_profile_id uuid references public.style_profiles(id) on delete set null;

create unique index style_profiles_owner_name_idx
  on public.style_profiles (created_by, lower(name));
create index style_profiles_owner_status_idx
  on public.style_profiles (created_by, status, updated_at desc);
create index style_profile_versions_profile_idx
  on public.style_profile_versions (profile_id, version_number desc);
create index style_profile_versions_source_idx
  on public.style_profile_versions (source_visual_search_id)
  where source_visual_search_id is not null;
create index visual_searches_style_profile_idx
  on public.visual_searches (style_profile_id, updated_at desc)
  where style_profile_id is not null;
create index scout_searches_style_profile_idx
  on public.scout_searches (style_profile_id)
  where style_profile_id is not null;
create index scout_runs_style_profile_idx
  on public.scout_runs (style_profile_id, started_at desc)
  where style_profile_id is not null;

alter table public.style_profiles enable row level security;
alter table public.style_profile_versions enable row level security;

create policy "Users manage own style profiles"
  on public.style_profiles for all to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "Users manage own style profile versions"
  on public.style_profile_versions for all to authenticated
  using (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.style_profiles profile
      where profile.id = profile_id and profile.created_by = (select auth.uid())
    )
  )
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.style_profiles profile
      where profile.id = profile_id and profile.created_by = (select auth.uid())
    )
    and (
      source_visual_search_id is null
      or exists (
        select 1 from public.visual_searches search
        where search.id = source_visual_search_id and search.created_by = (select auth.uid())
      )
    )
  );

grant select, insert, update, delete on public.style_profiles to authenticated;
grant select, insert, delete on public.style_profile_versions to authenticated;

comment on table public.style_profiles is
  'Human-approved reusable style definitions. A visual search never becomes an official profile automatically.';
comment on table public.style_profile_versions is
  'Immutable derived feature snapshots. Original reference images, thumbnails, EXIF, URLs, and caches are prohibited.';
