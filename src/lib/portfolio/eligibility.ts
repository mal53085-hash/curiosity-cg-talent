import type { PortfolioUsageStatus } from "@/types/portfolio";

export function isPortfolioImageAiEligible(image: {
  storage_path: string | null;
  usage_status: PortfolioUsageStatus;
  selected_for_ai_review: boolean;
}) {
  return Boolean(
    image.storage_path &&
    image.selected_for_ai_review &&
    ["review_copy_authorized", "internal_reference_authorized"].includes(image.usage_status),
  );
}
