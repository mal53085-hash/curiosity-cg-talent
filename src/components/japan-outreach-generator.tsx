"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";

type CandidateForOutreach = { full_name: string; current_country: string | null; current_city: string | null; japanese_level: string | null; interested_in_japan: boolean | null; willing_to_relocate_to_japan: boolean | null; remote_from_overseas: boolean | null; primary_role: string; portfolio_url: string | null };

const types = [
  ["japan_ja", "日本在住者向け・日本語"], ["japan_bilingual", "日本在住外国籍人材向け・日英"], ["relocation", "海外在住者への日本移住確認"], ["remote", "海外リモート業務委託"], ["interest", "転職意向だけを確認する短文"],
] as const;

export function JapanOutreachGenerator({ candidate }: { candidate: CandidateForOutreach }) {
  const [type, setType] = useState<(typeof types)[number][0]>("interest");
  const [copied, setCopied] = useState(false);
  const message = buildMessage(type, candidate);
  async function copy() { await navigator.clipboard.writeText(message); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
  return <section className="rounded-xl border bg-surface p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-medium">勤務条件を確認する</h2><p className="mt-1 text-xs text-muted">未確認事項は質問として記載します。送信は行いません。</p></div><select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="h-10 rounded-lg border bg-white px-3 text-xs">{types.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div><pre className="mt-4 whitespace-pre-wrap rounded-lg bg-[#f8f7f2] p-4 font-sans text-xs leading-6">{message}</pre><button type="button" onClick={copy} className={buttonStyles("primary", "mt-4")}>{copied ? <Check size={14}/> : <Copy size={14}/>}コピー</button></section>;
}

function buildMessage(type: (typeof types)[number][0], candidate: CandidateForOutreach) {
  const name = candidate.full_name;
  const role = candidate.primary_role;
  const locationQuestion = candidate.current_country ? `現在は${[candidate.current_city, candidate.current_country].filter(Boolean).join(", ")}にお住まいと拝見しましたが、` : "現在のご居住地とあわせて、";
  if (type === "japan_ja") return `${name}様\n\nはじめまして。Curiosity採用チームです。${role}としての公開作品を拝見し、ご連絡しました。現在の転職意向と、東京での勤務条件について一度お話を伺えますでしょうか。なお、日本での就労条件や日本語レベルについて未確認の項目があるため、差し支えない範囲で教えていただければ幸いです。`;
  if (type === "japan_bilingual") return `${name}様\n\nCuriosity採用チームです。公開されているCG作品に関心を持ち、ご連絡しました。日本での勤務形態、就労条件、日本語・英語でのコミュニケーションについて伺えますでしょうか。\n\nHello ${name}, we were impressed by your public CG work. May we ask about your interest in working in Tokyo, your current work authorization, and your preferred working language? We would be glad to share more details about Curiosity.`;
  if (type === "relocation") return `Hello ${name},\n\nWe are the hiring team at Curiosity in Tokyo. We came across your public work as a ${role} and would be interested in learning more. ${locationQuestion}may we ask whether you would consider working in Japan or relocating to Tokyo? We have not assumed your visa status, language ability, or relocation availability and would appreciate hearing your preferences directly.`;
  if (type === "remote") return `Hello ${name},\n\nCuriosity is exploring potential remote collaboration for architectural and interior CG work. Would you be interested in discussing an overseas remote or freelance engagement? We would also like to confirm your availability, preferred contract type, time-zone overlap, and rate expectations.`;
  return `${name}様\n\nCuriosity採用チームです。公開されているCG作品を拝見し、ご連絡しました。現在、新しい仕事やプロジェクトについてお話を聞くご意向はありますでしょうか。未定の場合も、将来の可能性として短くお返事いただければ幸いです。`;
}
