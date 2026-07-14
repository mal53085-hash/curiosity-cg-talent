import { visualFeaturesSchema, visualFeatureVectorSchema, type VisualFeatures, type VisualFeatureVector } from "@/types/visual-search";

const unique = (values: string[], max: number) => [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, max);
const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
const normalized = (value: number) => Number((value / 100).toFixed(4));

export function buildVisualFeatureVector(features: VisualFeatures): VisualFeatureVector {
  const time = { day: 0.2, dusk: 0.5, night: 0.8, mixed: 1, unknown: 0 }[features.time_of_day];
  const location = { exterior: 0.25, interior: 0.75, mixed: 1, unknown: 0 }[features.exterior_interior];
  return visualFeatureVectorSchema.parse([
    normalized(features.luxury_level), normalized(features.detail_density), normalized(features.photorealism),
    normalized(features.hospitality_fit), normalized(features.retail_fit), normalized(features.quiet_drama),
    time, location, Math.min(1, features.space_types.length / 8), Math.min(1, features.composition.length / 8),
    Math.min(1, features.camera_position.length / 6), Math.min(1, features.field_of_view.length / 6),
    Math.min(1, features.lighting.length / 8), Math.min(1, features.artificial_lighting.length / 8),
    Math.min(1, features.materials.length / 10), Math.min(1, features.brand_tones.length / 8),
  ]);
}

export function featureRecord(features: VisualFeatures) {
  return {
    visual_features: features,
    lighting_features: [...features.lighting, ...features.artificial_lighting],
    composition_features: features.composition,
    material_features: features.materials,
    brand_tone: features.brand_tones,
    space_type: features.space_types,
    camera_characteristics: { position: features.camera_position, field_of_view: features.field_of_view },
    ai_feature_vector: buildVisualFeatureVector(features),
  };
}

export function aggregateVisualFeatures(input: VisualFeatures[]): VisualFeatures {
  if (!input.length) throw new Error("VISUAL_FEATURES_MISSING");
  const mode = <T extends string>(values: T[], fallback: T) => {
    const counts = new Map<T, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
  };
  return visualFeaturesSchema.parse({
    space_types: unique(input.flatMap((item) => item.space_types), 8),
    composition: unique(input.flatMap((item) => item.composition), 8),
    camera_position: unique(input.flatMap((item) => item.camera_position), 6),
    field_of_view: unique(input.flatMap((item) => item.field_of_view), 6),
    lighting: unique(input.flatMap((item) => item.lighting), 8),
    time_of_day: mode(input.map((item) => item.time_of_day), "unknown"),
    artificial_lighting: unique(input.flatMap((item) => item.artificial_lighting), 8),
    color_tone: unique(input.flatMap((item) => item.color_tone), 8),
    contrast: unique(input.flatMap((item) => item.contrast), 6),
    materials: unique(input.flatMap((item) => item.materials), 10),
    luxury_level: average(input.map((item) => item.luxury_level)),
    brand_tones: unique(input.flatMap((item) => item.brand_tones), 8),
    detail_density: average(input.map((item) => item.detail_density)),
    photorealism: average(input.map((item) => item.photorealism)),
    hospitality_fit: average(input.map((item) => item.hospitality_fit)),
    retail_fit: average(input.map((item) => item.retail_fit)),
    exterior_interior: mode(input.map((item) => item.exterior_interior), "unknown"),
    quiet_drama: average(input.map((item) => item.quiet_drama)),
    summary: unique(input.map((item) => item.summary), 5).join(" / ").slice(0, 1000),
    uncertainties: unique(input.flatMap((item) => item.uncertainties), 8),
  });
}
