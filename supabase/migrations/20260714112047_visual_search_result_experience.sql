alter table public.visual_search_results
  add column brand_dna_match smallint check (brand_dna_match between 0 and 100),
  add column lighting_match smallint check (lighting_match between 0 and 100),
  add column composition_match smallint check (composition_match between 0 and 100),
  add column material_match smallint check (material_match between 0 and 100),
  add column luxury_brand_fit smallint check (luxury_brand_fit between 0 and 100),
  add column display_design smallint check (display_design between 0 and 100),
  add column color_control smallint check (color_control between 0 and 100),
  add column visual_silence smallint check (visual_silence between 0 and 100);

comment on column public.visual_search_results.brand_dna_match is 'Reference-relative brand tone alignment; not an employment decision score.';
comment on column public.visual_search_results.visual_silence is 'Reference-relative restraint and visual calm alignment; not an employment decision score.';
