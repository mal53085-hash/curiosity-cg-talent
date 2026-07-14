import { cn } from "@/lib/utils";
import { statusLabels, type CandidateStatus } from "@/types/candidate";

const colors: Record<CandidateStatus, string> = {
  sourcing: "bg-[#efeee9] text-[#62615b]",
  screening: "bg-[#ece9df] text-[#6e603b]",
  interview: "bg-[#e6ece9] text-[#3f6656]",
  trial: "bg-[#e8e9ef] text-[#505a78]",
  offer: "bg-[#eee6dc] text-[#765b39]",
  hired: "bg-[#dfeadf] text-[#38613f]",
  on_hold: "bg-[#ecebea] text-[#686664]",
  rejected: "bg-[#f0e5e3] text-[#874c47]",
};

interface StatusBadgeProps {
  status: CandidateStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
        colors[status],
        className,
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
