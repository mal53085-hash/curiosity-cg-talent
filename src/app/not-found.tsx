import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export default function NotFound() {
  return (
    <main className="grid min-h-[70svh] place-items-center px-6 py-20 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-muted text-muted"><SearchX size={19} /></div>
        <p className="mt-5 font-mono text-xs text-muted">404</p>
        <h1 className="mt-2 text-2xl font-medium tracking-[-0.03em]">ページが見つかりません</h1>
        <p className="mt-3 text-sm text-muted">削除されたか、URLが変更された可能性があります。</p>
        <ButtonLink href="/dashboard" variant="secondary" className="mt-6">ダッシュボードへ</ButtonLink>
      </div>
    </main>
  );
}
