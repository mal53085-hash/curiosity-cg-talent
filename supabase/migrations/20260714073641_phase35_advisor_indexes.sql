create index data_quality_snapshots_created_by_idx on public.data_quality_snapshots (created_by, created_at desc);
create index scout_test_runs_created_by_idx on public.scout_test_runs (created_by, executed_at desc);
