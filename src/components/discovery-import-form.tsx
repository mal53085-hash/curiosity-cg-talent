"use client";

import { useActionState, useState } from "react";
import { Globe2, LoaderCircle, Search } from "lucide-react";
import { createDiscoveryItemAction } from "@/app/actions/discovery";
import { Button } from "@/components/ui/button";
import { Field, fieldControlClass } from "@/components/ui/field";
import type { DiscoverySourceType } from "@/types/discovery";

type Preview = {
  sourceType: DiscoverySourceType;
  title: string;
  authorName: string;
  description: string;
  thumbnailUrl: string;
  externalId: string;
  manualOnly: boolean;
  notice?: string;
};

export function DiscoveryImportForm() {
  const [state, action, pending] = useActionState(createDiscoveryItemAction, undefined);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);

  async function loadPreview() {
    setPreviewing(true);
    setPreviewError("");
    try {
      const response = await fetch("/api/discovery/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await response.json() as Preview & { error?: string };
      if (!response.ok) throw new Error(body.error || "プレビューを取得できませんでした。");
      setPreview(body);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "プレビューを取得できませんでした。");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="公開プロフィール / ポートフォリオURL" htmlFor="source_url" className="min-w-0">
          <div className="relative">
            <Globe2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input id="source_url" name="source_url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.behance.net/..." className={`${fieldControlClass} pl-9`} />
          </div>
        </Field>
        <Button type="button" variant="secondary" onClick={loadPreview} disabled={!url || previewing} className="self-end">
          {previewing ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}
          公開情報を確認
        </Button>
      </div>

      {previewError ? <p className="rounded-lg border border-[#dfc0bc] bg-[#f8ecea] px-4 py-3 text-sm text-danger">{previewError}</p> : null}
      {preview?.notice ? <p className="rounded-lg border bg-surface-muted px-4 py-3 text-xs leading-5 text-muted">{preview.notice}</p> : null}

      <input type="hidden" name="source_type" value={preview?.sourceType ?? "manual"} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="作者名" htmlFor="author_name">
          <input id="author_name" name="author_name" required key={`author-${preview?.authorName}`} defaultValue={preview?.authorName ?? ""} className={fieldControlClass} />
        </Field>
        <Field label="タイトル / 専門領域" htmlFor="title">
          <input id="title" name="title" required key={`title-${preview?.title}`} defaultValue={preview?.title ?? ""} className={fieldControlClass} />
        </Field>
        <Field label="国・地域" htmlFor="country">
          <input id="country" name="country" placeholder="United Kingdom" className={fieldControlClass} />
        </Field>
        <Field label="External ID" htmlFor="external_id" hint="取得できない場合は空欄で構いません。">
          <input id="external_id" name="external_id" key={`external-${preview?.externalId}`} defaultValue={preview?.externalId ?? ""} className={fieldControlClass} />
        </Field>
        <Field label="スキル" htmlFor="skills" hint="カンマ区切り">
          <input id="skills" name="skills" placeholder="3ds Max, Corona Renderer, Archviz" className={fieldControlClass} />
        </Field>
        <Field label="サムネイルURL" htmlFor="thumbnail_url" hint="公開作品画像だけを指定してください。">
          <input id="thumbnail_url" name="thumbnail_url" type="url" key={`thumb-${preview?.thumbnailUrl}`} defaultValue={preview?.thumbnailUrl ?? ""} className={fieldControlClass} />
        </Field>
        <Field label="説明" htmlFor="description" className="sm:col-span-2">
          <textarea id="description" name="description" rows={5} key={`description-${preview?.description}`} defaultValue={preview?.description ?? ""} className={fieldControlClass} />
        </Field>
      </div>

      {(preview?.sourceType === "linkedin" || url.includes("linkedin.com")) ? (
        <div className="grid gap-5 rounded-xl border bg-surface-muted p-4 sm:grid-cols-2">
          <Field label="Recruiterプロジェクト" htmlFor="recruiter_project"><input id="recruiter_project" name="recruiter_project" className={fieldControlClass} /></Field>
          <Field label="Recruiterステージ" htmlFor="recruiter_stage"><input id="recruiter_stage" name="recruiter_stage" className={fieldControlClass} /></Field>
          <Field label="Recruiterメモ" htmlFor="recruiter_notes" className="sm:col-span-2" hint="社内メモはAI評価へ送信されません。"><textarea id="recruiter_notes" name="recruiter_notes" rows={3} className={fieldControlClass} /></Field>
        </div>
      ) : null}

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.message ? <p className="text-sm text-[#4c6b51]">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "登録中…" : "Discovery Inboxへ登録"}</Button>
    </form>
  );
}
