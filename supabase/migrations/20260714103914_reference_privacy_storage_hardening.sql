alter table public.visual_search_images
  add constraint visual_search_images_reference_privacy_check check (
    not privacy_mode or (
      storage_path is null and mime_type is null and size_bytes is null and width is null and height is null and sha256 is null
      and source_discarded_at is not null
      and processing_timestamp is not null
      and processing_model_version is not null
      and jsonb_array_length(ai_feature_vector) = 16
    )
  );

drop policy if exists "Users upload own visual references" on storage.objects;
drop policy if exists "Users read own visual references" on storage.objects;
drop policy if exists "Users update own visual references" on storage.objects;
drop policy if exists "Users delete own visual references" on storage.objects;

comment on column public.visual_search_images.storage_path is
  'Legacy compatibility only. Must be NULL for Reference Privacy Mode records.';
comment on column public.visual_search_images.source_discarded_at is
  'Timestamp when the in-memory source and normalized analysis buffers were discarded.';
