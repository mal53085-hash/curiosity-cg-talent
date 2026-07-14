create type public.candidate_status as enum (
  'sourcing',
  'screening',
  'interview',
  'trial',
  'offer',
  'hired',
  'on_hold',
  'rejected'
);

create type public.candidate_rating as enum ('unrated', 'A+', 'A', 'B+', 'B', 'C');

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 160),
  email text,
  phone text,
  country text not null default 'Japan',
  city text,
  primary_role text not null check (char_length(primary_role) between 1 and 160),
  years_experience smallint check (years_experience between 0 and 80),
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  availability text,
  status public.candidate_status not null default 'sourcing',
  rating public.candidate_rating not null default 'unrated',
  portfolio_url text,
  source_url text,
  image_path text,
  notes text,
  ai_score smallint check (ai_score between 0 and 100),
  ai_summary text,
  ai_strengths text[] not null default '{}',
  ai_risks text[] not null default '{}',
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.candidates is
  'Shared, invite-only recruiting workspace for Curiosity staff.';

create index candidates_status_idx on public.candidates (status);
create index candidates_rating_idx on public.candidates (rating);
create index candidates_country_idx on public.candidates (country);
create index candidates_updated_at_idx on public.candidates (updated_at desc);

create function public.set_candidate_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_candidate_audit_fields
before update on public.candidates
for each row execute function public.set_candidate_audit_fields();

alter table public.candidates enable row level security;

-- Access model: Supabase Auth accounts are provisioned by an administrator.
-- Every authenticated account is a member of this shared recruiting workspace.
create policy "workspace members can read candidates"
on public.candidates for select
to authenticated
using ((select auth.uid()) is not null);

create policy "workspace members can create candidates"
on public.candidates for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and created_by = (select auth.uid())
);

create policy "workspace members can update candidates"
on public.candidates for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

create policy "workspace members can delete candidates"
on public.candidates for delete
to authenticated
using ((select auth.uid()) is not null);

grant select, insert, update, delete on table public.candidates to authenticated;
revoke all on table public.candidates from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-images',
  'candidate-images',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "workspace members can view candidate images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'candidate-images'
  and (select auth.uid()) is not null
  and exists (
    select 1 from public.candidates
    where candidates.id::text = (storage.foldername(name))[1]
  )
);

create policy "workspace members can upload candidate images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'candidate-images'
  and (select auth.uid()) is not null
  and exists (
    select 1 from public.candidates
    where candidates.id::text = (storage.foldername(name))[1]
  )
);

create policy "workspace members can delete candidate images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'candidate-images'
  and (select auth.uid()) is not null
);
