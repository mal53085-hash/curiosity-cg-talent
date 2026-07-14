alter type public.discovery_source_type add value if not exists 'cgarchitect';
alter type public.discovery_source_type add value if not exists 'company';

create type public.acquisition_batch_type as enum ('url', 'csv', 'manual');
create type public.acquisition_batch_status as enum ('preview', 'confirmed', 'completed', 'partial', 'failed');
create type public.discovery_research_status as enum (
  'new',
  'reviewing',
  'needs_more_info',
  'ready_for_ai_review',
  'ready_for_approval',
  'approved',
  'rejected',
  'duplicate'
);
create type public.portfolio_image_usage_status as enum (
  'link_only',
  'review_copy_authorized',
  'internal_reference_authorized',
  'unknown'
);
create type public.validation_result_status as enum ('not_run', 'passed', 'failed', 'recheck');

create table public.acquisition_batches (
  id uuid primary key default gen_random_uuid(),
  batch_type public.acquisition_batch_type not null,
  status public.acquisition_batch_status not null default 'preview',
  filename text check (filename is null or char_length(filename) <= 255),
  total_count integer not null default 0 check (total_count between 0 and 100),
  supported_count integer not null default 0 check (supported_count between 0 and 100),
  unsupported_count integer not null default 0 check (unsupported_count between 0 and 100),
  duplicate_count integer not null default 0 check (duplicate_count between 0 and 100),
  created_count integer not null default 0 check (created_count between 0 and 100),
  error_count integer not null default 0 check (error_count between 0 and 100),
  column_mapping jsonb not null default '{}'::jsonb check (jsonb_typeof(column_mapping) = 'object'),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz
);

create table public.acquisition_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.acquisition_batches(id) on delete cascade,
  row_number smallint not null check (row_number between 1 and 100),
  raw_input text not null check (char_length(raw_input) between 1 and 10000),
  normalized_url text check (normalized_url is null or char_length(normalized_url) between 8 and 2048),
  source_type public.discovery_source_type,
  supported boolean not null default false,
  is_duplicate boolean not null default false,
  duplicate_discovery_item_id uuid references public.discovery_items(id) on delete set null,
  duplicate_candidate_id uuid references public.candidates(id) on delete set null,
  parsed_data jsonb not null default '{}'::jsonb check (jsonb_typeof(parsed_data) = 'object'),
  validation_errors text[] not null default '{}',
  discovery_item_id uuid references public.discovery_items(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

alter table public.discovery_items
  add column portfolio_url text check (portfolio_url is null or char_length(portfolio_url) <= 2048),
  add column research_status public.discovery_research_status not null default 'new',
  add column assigned_to uuid references auth.users(id) on delete set null,
  add column last_verified_at timestamptz,
  add column notes_for_review text check (notes_for_review is null or char_length(notes_for_review) <= 5000),
  add column research_quality_score smallint not null default 0 check (research_quality_score between 0 and 100),
  add column next_required_fields text[] not null default '{}',
  add column acquisition_batch_item_id uuid references public.acquisition_batch_items(id) on delete set null,
  add column preliminary_ai_rubric_version_id uuid;

alter table public.acquisition_batch_items
  add constraint acquisition_batch_items_discovery_item_unique unique (discovery_item_id);

create table public.candidate_portfolio_images (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  discovery_item_id uuid references public.discovery_items(id) on delete cascade,
  storage_path text unique check (storage_path is null or char_length(storage_path) <= 1024),
  external_url text check (external_url is null or char_length(external_url) <= 2048),
  source_url text check (source_url is null or char_length(source_url) <= 2048),
  source_page_url text check (source_page_url is null or char_length(source_page_url) <= 2048),
  captured_at timestamptz not null default now(),
  usage_status public.portfolio_image_usage_status not null default 'unknown',
  rights_note text check (rights_note is null or char_length(rights_note) <= 2000),
  selected_for_ai_review boolean not null default false,
  image_order smallint not null default 1 check (image_order between 1 and 12),
  content_type text check (content_type is null or content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer check (byte_size is null or byte_size between 1 and 8388608),
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_portfolio_images_parent_check check (num_nonnulls(candidate_id, discovery_item_id) = 1),
  constraint candidate_portfolio_images_location_check check (num_nonnulls(storage_path, external_url) >= 1)
);

create table public.evaluation_rubrics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  description text check (description is null or char_length(description) <= 3000),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name)
);

