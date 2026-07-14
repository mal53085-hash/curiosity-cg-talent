"use client";

import { useState, type FormEvent } from "react";
import { Check, ExternalLink, ImagePlus, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { portfolioUsageLabels, portfolioUsageStatuses, type AiReviewEligibility, type CandidatePortfolioImage } from "@/types/portfolio";

export function CandidatePortfolioManager({ resourceId, resourceType = "candidate", images, eligibility }: { resourceId: string; resourceType?: "candidate" | "discovery"; images: CandidatePortfolioImage[]; eligibility: AiReviewEligibility }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const apiBase = resourceType === "candidate" ? `/api/candidates/${resourceId}/portfolio` : `/api/discovery/${resourceId}/portfolio`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      const options: RequestInit = mode === "upload"
        ? { method: "POST", body: form }
        : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ external_url: form.get("external_url"), source_page_url: form.get("source_page_url"), rights_note: form.get("rights_note") }) };
      const response = await fetch(apiBase, options);
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "作品画像を登録できませんでした。");
      formElement.reset(); router.refresh();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "作品画像を登録できませんでした。"); }
    finally { setPending(false); }
  }

  async function updateImage(image: CandidatePortfolioImage, form: HTMLFormElement) {
    setPending(true); setError(null);
    const data = new FormData(form);
    try {
      const response = await fetch(`${apiBase}/${image.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ usage_status: data.get("usage_status"), rights_note: data.get("rights_note"), selected_for_ai_review: data.get("selected_for_ai_review") === "on" }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "画像情報を更新できませんでした。");
      router.refresh();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "画像情報を更新できませんでした。"); }
    finally { setPending(false); }
  }

  async function deleteImage(image: CandidatePortfolioImage) {
    if (!window.confirm("この作品画像を削除しますか？保存済みコピーも削除されます。")) return;
    setPending(true); setError(null);
    try {
      const response = await fetch(`${apiBase}/${image.id}`, { method: "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "画像を削除できませんでした。");
      router.refresh();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "画像を削除できませんでした。"); }
    finally { setPending(false); }
  }

  return <section className="rounded-xl border bg-surface">
    <div className="border-b bg-[#f8f7f2] px-5 py-4 sm:px-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-medium">Portfolio Images</h2><p className="mt-1 text-xs text-muted">公開作品を最大12枚。出典・確認日・利用許可を画像ごとに記録します。</p></div><span className="font-mono text-xs text-muted sm:ml-auto">{images.length} / 12</span></div></div>
    <div className="p-5 sm:p-6">
      <div className={`rounded-lg border p-4 ${eligibility.eligible ? "border-[#cfd8cf] bg-[#f3f7f3]" : "border-[#dfd5c6] bg-[#faf7f0]"}`}><p className="flex items-center gap-2 text-xs font-medium">{eligibility.eligible ? <Check size={14} /> : <ShieldAlert size={14} />}{eligibility.eligible ? "AI Review Eligible" : "Not Eligible"}</p>{eligibility.reasons.length ? <ul className="mt-2 space-y-1 text-[11px] leading-5 text-muted">{eligibility.reasons.map((reason) => <li key={reason}>・{reason}</li>)}</ul> : <p className="mt-2 text-[11px] text-muted">許可済みの選択画像だけがOpenAIへ送信されます。</p>}</div>

      {images.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{images.map((image) => <form key={image.id} onSubmit={(event) => { event.preventDefault(); void updateImage(image, event.currentTarget); }} className="overflow-hidden rounded-xl border"><div role="img" aria-label={`作品画像 ${image.image_order}`} className="aspect-[16/10] bg-surface-muted bg-cover bg-center" style={image.preview_url ? { backgroundImage: `url(${JSON.stringify(image.preview_url).slice(1, -1)})` } : undefined} /><div className="space-y-3 p-4"><div className="flex items-center justify-between gap-2"><span className="rounded-full border px-2 py-1 text-[10px]">#{image.image_order} {portfolioUsageLabels[image.usage_status]}</span>{image.external_url ? <a href={image.external_url} target="_blank" rel="noreferrer" aria-label="出典画像を開く" className="text-muted hover:text-foreground"><ExternalLink size={13} /></a> : null}</div><select name="usage_status" defaultValue={image.usage_status} aria-label="画像の利用状態" className="h-9 w-full rounded-lg border bg-white px-2 text-xs">{portfolioUsageStatuses.map((status) => <option key={status} value={status}>{portfolioUsageLabels[status]}</option>)}</select><textarea name="rights_note" defaultValue={image.rights_note ?? ""} maxLength={2000} rows={2} aria-label="権利・許可の確認根拠" placeholder="権利・許可の確認根拠" className="w-full rounded-lg border bg-white px-3 py-2 text-xs" /><label className="flex items-center gap-2 text-xs"><input type="checkbox" name="selected_for_ai_review" defaultChecked={image.selected_for_ai_review} disabled={!image.storage_path} className="accent-[#252522]" />AI評価に選択</label><div className="flex gap-2"><button disabled={pending} className="flex h-8 flex-1 items-center justify-center rounded-lg border text-xs hover:bg-surface-muted">更新</button><button type="button" disabled={pending} aria-label={`作品画像${image.image_order}を削除`} onClick={() => void deleteImage(image)} className="grid size-8 place-items-center rounded-lg border text-danger"><Trash2 size={13} /></button></div></div></form>)}</div> : <div className="mt-5 rounded-xl border border-dashed px-5 py-10 text-center"><ImagePlus size={20} className="mx-auto text-muted" /><p className="mt-3 text-sm text-muted">作品画像はまだありません。</p></div>}

      {images.length < 12 ? <form onSubmit={submit} className="mt-6 rounded-xl border bg-[#faf9f5] p-4"><div className="flex gap-1"><button type="button" onClick={() => setMode("upload")} className={`rounded-lg px-3 py-2 text-xs ${mode === "upload" ? "bg-[#e9e7df]" : "text-muted"}`}>画像をアップロード</button><button type="button" onClick={() => setMode("link")} className={`rounded-lg px-3 py-2 text-xs ${mode === "link" ? "bg-[#e9e7df]" : "text-muted"}`}>公開URLをリンク登録</button></div>{mode === "upload" ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs"><span className="text-muted">画像（JPEG / PNG / WebP、8MB以下）</span><input required type="file" name="image" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs" /></label><label className="text-xs"><span className="text-muted">利用状態</span><select name="usage_status" defaultValue="unknown" className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-xs"><option value="unknown">権利状態未確認</option><option value="review_copy_authorized">レビュー用コピー許可済み</option><option value="internal_reference_authorized">社内参考利用許可済み</option></select></label><label className="text-xs"><span className="text-muted">出典ページURL</span><input name="source_page_url" type="url" maxLength={2048} className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-xs" /></label><label className="text-xs"><span className="text-muted">権利メモ（許可済みの場合は必須）</span><input name="rights_note" maxLength={2000} className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-xs" /></label></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs"><span className="text-muted">画像URL</span><input required name="external_url" type="url" maxLength={2048} className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-xs" /></label><label className="text-xs"><span className="text-muted">出典ページURL</span><input required name="source_page_url" type="url" maxLength={2048} className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-xs" /></label><label className="text-xs sm:col-span-2"><span className="text-muted">確認メモ</span><input name="rights_note" maxLength={2000} placeholder="リンク参照のみ。保存・AI送信は未許可。" className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-xs" /></label></div>}<p className="mt-4 text-[11px] leading-5 text-muted">公開URLはプレビュー用リンクとしてのみ登録します。全画像の自動保存は行いません。AI利用には、許可を確認した画像ファイルのアップロードが必要です。</p><Button className="mt-4" disabled={pending}>{pending ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}登録</Button></form> : null}
      {error ? <p role="alert" className="mt-4 rounded-lg border border-[#dec4c0] bg-[#f5e9e7] px-4 py-3 text-xs text-danger">{error}</p> : null}
    </div>
  </section>;
}
