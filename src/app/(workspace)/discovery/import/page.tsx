import { importLinkedInCsvAction } from "@/app/actions/discovery";
import { DiscoveryImportForm } from "@/components/discovery-import-form";
import { DiscoveryTabs } from "@/components/discovery-tabs";
import { Button } from "@/components/ui/button";
import { Field, fieldControlClass } from "@/components/ui/field";

export default function DiscoveryImportPage() {
  return <>
    <header><p className="text-[10px] font-medium tracking-[0.18em] text-muted uppercase">Human reviewed intake</p><h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">候補を取り込む</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">公開情報を確認・修正してInboxへ登録します。LinkedInはページを自動取得せず、URL、手入力、CSVだけを使用します。</p></header>
    <DiscoveryTabs current="import" />
    <section className="mt-7 rounded-xl border bg-surface p-5 sm:p-7"><h2 className="text-lg font-medium">URLから追加</h2><div className="mt-6"><DiscoveryImportForm /></div></section>
    <section className="mt-5 rounded-xl border bg-surface p-5 sm:p-7"><h2 className="text-lg font-medium">LinkedIn CSV</h2><p className="mt-2 text-xs leading-5 text-muted">最大500件。必須列: <code>profile_url,name</code>。任意列: <code>headline,country,skills,project,stage</code>。プロフィール本文の自動取得は行いません。</p><form action={importLinkedInCsvAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"><Field label="CSVファイル" htmlFor="csv" className="flex-1"><input id="csv" name="csv" type="file" accept=".csv,text/csv" required className={fieldControlClass} /></Field><Button type="submit">CSVを取り込む</Button></form></section>
  </>;
}