create table public.evaluation_rubric_versions (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.evaluation_rubrics(id) on delete cascade,
  version integer not null check (version > 0),
  axes jsonb not null check (jsonb_typeof(axes) = 'array' and jsonb_array_length(axes) = 12),
  change_note text check (change_note is null or char_length(change_note) <= 2000),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  unique (rubric_id, version)
);

alter table public.discovery_items
  add constraint discovery_items_preliminary_rubric_fkey
  foreign key (preliminary_ai_rubric_version_id) references public.evaluation_rubric_versions(id) on delete set null;

alter table public.candidates
  add column ai_rubric_version_id uuid references public.evaluation_rubric_versions(id) on delete set null;

create table public.human_candidate_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  sample_reasons text[] not null default '{}',
  ai_evaluation jsonb not null default '{}'::jsonb check (jsonb_typeof(ai_evaluation) = 'object'),
  human_scores jsonb not null check (jsonb_typeof(human_scores) = 'object'),
  score_difference numeric(6,2) not null check (score_difference between 0 and 100),
  comments text check (comments is null or char_length(comments) <= 5000),
  reviewer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  rubric_version_id uuid not null references public.evaluation_rubric_versions(id),
  created_at timestamptz not null default now()
);

create table public.validation_checklists (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  label text not null check (char_length(label) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  sort_order smallint not null check (sort_order > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.validation_checklist_runs (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.validation_checklists(id) on delete cascade,
  status public.validation_result_status not null default 'not_run',
  evidence_note text check (evidence_note is null or char_length(evidence_note) <= 5000),
  verified_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index acquisition_batches_created_idx on public.acquisition_batches (created_by, created_at desc);
create index acquisition_batch_items_batch_idx on public.acquisition_batch_items (batch_id, row_number);
create index acquisition_batch_items_url_idx on public.acquisition_batch_items (lower(normalized_url)) where normalized_url is not null;
create index discovery_items_research_queue_idx on public.discovery_items (research_status, last_verified_at nulls first, discovered_at desc);
create index discovery_items_assignee_idx on public.discovery_items (assigned_to, research_status) where assigned_to is not null;
create index candidate_portfolio_images_candidate_idx on public.candidate_portfolio_images (candidate_id, image_order) where candidate_id is not null;
create index candidate_portfolio_images_discovery_idx on public.candidate_portfolio_images (discovery_item_id, image_order) where discovery_item_id is not null;
create unique index candidate_portfolio_images_candidate_order_unique_idx on public.candidate_portfolio_images (candidate_id, image_order) where candidate_id is not null;
create unique index candidate_portfolio_images_discovery_order_unique_idx on public.candidate_portfolio_images (discovery_item_id, image_order) where discovery_item_id is not null;
create index candidate_portfolio_images_ai_idx on public.candidate_portfolio_images (candidate_id, selected_for_ai_review, usage_status) where candidate_id is not null;
create index rubric_versions_latest_idx on public.evaluation_rubric_versions (rubric_id, version desc);
create index human_reviews_candidate_idx on public.human_candidate_reviews (candidate_id, reviewed_at desc);
create index validation_runs_checklist_idx on public.validation_checklist_runs (checklist_id, verified_at desc);

create or replace function public.set_research_quality()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  calculated integer := 0;
  missing text[] := '{}';
begin
  if length(trim(new.author_name)) > 0 then calculated := calculated + 15; else missing := array_append(missing, '公開名'); end if;
  if coalesce(length(trim(new.source_url)), 0) > 0 then calculated := calculated + 15; else missing := array_append(missing, 'ソースURL'); end if;
  if coalesce(length(trim(new.portfolio_url)), 0) > 0 then calculated := calculated + 10; else missing := array_append(missing, 'ポートフォリオURL'); end if;
  if coalesce(length(trim(new.description)), 0) > 0 then calculated := calculated + 15; else missing := array_append(missing, '公開プロフィール'); end if;
  if coalesce(length(trim(new.country)), 0) > 0 then calculated := calculated + 10; else missing := array_append(missing, '地域'); end if;
  if cardinality(new.skills) > 0 then calculated := calculated + 10; else missing := array_append(missing, 'スキル'); end if;
  if cardinality(new.software) > 0 then calculated := calculated + 10; else missing := array_append(missing, '使用ソフト'); end if;
  if cardinality(new.languages) > 0 then calculated := calculated + 5; else missing := array_append(missing, '言語'); end if;
  if cardinality(new.employment_types) > 0 then calculated := calculated + 5; else missing := array_append(missing, '契約形態'); end if;
  if cardinality(new.work_location_preferences) > 0 then calculated := calculated + 5; else missing := array_append(missing, '勤務地希望'); end if;
  new.research_quality_score := calculated;
  new.next_required_fields := missing;
  return new;
end;
$$;

create trigger discovery_items_set_research_quality
before insert or update on public.discovery_items
for each row execute function public.set_research_quality();

update public.discovery_items set updated_at = updated_at;

create or replace function public.sync_candidate_portfolio_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare target_id uuid;
begin
  target_id := coalesce(new.candidate_id, old.candidate_id);
  if target_id is not null then
    update public.candidates
      set work_image_count = (select count(*) from public.candidate_portfolio_images where candidate_id = target_id)
      where id = target_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger candidate_portfolio_images_sync_count
after insert or update or delete on public.candidate_portfolio_images
for each row execute function public.sync_candidate_portfolio_count();

create or replace view public.candidate_ai_review_eligibility
with (security_invoker = true)
as
select
  c.id as candidate_id,
  (
    coalesce(length(trim(c.public_profile)), 0) > 0
    and c.data_quality_score >= 60
    and c.status <> 'rejected'
    and exists (
      select 1 from public.candidate_portfolio_images image
      where image.candidate_id = c.id
        and image.selected_for_ai_review
        and image.usage_status in ('review_copy_authorized', 'internal_reference_authorized')
        and image.storage_path is not null
    )
  ) as eligible,
  array_remove(array[
    case when coalesce(length(trim(c.public_profile)), 0) = 0 then '公開プロフィールがありません' end,
    case when c.data_quality_score < 60 then 'データ品質スコアが60未満です' end,
    case when c.status = 'rejected' then '見送り候補です' end,
    case when not exists (
      select 1 from public.candidate_portfolio_images image
      where image.candidate_id = c.id
        and image.selected_for_ai_review
        and image.usage_status in ('review_copy_authorized', 'internal_reference_authorized')
        and image.storage_path is not null
    ) then 'AI利用許可済みの選択画像がありません' end
  ], null)::text[] as reasons
from public.candidates c;

insert into public.evaluation_rubrics (id, name, description)
values ('00000000-0000-4000-8000-000000000045', 'Curiosity CG Talent Rubric', '建築・インテリアCG人材を、人間の判断を補助する目的で評価する基準。')
on conflict (name) do nothing;

insert into public.evaluation_rubric_versions (rubric_id, version, axes, change_note)
values (
  '00000000-0000-4000-8000-000000000045',
  1,
  '[
    {"key":"composition","label":"構図","description":"視線誘導、バランス、空間の読みやすさ","good_example":"意図のある焦点と奥行き","concern_example":"偶然的なクロップや弱い視線誘導","weight":10,"required":true},
    {"key":"lighting","label":"ライティング","description":"自然光と人工光の階調、空気感","good_example":"光源の整合性と豊かな階調","concern_example":"白飛び、黒つぶれ、根拠のない光","weight":10,"required":true},
    {"key":"materials","label":"マテリアル","description":"素材固有の反射、粗さ、質感","good_example":"素材差が光学的に伝わる","concern_example":"均一でプラスチック的な質感","weight":10,"required":true},
    {"key":"luxury_brand_fit","label":"高級ブランド適性","description":"静けさ、品位、精度を伴うブランド表現","good_example":"過剰演出に頼らない上質さ","concern_example":"派手さだけに依存した表現","weight":10,"required":true},
    {"key":"interior_understanding","label":"インテリア理解","description":"空間構成、家具、仕上げ、動線の理解","good_example":"設計意図とスケール感が明確","concern_example":"家具寸法や納まりの不整合","weight":10,"required":true},
    {"key":"detail","label":"ディテール","description":"納まり、小物、エッジ、接合部の精度","good_example":"近景でも破綻しない納まり","concern_example":"反復、浮き、交差などの破綻","weight":8,"required":true},
    {"key":"finish","label":"仕上げ","description":"最終画としての一貫性と完成度","good_example":"色、ノイズ、レタッチが統合されている","concern_example":"未調整要素や過度な後処理","weight":8,"required":true},
    {"key":"technical_adaptability","label":"技術適応力","description":"ツール、制作工程、修正への適応可能性","good_example":"複数手法を目的に応じて選択","concern_example":"単一表現への強い依存","weight":7,"required":false},
    {"key":"hospitality_fit","label":"ホテル適性","description":"滞在体験、雰囲気、照明計画の表現","good_example":"時間帯と体験が伝わる空間表現","concern_example":"用途固有の雰囲気が弱い","weight":7,"required":false},
    {"key":"retail_fit","label":"リテール適性","description":"商品、ブランド、顧客動線の表現","good_example":"商品と空間の主従が明確","concern_example":"ブランド文脈が読み取れない","weight":7,"required":false},
    {"key":"artificial_lighting","label":"人工照明表現","description":"器具、間接光、色温度、反射の制御","good_example":"複数光源が自然に統合されている","concern_example":"発光体と照明効果が不一致","weight":7,"required":false},
    {"key":"design_understanding","label":"デザイン理解","description":"設計思想、素材選択、ブランド文脈の理解","good_example":"意図を読み取り可視化へ翻訳","concern_example":"見た目の模倣に留まる","weight":6,"required":false}
  ]'::jsonb,
  'Phase 4.5 initial calibration rubric'
)
on conflict (rubric_id, version) do nothing;

insert into public.validation_checklists (code, label, sort_order) values
  ('authenticated_image_upload', '認証済み画像アップロード', 10),
  ('real_image_visual_search', '実画像Visual Search', 20),
  ('scout_compare_three', 'AI Scout 3名比較', 30),
  ('visual_compare_three', 'Visual Search 3名以上比較', 40),
  ('rate_limit_429', '429レート制限', 50),
  ('openai_503', 'OpenAI 503処理', 60),
  ('storage_expiry_cron', 'Storage期限切れ削除Cron', 70),
  ('storage_cascade_delete', '削除時のStorage連動削除', 80),
  ('audit_log', '監査ログ', 90),
  ('vercel_secret_log', 'Vercel秘密情報ログ確認', 100),
  ('mobile_390', '390pxモバイル表示', 110),
  ('csv_error', 'CSVエラー処理', 120),
  ('url_bulk', 'URL一括登録', 130),
  ('duplicate_processing', '重複処理', 140)
on conflict (code) do update set label = excluded.label, sort_order = excluded.sort_order;

alter table public.acquisition_batches enable row level security;
alter table public.acquisition_batch_items enable row level security;
alter table public.candidate_portfolio_images enable row level security;
alter table public.evaluation_rubrics enable row level security;
alter table public.evaluation_rubric_versions enable row level security;
alter table public.human_candidate_reviews enable row level security;
alter table public.validation_checklists enable row level security;
alter table public.validation_checklist_runs enable row level security;

create policy "Workspace members manage acquisition batches" on public.acquisition_batches for all to authenticated
  using ((select auth.uid()) is not null) with check (created_by = (select auth.uid()));
create policy "Workspace members manage acquisition items" on public.acquisition_batch_items for all to authenticated
  using ((select auth.uid()) is not null)
  with check (exists (select 1 from public.acquisition_batches b where b.id = batch_id and b.created_by = (select auth.uid())));
create policy "Workspace members read portfolio images" on public.candidate_portfolio_images for select to authenticated
  using ((select auth.uid()) is not null);
create policy "Workspace members create portfolio images" on public.candidate_portfolio_images for insert to authenticated
  with check ((select auth.uid()) is not null and created_by = (select auth.uid()));
create policy "Workspace members update portfolio images" on public.candidate_portfolio_images for update to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "Workspace members delete portfolio images" on public.candidate_portfolio_images for delete to authenticated
  using ((select auth.uid()) is not null);
create policy "Workspace members read rubrics" on public.evaluation_rubrics for select to authenticated using ((select auth.uid()) is not null);
create policy "Workspace members create rubrics" on public.evaluation_rubrics for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Workspace members update rubrics" on public.evaluation_rubrics for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "Workspace members read rubric versions" on public.evaluation_rubric_versions for select to authenticated using ((select auth.uid()) is not null);
create policy "Workspace members publish rubric versions" on public.evaluation_rubric_versions for insert to authenticated with check (published_by = (select auth.uid()));
create policy "Workspace members manage human reviews" on public.human_candidate_reviews for all to authenticated
  using ((select auth.uid()) is not null) with check (reviewer_id = (select auth.uid()));
create policy "Workspace members read validation definitions" on public.validation_checklists for select to authenticated using ((select auth.uid()) is not null);
create policy "Workspace members manage validation runs" on public.validation_checklist_runs for all to authenticated
  using ((select auth.uid()) is not null) with check (verified_by = (select auth.uid()));

grant select, insert, update, delete on public.acquisition_batches to authenticated;
grant select, insert, update, delete on public.acquisition_batch_items to authenticated;
grant select, insert, update, delete on public.candidate_portfolio_images to authenticated;
grant select, insert, update on public.evaluation_rubrics to authenticated;
grant select, insert on public.evaluation_rubric_versions to authenticated;
grant select, insert, update, delete on public.human_candidate_reviews to authenticated;
grant select on public.validation_checklists to authenticated;
grant select, insert, update, delete on public.validation_checklist_runs to authenticated;
grant select on public.candidate_ai_review_eligibility to authenticated;

revoke all on public.acquisition_batches from anon;
revoke all on public.acquisition_batch_items from anon;
revoke all on public.candidate_portfolio_images from anon;
revoke all on public.evaluation_rubrics from anon;
revoke all on public.evaluation_rubric_versions from anon;
revoke all on public.human_candidate_reviews from anon;
revoke all on public.validation_checklists from anon;
revoke all on public.validation_checklist_runs from anon;
revoke all on public.candidate_ai_review_eligibility from anon;
revoke all on function public.set_research_quality() from public, anon, authenticated;
revoke all on function public.sync_candidate_portfolio_count() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidate-portfolio-images', 'candidate-portfolio-images', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload own candidate portfolio images" on storage.objects for insert to authenticated
  with check (bucket_id = 'candidate-portfolio-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Workspace members read candidate portfolio images" on storage.objects for select to authenticated
  using (bucket_id = 'candidate-portfolio-images' and (select auth.uid()) is not null);
create policy "Users update own candidate portfolio images" on storage.objects for update to authenticated
  using (bucket_id = 'candidate-portfolio-images' and owner_id = (select auth.uid()::text))
  with check (bucket_id = 'candidate-portfolio-images' and owner_id = (select auth.uid()::text));
create policy "Workspace members delete candidate portfolio images" on storage.objects for delete to authenticated
  using (bucket_id = 'candidate-portfolio-images' and (select auth.uid()) is not null);
