import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MAX_VISUAL_IMAGE_BYTES, sanitizeVisualImage } from "../src/lib/visual-search/image";
import { aggregateVisualFeatures, buildVisualFeatureVector, featureRecord } from "../src/lib/visual-search/features";
import { resolveVisualResultScores } from "../src/lib/visual-search/result-scores";
import { buildEvaluationWeights, buildReferenceAnalysis } from "../src/lib/visual-search/reference-analysis";
import { visualFeaturesSchema, visualRankingSchema } from "../src/types/visual-search";

const validFeatures = { space_types: ["retail"], composition: ["central"], camera_position: ["eye level"], field_of_view: ["wide"], lighting: ["soft"], time_of_day: "night" as const, artificial_lighting: ["warm"], color_tone: ["neutral"], contrast: ["low"], materials: ["stone"], luxury_level: 90, brand_tones: ["quiet"], detail_density: 80, photorealism: 90, hospitality_fit: 60, retail_fit: 90, exterior_interior: "interior" as const, quiet_drama: 20, summary: "test", uncertainties: [] };

test("valid PNG is decoded and re-encoded as metadata-free WebP", async () => {
  const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#eeeae0" } }).png().withMetadata({ density: 300 }).toBuffer();
  const result = await sanitizeVisualImage(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength));
  assert.equal(result.mime, "image/webp"); assert.equal(result.width, 16); assert.equal((await sharp(result.buffer).metadata()).format, "webp");
});

test("SVG and spoofed files are rejected by magic-byte validation", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
  await assert.rejects(() => sanitizeVisualImage(svg.buffer.slice(svg.byteOffset, svg.byteOffset + svg.byteLength)), /IMAGE_FORMAT_INVALID/);
});

test("files larger than 8MB are rejected before decode", async () => {
  const oversized = Buffer.alloc(MAX_VISUAL_IMAGE_BYTES + 1); oversized[0] = 0xff; oversized[1] = 0xd8; oversized[2] = 0xff;
  await assert.rejects(() => sanitizeVisualImage(oversized.buffer), /IMAGE_SIZE_INVALID/);
});

test("AI schemas reject out-of-range scores and unknown structures", () => {
  const features = { ...validFeatures, luxury_level: 101 };
  assert.equal(visualFeaturesSchema.safeParse(features).success, false);
  assert.equal(visualRankingSchema.safeParse({ results: [{ candidate_id: "not-a-uuid", visual_fit_score: 90 }] }).success, false);
});

test("privacy feature records contain the required derived representations only", () => {
  const record = featureRecord(validFeatures);
  assert.equal(record.ai_feature_vector.length, 16);
  assert.deepEqual(record.lighting_features, ["soft", "warm"]);
  assert.equal("storage_path" in record, false);
  assert.equal("thumbnail" in record, false);
  assert.equal("exif" in record, false);
  assert.equal("public_url" in record, false);
});

test("multiple reference feature sets aggregate without source images", () => {
  const second = { ...validFeatures, composition: ["asymmetric"], luxury_level: 70, time_of_day: "dusk" as const };
  const aggregate = aggregateVisualFeatures([validFeatures, second]);
  assert.equal(aggregate.luxury_level, 80);
  assert.deepEqual(aggregate.composition, ["central", "asymmetric"]);
  assert.equal(buildVisualFeatureVector(aggregate).length, 16);
});

test("new visual ranking output requires all eight explainable fit dimensions", () => {
  const result = { candidate_id: "7ad1aacc-6152-4d17-8ea9-04f454d649ef", visual_fit_score: 88, brand_dna_match: 90, lighting_match: 87, composition_match: 91, material_match: 83, luxury_brand_fit: 92, display_design: 86, color_control: 84, visual_silence: 89, similar_features: ["静かなトーン"], different_features: [], strengths: [], risks: [], recommended_scope: "高級店舗", interview_questions: ["担当範囲を確認"] };
  assert.equal(visualRankingSchema.safeParse({ results: [result] }).success, true);
  assert.equal(visualRankingSchema.safeParse({ results: [{ ...result, visual_silence: undefined }] }).success, false);
});

test("legacy saved results receive deterministic display fallbacks", () => {
  const scores = resolveVisualResultScores({ visual_fit_score: 80 }, { lighting: 90, composition: 70, materials: 75, luxury_brand_fit: 85, retail_fit: 88, finish: 78 });
  assert.deepEqual(scores, { visual_fit_score: 80, brand_dna_match: 83, lighting: 90, composition: 70, material: 75, luxury_brand_fit: 85, display_design: 88, color_control: 78, visual_silence: 82 });
});

test("reference analysis maps only stored structured features to explainable metrics", () => {
  const analysis = buildReferenceAnalysis([validFeatures]);
  assert.equal(analysis.metrics.length, 12);
  assert.equal(analysis.metrics.find((metric) => metric.key === "luxury_brand_fit")?.value, 90);
  assert.equal(analysis.metrics.find((metric) => metric.key === "visual_silence")?.value, 80);
  assert.match(analysis.metrics.find((metric) => metric.key === "lighting_design")?.basis ?? "", /カバレッジ/);
  assert.equal("image" in analysis.aggregate, false);
});

test("style profile weights only increase explicitly prioritized dimensions", () => {
  const weights = buildEvaluationWeights(["Lighting", "Visual Silence"]);
  assert.equal(weights.lighting, 1.5);
  assert.equal(weights.visual_silence, 1.5);
  assert.equal(weights.composition, 1);
});
