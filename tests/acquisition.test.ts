import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import {
  csvRowsToPreview,
  defaultColumnMapping,
  normalizeCandidateUrl,
  urlLinesToPreview,
} from "../src/lib/acquisition/import";
import { isPortfolioImageAiEligible } from "../src/lib/portfolio/eligibility";

test("URL一括登録は100件を受理し、101件を拒否する", () => {
  const hundred = Array.from({ length: 100 }, (_, index) => `https://portfolio-${index}.example.com/work`).join("\n");
  assert.equal(urlLinesToPreview(hundred).length, 100);
  assert.throws(() => urlLinesToPreview(`${hundred}\nhttps://overflow.example.com`), /100件/);
});

test("URL正規化は追跡パラメータを除去し、バッチ内重複を検出する", () => {
  const rows = urlLinesToPreview("https://Example.com/work/?utm_source=test\nhttps://example.com/work");
  assert.equal(rows[0].normalizedUrl, "https://example.com/work");
  assert.equal(rows[1].duplicate, true);
  assert.equal(rows[1].duplicateKind, "batch");
});

test("localhost、private IP、metadata endpointを拒否する", () => {
  for (const url of ["http://localhost/a", "http://127.0.0.1/a", "http://10.0.0.2/a", "http://169.254.169.254/latest/meta-data", "http://192.168.1.2/a", "http://[::1]/a"]) {
    assert.throws(() => normalizeCandidateUrl(url), /プライベート/);
  }
  assert.throws(() => normalizeCandidateUrl("file:///etc/passwd"), /公開http/);
});

test("CSVは列マッピングと引用符を処理し、連絡先列をraw dataへ取り込まない", () => {
  const csv = [
    "name,source_type,source_url,skills,notes_for_review,email",
    'Jane Artist,artstation,https://jane.artstation.com,"archviz;lighting","human review, needed",jane@example.com',
  ].join("\n");
  const headers = ["name", "source_type", "source_url", "skills", "notes_for_review", "email"];
  const mapping = defaultColumnMapping(headers);
  const rows = csvRowsToPreview(csv, mapping);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].data.skills, ["archviz", "lighting"]);
  assert.equal(rows[0].data.notes_for_review, "human review, needed");
  assert.equal(rows[0].rawInput.includes("jane@example.com"), false);
});

test("CSVはnameとsource_urlのマッピングを必須にする", () => {
  const csv = "name,portfolio_url\nArtist,https://example.com";
  assert.throws(() => csvRowsToPreview(csv, defaultColumnMapping(["name", "portfolio_url"])), /nameとsource_url/);
});

test("unknownとlink_only画像はAI対象外になる", () => {
  assert.equal(isPortfolioImageAiEligible({ storage_path: "u/c/image.webp", usage_status: "unknown", selected_for_ai_review: true }), false);
  assert.equal(isPortfolioImageAiEligible({ storage_path: null, usage_status: "review_copy_authorized", selected_for_ai_review: true }), false);
  assert.equal(isPortfolioImageAiEligible({ storage_path: "u/c/image.webp", usage_status: "review_copy_authorized", selected_for_ai_review: true }), true);
});

test("50名相当の取込プレビューは実用的な時間で完了する", () => {
  const input = Array.from({ length: 50 }, (_, index) => `https://artist-${index}.example.com/portfolio`).join("\n");
  const started = performance.now();
  const rows = urlLinesToPreview(input);
  const elapsed = performance.now() - started;
  assert.equal(rows.length, 50);
  assert.ok(elapsed < 500, `preview took ${elapsed.toFixed(1)}ms`);
});
