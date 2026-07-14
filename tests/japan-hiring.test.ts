import assert from "node:assert/strict";
import test from "node:test";
import { coverageSegment, getHiringSignals, mapLegacyStatus } from "../src/lib/candidates/japan-hiring";
import type { Candidate } from "../src/types/candidate";

function candidate(overrides: Partial<Candidate> = {}) {
  return {
    ai_score: 82,
    hiring_readiness_status: "A",
    hiring_readiness_confidence: 90,
    hiring_pipeline_stage: "shortlist",
    hiring_closed_reason: null,
    project_fit_tags: ["luxury retail"],
    last_contacted_at: null,
    next_action: null,
    current_country: "Japan",
    country: "Japan",
    japanese_level: "N1",
    interested_in_japan: true,
    willing_to_relocate_to_japan: false,
    willing_to_work_in_tokyo: true,
    remote_from_overseas: false,
    updated_at: "2026-07-14T00:00:00.000Z",
    ...overrides,
  } as Candidate;
}

test("Contact PriorityはCG Fit、Japan Readiness、確認度、案件適性、接触状況を説明可能に合成する", () => {
  const result = getHiringSignals(candidate());
  assert.equal(result.contactPriority, 92);
  assert.ok(result.reasons.includes("CG Fitが有力"));
  assert.ok(result.reasons.some((reason) => reason.startsWith("案件適性")));
  assert.equal(result.nextAction, "スカウト文面を作成");
});

test("Blockedは単一AI点数に関係なく自動見送りにせず優先度0と人間確認を返す", () => {
  const result = getHiringSignals(candidate({ hiring_readiness_status: "blocked" }));
  assert.equal(result.contactPriority, 0);
  assert.match(result.nextAction, /人が確認/);
  assert.match(result.conclusion, /人が条件変更/);
});

test("Data Coverageは確認済みの居住地と関心情報で分類する", () => {
  assert.equal(coverageSegment(candidate()), "japan_japanese");
  assert.equal(coverageSegment(candidate({ current_country: "France", japanese_level: null, interested_in_japan: true })), "relocation");
  assert.equal(coverageSegment(candidate({ current_country: "France", japanese_level: null, interested_in_japan: false, willing_to_work_in_tokyo: false, remote_from_overseas: true })), "overseas_remote");
});

test("新Pipelineから旧statusへの互換マッピングを維持する", () => {
  assert.equal(mapLegacyStatus("new"), "sourcing");
  assert.equal(mapLegacyStatus("contacted"), "screening");
  assert.equal(mapLegacyStatus("interview"), "interview");
  assert.equal(mapLegacyStatus("offer"), "offer");
});
