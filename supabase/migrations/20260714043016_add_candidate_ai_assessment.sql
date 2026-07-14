alter table public.candidates
  add column ai_scores jsonb not null default '{}'::jsonb,
  add column ai_reasoning text,
  add column ai_recommended_projects text[] not null default '{}',
  add column ai_interview_questions text[] not null default '{}',
  add column ai_model text,
  add column ai_evaluated_at timestamptz;

alter table public.candidates
  add constraint candidates_ai_scores_object_check
  check (jsonb_typeof(ai_scores) = 'object'),
  add constraint candidates_ai_scores_values_check
  check (
    not (ai_scores ?| array[
      'composition',
      'lighting',
      'materials',
      'luxury_brand_fit',
      'interior_understanding',
      'detail',
      'finish',
      'technical_adaptability'
    ])
    or (
      jsonb_typeof(ai_scores -> 'composition') = 'number'
      and (ai_scores ->> 'composition')::numeric between 0 and 100
      and jsonb_typeof(ai_scores -> 'lighting') = 'number'
      and (ai_scores ->> 'lighting')::numeric between 0 and 100
      and jsonb_typeof(ai_scores -> 'materials') = 'number'
      and (ai_scores ->> 'materials')::numeric between 0 and 100
      and jsonb_typeof(ai_scores -> 'luxury_brand_fit') = 'number'
      and (ai_scores ->> 'luxury_brand_fit')::numeric between 0 and 100
      and jsonb_typeof(ai_scores -> 'interior_understanding') = 'number'
      and (ai_scores ->> 'interior_understanding')::numeric between 0 and 100
      and jsonb_typeof(ai_scores -> 'detail') = 'number'
      and (ai_scores ->> 'detail')::numeric between 0 and 100
      and jsonb_typeof(ai_scores -> 'finish') = 'number'
      and (ai_scores ->> 'finish')::numeric between 0 and 100
      and jsonb_typeof(ai_scores -> 'technical_adaptability') = 'number'
      and (ai_scores ->> 'technical_adaptability')::numeric between 0 and 100
    )
  );

comment on column public.candidates.ai_scores is
  'OpenAI-generated work-sample scores. Hiring decisions remain human-owned.';
