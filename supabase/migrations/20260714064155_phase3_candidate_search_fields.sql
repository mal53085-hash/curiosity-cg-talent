alter table public.candidates
  add column public_profile text,
  add column employment_types text[] not null default '{}',
  add column work_location_preferences text[] not null default '{}',
  add column expected_salary_jpy integer
    check (expected_salary_jpy is null or expected_salary_jpy between 0 and 100000000);

create index candidates_employment_types_gin_idx
  on public.candidates using gin (employment_types);
create index candidates_work_location_preferences_gin_idx
  on public.candidates using gin (work_location_preferences);
create index candidates_expected_salary_idx
  on public.candidates (expected_salary_jpy)
  where expected_salary_jpy is not null;

comment on column public.candidates.public_profile is
  'Public professional profile only. Internal notes and contact details must not be copied here.';
comment on column public.candidates.employment_types is
  'Confirmed or candidate-stated employment preferences such as full_time, contract, freelance.';
comment on column public.candidates.work_location_preferences is
  'Confirmed or candidate-stated location preferences. Do not infer legal work authorization.';
comment on column public.candidates.expected_salary_jpy is
  'Optional candidate-stated annual expectation in JPY; absence means unknown.';
