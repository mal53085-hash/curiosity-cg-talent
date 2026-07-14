create type public.hiring_pipeline_stage as enum (
  'new', 'shortlist', 'contacted', 'interview', 'offer', 'closed'
);

create type public.hiring_closed_reason as enum (
  'hired', 'rejected_by_company', 'declined_by_candidate', 'no_response',
  'not_available', 'duplicate', 'future_candidate'
);

create type public.readiness_verification_status as enum (
  'verified', 'self_declared', 'publicly_indicated', 'unknown', 'needs_confirmation'
);

create type public.japan_readiness_grade as enum ('A', 'B', 'C', 'D', 'blocked');
create type public.ui_mode as enum ('simple', 'advanced');

alter table public.candidates
  add column if not exists current_country text,
  add column if not exists current_city text,
  add column if not exists japan_residency_status text,
  add column if not exists japan_work_authorization boolean,
  add column if not exists visa_status text,
  add column if not exists japanese_level text,
  add column if not exists english_level text,
  add column if not exists interested_in_japan boolean,
  add column if not exists willing_to_relocate_to_japan boolean,
  add column if not exists willing_to_work_in_tokyo boolean,
  add column if not exists remote_from_overseas boolean,
  add column if not exists full_time_interest boolean,
  add column if not exists freelance_interest boolean,
  add column if not exists earliest_start_date date,
  add column if not exists hiring_readiness_status public.japan_readiness_grade not null default 'D',
  add column if not exists hiring_readiness_confidence integer not null default 0 check (hiring_readiness_confidence between 0 and 100),
  add column if not exists hiring_readiness_evidence text,
  add column if not exists hiring_readiness_verified_at timestamptz,
  add column if not exists readiness_verification jsonb not null default '{}'::jsonb check (jsonb_typeof(readiness_verification) = 'object'),
  add column if not exists hiring_pipeline_stage public.hiring_pipeline_stage not null default 'new',
  add column if not exists hiring_closed_reason public.hiring_closed_reason,
  add column if not exists contact_priority integer not null default 0 check (contact_priority between 0 and 100),
  add column if not exists contact_priority_reasons text[] not null default '{}',
  add column if not exists next_action text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists next_interview_at timestamptz,
  add column if not exists outreach_review_status text not null default 'not_requested'
    check (outreach_review_status in ('not_requested','draft','review_pending','approved'));

update public.candidates
set
  current_country = coalesce(current_country, country),
  current_city = coalesce(current_city, city),
  hiring_pipeline_stage = case status
    when 'sourcing' then 'new'::public.hiring_pipeline_stage
    when 'screening' then 'shortlist'::public.hiring_pipeline_stage
    when 'trial' then 'shortlist'::public.hiring_pipeline_stage
    when 'on_hold' then 'shortlist'::public.hiring_pipeline_stage
    when 'interview' then 'interview'::public.hiring_pipeline_stage
    when 'offer' then 'offer'::public.hiring_pipeline_stage
    when 'hired' then 'closed'::public.hiring_pipeline_stage
    when 'rejected' then 'closed'::public.hiring_pipeline_stage
    else 'new'::public.hiring_pipeline_stage
  end,
  hiring_closed_reason = case status
    when 'hired' then 'hired'::public.hiring_closed_reason
    when 'rejected' then 'rejected_by_company'::public.hiring_closed_reason
    else hiring_closed_reason
  end
where current_country is null
   or current_city is distinct from city
   or hiring_pipeline_stage = 'new';

comment on column public.candidates.readiness_verification is
  'Per-field provenance. Values must be verified, self_declared, publicly_indicated, unknown, or needs_confirmation. Never store AI inference as fact.';

create index if not exists candidates_hiring_pipeline_idx
  on public.candidates (hiring_pipeline_stage, updated_at desc);
create index if not exists candidates_japan_readiness_idx
  on public.candidates (hiring_readiness_status, contact_priority desc);
create index if not exists candidates_last_contacted_idx
  on public.candidates (last_contacted_at desc nulls last);
create index if not exists candidates_next_interview_idx
  on public.candidates (next_interview_at) where next_interview_at is not null;

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ui_mode public.ui_mode not null default 'simple',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
create policy "users manage their own preferences"
  on public.user_preferences for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.user_preferences to authenticated;

create table public.candidate_interactions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  kind text not null check (kind in ('outreach','reply','interview','note','status_change')),
  channel text check (channel is null or channel in ('email','linkedin','phone','meeting','other')),
  summary text not null check (char_length(summary) between 1 and 4000),
  occurred_at timestamptz not null default now(),
  scheduled_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.candidate_interactions enable row level security;
create policy "workspace members read candidate interactions"
  on public.candidate_interactions for select to authenticated
  using ((select auth.uid()) is not null);
create policy "workspace members create candidate interactions"
  on public.candidate_interactions for insert to authenticated
  with check ((select auth.uid()) = created_by);
create policy "interaction authors update their records"
  on public.candidate_interactions for update to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);
create policy "interaction authors delete their records"
  on public.candidate_interactions for delete to authenticated
  using ((select auth.uid()) = created_by);
grant select, insert, update, delete on public.candidate_interactions to authenticated;

create index candidate_interactions_candidate_occurred_idx
  on public.candidate_interactions (candidate_id, occurred_at desc);
create index candidate_interactions_scheduled_idx
  on public.candidate_interactions (scheduled_at) where scheduled_at is not null;
