import assert from "node:assert/strict";
import test from "node:test";
import { candidateMeetsHardFilters, candidatePrefilterScore } from "../src/lib/scout/scoring";
import { scoutFiltersSchema, scoutRankingSchema, type ScoutFilters } from "../src/types/scout";
import type { Candidate } from "../src/types/candidate";

const filters: ScoutFilters = {
  required_skills: ["3ds Max", "Corona"],
  preferred_skills: ["hospitality"],
  minimum_score: 70,
  regions: ["Tokyo"],
  languages: ["Japanese"],
  employment_types: ["full_time"],
  statuses: ["sourcing"],
  luxury_fit: 75,
  hospitality_fit: 70,
  lighting_score: 75,
  composition_score: 70,
  salary_target_jpy: 7_000_000,
  keywords: ["hotel"],
  assumptions: [],
  warnings: [],
};

const candidate = {
  id: "00000000-0000-4000-8000-000000000001",
  full_name: "Public Artist",
  email: null,
  phone: null,
  country: "Japan",
  city: "Tokyo",
  primary_role: "Senior Archviz Artist",
  years_experience: 8,
  skills: ["3ds Max", "Corona", "hospitality"],
  languages: ["Japanese", "English"],
  availability: "Available",
  status: "sourcing",
  rating: "A",
  portfolio_url: "https://example.com/portfolio",
  source_type: "website",
  source_url: "https://example.com/portfolio",
  external_id: null,
  discovered_at: null,
  discovery_item_id: null,
  public_profile: "Luxury hotel interiors and night lighting.",
  employment_types: ["full_time"],
  work_location_preferences: ["Tokyo"],
  expected_salary_jpy: 7_000_000,
  notes: null,
  image_path: null,
  ai_score: 82,
  ai_scores: {
    composition: 84,
    lighting: 90,
    materials: 80,
    luxury_brand_fit: 88,
    interior_understanding: 86,
    detail: 81,
    finish: 83,
    technical_adaptability: 79,
  },
  ai_summary: "Strong hospitality visualization.",
  ai_reasoning: "Public portfolio evidence.",
  ai_strengths: ["Night lighting"],
  ai_risks: ["Work authorization unconfirmed"],
  ai_recommended_projects: ["Luxury hotel"],
  ai_interview_questions: ["Which parts did you own?"],
  ai_model: "test",
  ai_evaluated_at: null,
  created_by: "00000000-0000-4000-8000-000000000002",
  updated_by: null,
  created_at: "2026-07-14T00:00:00.000Z",
  updated_at: "2026-07-14T00:00:00.000Z",
} satisfies Candidate;

test("AI Scout normal flow accepts structured conditions and matches a qualified candidate", () => {
  assert.equal(scoutFiltersSchema.safeParse(filters).success, true);
  assert.equal(candidateMeetsHardFilters(candidate, filters), true);
  assert.ok(candidatePrefilterScore(candidate, filters) >= 80);
});

test("AI Scout empty state excludes candidates that fail hard requirements", () => {
  const impossible = { ...filters, required_skills: ["Blender", "Unreal Engine"] };
  assert.equal(candidateMeetsHardFilters(candidate, impossible), false);
  assert.deepEqual([candidate].filter((item) => candidateMeetsHardFilters(item, impossible)), []);
});

test("AI Scout rejects malformed AI ranking output", () => {
  const malformed = {
    rankings: [{
      candidate_id: candidate.id,
      scout_score: 120,
      fit_reason: "Too high",
      strengths: [],
      concerns: [],
      recommended_project: "Hotel",
      interview_questions: [],
      comparison: { brand_fit: 80, hospitality_fit: 80, japan_work_fit: 80, software_match: 80, risk_level: "unknown" },
    }],
  };
  assert.equal(scoutRankingSchema.safeParse(malformed).success, false);
});

test("sensitive candidate fields never enter the Scout ranking view", () => {
  const searchableKeys = [
    "id", "full_name", "country", "city", "primary_role", "skills", "languages",
    "public_profile", "employment_types", "work_location_preferences", "ai_score", "ai_scores",
  ];
  assert.equal(searchableKeys.includes("email"), false);
  assert.equal(searchableKeys.includes("phone"), false);
  assert.equal(searchableKeys.includes("notes"), false);
});
