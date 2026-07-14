"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus, Sparkles } from "lucide-react";
import type { CandidateActionState } from "@/app/actions/candidates";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { buttonStyles } from "@/components/ui/button";
import { Field, fieldControlClass } from "@/components/ui/field";
import { candidateRatings, candidateStatuses, ratingLabels, statusLabels, type Candidate } from "@/types/candidate";

type CandidateFormAction = (
  state: CandidateActionState,
  formData: FormData,
) => Promise<CandidateActionState>;

interface CandidateFormProps {
  action: CandidateFormAction;
  candidate?: Candidate;
}

function SaveButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonStyles("primary", "min-w-32")}>
      {pending ? "保存中…" : isEditing ? "変更を保存" : "候補者を追加"}
    </button>
  );
}

export function CandidateForm({ action, candidate }: CandidateFormProps) {
  const [state, formAction] = useActionState(action, undefined);
  const error = (name: string) => state?.fieldErrors?.[name]?.[0];
  const isEditing = Boolean(candidate);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error ? (
        <p role="alert" className="rounded-xl border border-[#dec4c0] bg-[#f5e9e7] px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <section className="rounded-xl border bg-surface">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-sm font-medium">基本情報</h2>
          <p className="mt-1 text-xs text-muted">候補者のプロフィールと連絡先</p>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="氏名 / タレント名 *" htmlFor="full_name" error={error("full_name")}>
            <input id="full_name" name="full_name" required defaultValue={candidate?.full_name} className={fieldControlClass} />
          </Field>
          <Field label="専門領域 *" htmlFor="primary_role" error={error("primary_role")}>
            <input id="primary_role" name="primary_role" required defaultValue={candidate?.primary_role} placeholder="例：Senior Architectural Visualizer" className={fieldControlClass} />
          </Field>
          <Field label="メール" htmlFor="email" error={error("email")}>
            <input id="email" name="email" type="email" defaultValue={candidate?.email ?? ""} className={fieldControlClass} />
          </Field>
          <Field label="電話番号" htmlFor="phone" error={error("phone")}>
            <input id="phone" name="phone" type="tel" defaultValue={candidate?.phone ?? ""} className={fieldControlClass} />
          </Field>
          <Field label="国・地域 *" htmlFor="country" error={error("country")}>
            <input id="country" name="country" required defaultValue={candidate?.country ?? "Japan"} className={fieldControlClass} />
          </Field>
          <Field label="都市" htmlFor="city" error={error("city")}>
            <input id="city" name="city" defaultValue={candidate?.city ?? ""} className={fieldControlClass} />
          </Field>
          <Field label="経験年数" htmlFor="years_experience" error={error("years_experience")}>
            <input id="years_experience" name="years_experience" type="number" min="0" max="80" defaultValue={candidate?.years_experience ?? ""} className={fieldControlClass} />
          </Field>
          <Field label="稼働可能時期" htmlFor="availability" error={error("availability")}>
            <input id="availability" name="availability" defaultValue={candidate?.availability ?? ""} placeholder="例：2026年9月〜" className={fieldControlClass} />
          </Field>
          <Field label="スキル" htmlFor="skills" error={error("skills")} hint="カンマまたは改行で区切って入力" className="sm:col-span-2">
            <textarea id="skills" name="skills" rows={3} defaultValue={candidate?.skills.join(", ") ?? ""} placeholder="3ds Max, Corona Renderer, V-Ray, Unreal Engine" className={fieldControlClass} />
          </Field>
          <Field label="言語" htmlFor="languages" error={error("languages")} hint="カンマまたは改行で区切って入力" className="sm:col-span-2">
            <input id="languages" name="languages" defaultValue={candidate?.languages.join(", ") ?? ""} placeholder="Japanese, English" className={fieldControlClass} />
          </Field>
          <Field label="ポートフォリオURL" htmlFor="portfolio_url" error={error("portfolio_url")}>
            <input id="portfolio_url" name="portfolio_url" type="url" defaultValue={candidate?.portfolio_url ?? ""} placeholder="https://" className={fieldControlClass} />
          </Field>
          <Field label="発見元URL" htmlFor="source_url" error={error("source_url")}>
            <input id="source_url" name="source_url" type="url" defaultValue={candidate?.source_url ?? ""} placeholder="Behance / LinkedIn / Instagram" className={fieldControlClass} />
          </Field>
          <Field label="公開プロフィール" htmlFor="public_profile" error={error("public_profile")} hint="公開経歴・作品説明のみ。連絡先や社内メモは入力しないでください。" className="sm:col-span-2">
            <textarea id="public_profile" name="public_profile" rows={4} defaultValue={candidate?.public_profile ?? ""} className={fieldControlClass} />
          </Field>
          <Field label="希望契約形態" htmlFor="employment_types" error={error("employment_types")} hint="full_time, contract, freelance, part_time">
            <input id="employment_types" name="employment_types" defaultValue={candidate?.employment_types.join(", ") ?? ""} placeholder="full_time, contract" className={fieldControlClass} />
          </Field>
          <Field label="希望勤務地" htmlFor="work_location_preferences" error={error("work_location_preferences")} hint="確認済みの希望のみ">
            <input id="work_location_preferences" name="work_location_preferences" defaultValue={candidate?.work_location_preferences.join(", ") ?? ""} placeholder="Tokyo, Japan, Remote" className={fieldControlClass} />
          </Field>
          <Field label="希望年収（円）" htmlFor="expected_salary_jpy" error={error("expected_salary_jpy")} hint="未確認の場合は空欄">
            <input id="expected_salary_jpy" name="expected_salary_jpy" type="number" min="0" max="100000000" step="10000" defaultValue={candidate?.expected_salary_jpy ?? ""} placeholder="7000000" className={fieldControlClass} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border bg-surface">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-sm font-medium">候補者画像</h2>
          <p className="mt-1 text-xs text-muted">JPEG・PNG・WebP、最大8MB</p>
        </div>
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <CandidateAvatar name={candidate?.full_name ?? "New talent"} imageUrl={candidate?.image_url} className="size-24 text-xl" />
          <div className="flex-1">
            <label htmlFor="image" className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed bg-[#faf9f5] px-4 text-sm text-muted transition hover:border-[#b9b7ae] hover:text-foreground sm:justify-start">
              <ImagePlus size={17} />
              {candidate?.image_path ? "新しい画像に差し替える" : "画像を選択"}
            </label>
            <input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" />
            {candidate?.image_path ? (
              <label className="mt-3 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" name="remove_image" className="size-4 rounded border-line" />
                現在の画像を削除
              </label>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-surface">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="text-sm font-medium">選考管理</h2>
          <p className="mt-1 text-xs text-muted">評価ランクと現在の選考ステータス</p>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="ステータス" htmlFor="status" error={error("status")}>
            <select id="status" name="status" defaultValue={candidate?.status ?? "sourcing"} className={fieldControlClass}>
              {candidateStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </Field>
          <Field label="総合評価" htmlFor="rating" error={error("rating")}>
            <select id="rating" name="rating" defaultValue={candidate?.rating ?? "unrated"} className={fieldControlClass}>
              {candidateRatings.map((rating) => <option key={rating} value={rating}>{ratingLabels[rating]}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-surface">
        <div className="flex items-center gap-3 border-b bg-[#f8f7f2] px-5 py-4 sm:px-6">
          <span className="grid size-8 place-items-center rounded-lg bg-[#e7e5dd] text-[#57564f]"><Sparkles size={15} /></span>
          <div>
            <h2 className="text-sm font-medium">AI評価</h2>
            <p className="mt-0.5 text-xs text-muted">作品画像とプロフィールを自動分析</p>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-sm leading-7 text-muted">
            候補者を保存後、詳細画面の「AIで採点」から評価を実行できます。AI評価は参考情報であり、採用判断は人が行います。
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-surface p-5 sm:p-6">
        <Field label="社内メモ" htmlFor="notes" error={error("notes")} hint="候補者本人には公開されません">
          <textarea id="notes" name="notes" rows={6} defaultValue={candidate?.notes ?? ""} placeholder="面談メモ、次のアクション、確認事項など" className={fieldControlClass} />
        </Field>
      </section>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        <Link href={candidate ? `/candidates/${candidate.id}` : "/candidates"} className={buttonStyles("secondary")}>
          キャンセル
        </Link>
        <SaveButton isEditing={isEditing} />
      </div>
    </form>
  );
}
