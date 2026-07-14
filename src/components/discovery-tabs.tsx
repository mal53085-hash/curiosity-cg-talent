import Link from "next/link";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/discovery", label: "Inbox" },
  { href: "/discovery/research", label: "Research Queue" },
  { href: "/discovery/import", label: "URL / CSV取り込み" },
  { href: "/discovery/sources", label: "検索テーマ" },
] as const;

export function DiscoveryTabs({ current }: { current: "inbox" | "research" | "import" | "sources" }) {
  return (
    <nav className="mt-7 flex gap-1 overflow-x-auto border-b" aria-label="Discoveryメニュー">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={cn("whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-muted", (current === "inbox" && tab.href === "/discovery") || tab.href.endsWith(`/${current}`) ? "border-foreground text-foreground" : "hover:text-foreground")}>{tab.label}</Link>
      ))}
    </nav>
  );
}
