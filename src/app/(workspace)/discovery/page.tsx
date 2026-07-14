import Link from "next/link";
import { Check, Copy, ExternalLink, Inbox, Sparkles, X } from "lucide-react";
import { bulkReviewDiscoveryAction, reviewDiscoveryItemAction } from "@/app/actions/discovery";
import { DiscoveryTabs } from "@/components/discovery-tabs";
import { DiscoveryAiButton } from "@/components/discovery-ai-button";
import { buttonStyles } from "@/components/ui/button";
import { getDiscoveryItems } from "@/lib/discovery/data";
import { cn } from "@/lib/utils";
import { discoveryItemStatuses, discoveryStatusLabels, sourceTypeLabels, type DiscoveryItemStatus } from "@/types/discovery";

export default async function DiscoveryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const status = discoveryItemStatuses.includes(params.status as DiscoveryItemStatus) ? params.status as DiscoveryItemStatus : "new";
  const items = await getDiscoveryItems(status);
  return (
    <>
      <header>
        <p className="text-[10px] font-medium tracking-[0.18em] text-muted uppercase">Talent discovery</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Discovery Inbox</h1><p className="mt-2 text-sm text-muted">公開情報から見つけた候補を、人が確認してから正式登録します。</p></div>
          <Link href="/discovery/import" className={buttonStyles()}>URLを取り込む</Link>
        </div>
      </header>
      <DiscoveryTabs current="inbox" />

      <div className="mt-5 flex gap-2 overflow-x-auto">
        {discoveryItemStatuses.map((value) => <Link key={value} href={`/discovery?status=${value}`} className={cn("rounded-full border bg-surface px-3 py-1.5 text-xs text-muted", status === value && "border-foreground text-foreground")}>{discoveryStatusLabels[value]}</Link>)}
      </div>

      {items.length ? (
        <form action={bulkReviewDiscoveryAction} className="mt-5">
          {status === "new" ? <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-surface p-3"><span className="mr-2 text-xs text-muted">選択した候補を</span><button name="decision" value="approve" className={buttonStyles("secondary", "h-8 px-3 text-xs")}><Check size={13} />承認</button><button name="decision" value="reject" className={buttonStyles("secondary", "h-8 px-3 text-xs")}><X size={13} />見送り</button><button name="decision" value="duplicate" className={buttonStyles("secondary", "h-8 px-3 text-xs")}><Copy size={13} />重複</button></div> : null}
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-xl border bg-surface shadow-[0_8px_30px_rgba(32,32,30,0.035)]">
                <div className="aspect-[16/8] bg-surface-muted bg-cover bg-center" style={item.thumbnail_url ? { backgroundImage: `url(${JSON.stringify(item.thumbnail_url).slice(1, -1)})` } : undefined}><div className="flex h-full items-center justify-center text-muted">{item.thumbnail_url ? null : <Inbox size={24} strokeWidth={1.2} />}</div></div>
                <div className="p-4">
                  <div className="flex items-start gap-3">{status === "new" ? <input type="checkbox" name="item_id" value={item.id} className="mt-1 size-4 accent-[#252522]" aria-label={`${item.author_name}を選択`} /> : null}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-surface-muted px-2 py-1 text-[10px] font-medium">{sourceTypeLabels[item.source_type]}</span>{item.country ? <span className="text-xs text-muted">{item.country}</span> : null}{item.preliminary_ai_score !== null ? <span className="ml-auto flex items-center gap-1 font-mono text-xs"><Sparkles size={12} />{item.preliminary_ai_score}</span> : null}</div><h2 className="mt-3 truncate text-base font-medium">{item.author_name}</h2><p className="mt-1 line-clamp-1 text-sm text-muted">{item.title}</p></div></div>
                  {item.skills.length ? <div className="mt-4 flex flex-wrap gap-1.5">{item.skills.slice(0, 5).map((skill) => <span key={skill} className="rounded-md border px-2 py-1 text-[10px] text-muted">{skill}</span>)}</div> : null}
                  {item.preliminary_ai_summary ? <p className="mt-4 line-clamp-3 text-xs leading-5 text-muted">{item.preliminary_ai_summary}</p> : null}
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4"><a href={item.source_url} target="_blank" rel="noreferrer" className={buttonStyles("ghost", "h-8 px-2 text-xs")}><ExternalLink size={13} />公開ページ</a>{status === "new" ? <><DiscoveryAiButton id={item.id} disabled={!item.thumbnail_url} /><div className="ml-auto flex gap-1"><button formAction={reviewDiscoveryItemAction.bind(null, item.id, "approve")} className={buttonStyles("secondary", "h-8 px-2 text-xs")}><Check size={13} />承認</button><button formAction={reviewDiscoveryItemAction.bind(null, item.id, "reject")} className={buttonStyles("ghost", "h-8 px-2 text-xs")} aria-label="見送り"><X size={14} /></button><button formAction={reviewDiscoveryItemAction.bind(null, item.id, "duplicate")} className={buttonStyles("ghost", "h-8 px-2 text-xs")} aria-label="重複"><Copy size={13} /></button></div></> : item.candidate_id ? <Link href={`/candidates/${item.candidate_id}`} className={buttonStyles("secondary", "ml-auto h-8 px-3 text-xs")}>候補者を見る</Link> : null}</div>
                </div>
              </article>
            ))}
          </div>
        </form>
      ) : <section className="mt-5 rounded-xl border bg-surface px-6 py-20 text-center"><Inbox className="mx-auto text-muted" size={24} /><h2 className="mt-4 text-base font-medium">このInboxは空です</h2><p className="mt-2 text-sm text-muted">URLまたはCSVから候補を追加してください。</p></section>}
    </>
  );
}
