alter table public.visual_searches
  add column privacy_mode boolean not null default true check (privacy_mode),
  add column reference_processing_status text not null default 'pending'
    check (reference_processing_status in ('pending', 'processing', 'ready', 'failed')),
  add column reference_count smallint not null default 0 check (reference_count between 0 and 5);

alter table public.visual_search_images
  alter column storage_path drop not null,
  alter column mime_type drop not null,
  alter column size_bytes drop not null,
  alter column width drop not null,
  alter column height drop not null,
  alter column sha256 drop not null,
  add column image_index smallint check (image_index between 0 and 4),
  add column privacy_mode boolean not null default true check (privacy_mode),
  add column lighting_features jsonb not null default '[]'::jsonb check (jsonb_typeof(lighting_features) = 'array'),
  add column composition_features jsonb not null default '[]'::jsonb check (jsonb_typeof(composition_features) = 'array'),
  add column material_features jsonb not null default '[]'::jsonb check (jsonb_typeof(material_features) = 'array'),
  add column brand_tone jsonb not null default '[]'::jsonb check (jsonb_typeof(brand_tone) = 'array'),
  add column space_type jsonb not null default '[]'::jsonb check (jsonb_typeof(space_type) = 'array'),
  add column camera_characteristics jsonb not null default '{}'::jsonb check (jsonb_typeof(camera_characteristics) = 'object'),
  add column ai_feature_vector jsonb not null default '[]'::jsonb check (jsonb_typeof(ai_feature_vector) = 'array'),
  add column processing_timestamp timestamptz,
  add column processing_model_version text check (processing_model_version is null or char_length(processing_model_version) <= 120),
  add column source_discarded_at timestamptz,
  add column analysis_input_tokens integer not null default 0 check (analysis_input_tokens >= 0),
  add column analysis_output_tokens integer not null default 0 check (analysis_output_tokens >= 0);

create unique index visual_search_images_search_position_idx
  on public.visual_search_images (search_id, image_index)
  where image_index is not null;

comment on column public.visual_searches.privacy_mode is
  'Enterprise default. Reference images must never be persisted by the application.';
comment on table public.visual_search_images is
  'Derived visual feature records only in Reference Privacy Mode. Raw images, thumbnails, EXIF, URLs, and temporary file paths are prohibited.';
