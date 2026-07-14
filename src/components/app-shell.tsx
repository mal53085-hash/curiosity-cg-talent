"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  BarChart3,
  ClipboardCheck,
  Gauge,
  Import,
  ScanSearch,
  Radar,
  LogOut,
  Menu,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/scout", label: "AI Scout", icon: Sparkles },
  { href: "/visual-search", label: "Visual Search", icon: ScanSearch },
  { href: "/data-quality", label: "データ品質", icon: BarChart3 },
  { href: "/acquisition", label: "Acquisition", icon: Import },
  { href: "/discovery", label: "Discovery", icon: Radar },
  { href: "/candidates", label: "候補者", icon: Users },
] as const;

interface AppShellProps {
  children: ReactNode;
  userEmail: string;
}

export function AppShell({ children, userEmail }: AppShellProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-between border-b px-5">
        <Link href="/dashboard" className="flex items-baseline gap-3" onClick={() => setIsOpen(false)}>
          <span className="text-3xl font-medium tracking-[-0.08em]">dig</span>
          <span className="text-[9px] font-medium tracking-[0.18em] text-muted uppercase">
            Curiosity
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-muted lg:hidden"
          aria-label="メニューを閉じる"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="メインナビゲーション">
        <p className="px-3 pb-2 pt-3 text-[10px] font-medium tracking-[0.16em] text-[#9b9991] uppercase">
          Workspace
        </p>
        {navigation.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                active
                  ? "bg-[#e9e7df] font-medium text-foreground"
                  : "text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <item.icon size={16} strokeWidth={1.7} />
              {item.label}
            </Link>
          );
        })}

        <p className="px-3 pb-2 pt-7 text-[10px] font-medium tracking-[0.16em] text-[#9b9991] uppercase">
          Tools
        </p>
        <Link
          href="/candidates?focus=search"
          onClick={() => setIsOpen(false)}
          className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <Search size={16} strokeWidth={1.7} />
          候補者を検索
        </Link>
        <Link
          href="/search-quality"
          onClick={() => setIsOpen(false)}
          className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <Gauge size={16} strokeWidth={1.7} />
          検索品質
        </Link>
        <Link
          href="/calibration"
          onClick={() => setIsOpen(false)}
          className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <SlidersHorizontal size={16} strokeWidth={1.7} />
          評価基準
        </Link>
        <Link
          href="/production-validation"
          onClick={() => setIsOpen(false)}
          className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <ClipboardCheck size={16} strokeWidth={1.7} />
          本番検証
        </Link>
        <span className="flex h-10 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm text-[#aaa8a0]">
          <Settings size={16} strokeWidth={1.7} />
          設定
          <span className="ml-auto text-[9px] tracking-wide">SOON</span>
        </span>
      </nav>

      <div className="border-t p-3">
        <div className="mb-2 px-3 py-2">
          <p className="truncate text-xs font-medium">{userEmail}</p>
          <p className="mt-1 text-[10px] text-muted">採用チーム</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted transition hover:bg-surface-muted hover:text-foreground"
          >
            <LogOut size={16} strokeWidth={1.7} />
            ログアウト
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-svh flex-col border-r bg-[#f3f2ed] lg:flex">
        {sidebar}
      </aside>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
            aria-label="メニューを閉じる"
            onClick={() => setIsOpen(false)}
          />
          <aside className="relative flex h-full w-[min(82vw,300px)] flex-col border-r bg-[#f3f2ed] shadow-2xl">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="grid size-10 place-items-center rounded-lg border bg-surface"
            aria-label="メニューを開く"
          >
            <Menu size={18} />
          </button>
          <Link href="/dashboard" className="text-2xl font-medium tracking-[-0.08em]">
            dig
          </Link>
          <div className="size-10" aria-hidden="true" />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
