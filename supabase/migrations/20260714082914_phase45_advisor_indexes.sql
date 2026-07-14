create index acquisition_batch_items_duplicate_discovery_idx
  on public.acquisition_batch_items (duplicate_discovery_item_id)
  where duplicate_discovery_item_id is not null;
create index acquisition_batch_items_duplicate_candidate_idx
  on public.acquisition_batch_items (duplicate_candidate_id)
  where duplicate_candidate_id is not null;
create index candidate_portfolio_images_created_by_idx
  on public.candidate_portfolio_images (created_by);
create index candidates_ai_rubric_version_idx
  on public.candidates (ai_rubric_version_id)
  where ai_rubric_version_id is not null;
create index discovery_items_acquisition_batch_item_idx
  on public.discovery_items (acquisition_batch_item_id)
  where acquisition_batch_item_id is not null;
create index discovery_items_preliminary_rubric_idx
  on public.discovery_items (preliminary_ai_rubric_version_id)
  where preliminary_ai_rubric_version_id is not null;
create index evaluation_rubric_versions_published_by_idx
  on public.evaluation_rubric_versions (published_by)
  where published_by is not null;
create index evaluation_rubrics_created_by_idx
  on public.evaluation_rubrics (created_by)
  where created_by is not null;
create index human_candidate_reviews_reviewer_idx
  on public.human_candidate_reviews (reviewer_id, reviewed_at desc);
create index human_candidate_reviews_rubric_version_idx
  on public.human_candidate_reviews (rubric_version_id);
create index validation_checklist_runs_verified_by_idx
  on public.validation_checklist_runs (verified_by, verified_at desc);
