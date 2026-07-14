import type { ReactNode } from "react";

export default function DiscoveryLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">{children}</div>;
}
