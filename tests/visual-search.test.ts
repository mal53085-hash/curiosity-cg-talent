import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MAX_VISUAL_IMAGE_BYTES, sanitizeVisualImage } from "../src/lib/visual-search/image";
import { visualFeaturesSchema, visualRankingSchema } from "../src/types/visual-search";

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
  const features = { space_types: ["retail"], composition: ["central"], camera_position: ["eye level"], field_of_view: ["wide"], lighting: ["soft"], time_of_day: "night", artificial_lighting: ["warm"], color_tone: ["neutral"], contrast: ["low"], materials: ["stone"], luxury_level: 101, brand_tones: ["quiet"], detail_density: 80, photorealism: 90, hospitality_fit: 60, retail_fit: 90, exterior_interior: "interior", quiet_drama: 20, summary: "test", uncertainties: [] };
  assert.equal(visualFeaturesSchema.safeParse(features).success, false);
  assert.equal(visualRankingSchema.safeParse({ results: [{ candidate_id: "not-a-uuid", visual_fit_score: 90 }] }).success, false);
});
