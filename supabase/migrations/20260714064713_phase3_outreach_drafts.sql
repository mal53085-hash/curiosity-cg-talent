alter table public.scout_results
  add column outreach_drafts jsonb
    check (outreach_drafts is null or jsonb_typeof(outreach_drafts) = 'object'),
  add column outreach_generated_at timestamptz;

create index scout_results_outreach_generated_idx
  on public.scout_results (outreach_generated_at desc)
  where outreach_generated_at is not null;

create policy "Users can update own scout results"
on public.scout_results for update
to authenticated
using (
  exists (
    select 1 from public.scout_runs
    where scout_runs.id = scout_results.run_id
      and scout_runs.created_by = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.scout_runs
    where scout_runs.id = scout_results.run_id
      and scout_runs.created_by = (select auth.uid())
  )
);

grant update on table public.scout_results to authenticated;

comment on column public.scout_results.outreach_drafts is
  'Cached copy-only drafts generated from public professional data. No sending capability.';
