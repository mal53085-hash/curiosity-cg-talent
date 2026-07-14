import { createDiscoveryPortfolioImage } from "@/lib/portfolio/discovery-api";
export const runtime = "nodejs"; export const maxDuration = 60;
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { return createDiscoveryPortfolioImage(request, (await params).id); }
