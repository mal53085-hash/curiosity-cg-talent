import Link from "next/link";
import { ArrowUpRight, BarChart3, ClipboardCheck, Gauge, Import, Radar, ScanSearch, SlidersHorizontal, Sparkles } from "lucide-react";

const tools = [
  ["AI Scout", "自然言語条件とStyle Profileで候補者を再ランキング", "/scout", Sparkles],
  ["Visual Search", "参考画像の派生特徴量から作品傾向を比較", "/visual-search", ScanSearch],
  ["Discovery", "公開ソースからの候補発見と確認Inbox", "/discovery", Radar],
  ["Acquisition", "URL・CSVの一括取込と重複処理", "/acquisition", Import],
  ["Data Quality", "候補者データの充実度と評価テスト", "/data-quality", BarChart3],
  ["Evaluation", "AI評価基準と人間レビュー", "/calibration", SlidersHorizontal],
  ["Search Quality", "Scout・Visual Searchの実行品質", "/search-quality", Gauge],
  ["Validation", "Production Validationの証跡管理", "/production-validation", ClipboardCheck],
] as const;

export default function AdvancedPage() { return <div className="mx-auto max-w-[1200px] px-4 py-7 sm:px-7 sm:py-10"><header className="max-w-2xl"><p className="text-[10px] font-medium tracking-[.18em] text-muted uppercase">Advanced</p><h1 className="mt-2 text-3xl font-medium tracking-[-.045em] sm:text-4xl">高度な検索と運用</h1><p className="mt-2 text-sm leading-6 text-muted">通常採用では使わない分析・発見・検証機能です。既存データとURLは維持されています。</p></header><div className="mt-8 divide-y border-y">{tools.map(([name, description, href, Icon]) => <Link key={href} href={href} className="group flex items-center gap-4 py-5"><span className="grid size-10 place-items-center rounded-full bg-surface-muted text-muted"><Icon size={16}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{name}</span><span className="mt-1 block text-xs text-muted">{description}</span></span><ArrowUpRight size={15} className="text-muted transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/></Link>)}</div></div>; }
