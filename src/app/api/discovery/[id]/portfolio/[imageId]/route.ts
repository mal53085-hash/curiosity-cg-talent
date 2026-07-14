import { deleteDiscoveryPortfolioImage, updateDiscoveryPortfolioImage } from "@/lib/portfolio/discovery-api";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) { const { id, imageId } = await params; return updateDiscoveryPortfolioImage(request, id, imageId); }
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) { const { id, imageId } = await params; return deleteDiscoveryPortfolioImage(request, id, imageId); }
