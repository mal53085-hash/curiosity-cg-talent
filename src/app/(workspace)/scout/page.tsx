import { getScoutOverview } from "@/lib/scout/data";
import { ScoutWorkspace } from "@/components/scout-workspace";

export default async function ScoutPage() {
  const { searches, runs } = await getScoutOverview();
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-10 xl:px-10">
      <ScoutWorkspace initialSearches={searches} initialRuns={runs} />
    </div>
  );
}
