import type { Candidate, HiringPipelineStage, JapanReadinessGrade } from "@/types/candidate";

const readinessPoints: Record<JapanReadinessGrade, number> = { A: 30, B: 24, C: 17, D: 7, blocked: 0 };

export type HiringSignals = {
  cgFit: number | null;
  japanReadiness: JapanReadinessGrade;
  contactPriority: number;
  reasons: string[];
  nextAction: string;
  conclusion: string;
};

export function getHiringSignals(candidate: Candidate): HiringSignals {
  const cgFit = candidate.ai_score;
  const reasons: string[] = [];
  let priority = Math.round((cgFit ?? 0) * 0.4) + readinessPoints[candidate.hiring_readiness_status];

  if (cgFit == null) reasons.push("CG Fit未評価");
  else if (cgFit >= 75) reasons.push("CG Fitが有力");
  else if (cgFit >= 60) reasons.push("CG Fitを確認する価値あり");

  const confidence = Math.min(15, Math.round(candidate.hiring_readiness_confidence * 0.15));
  priority += confidence;
  if (confidence < 8) reasons.push("日本勤務条件の確認度が低い");
  else reasons.push("日本勤務条件に根拠あり");

  if (candidate.project_fit_tags.length > 0) {
    priority += 5;
    reasons.push(`案件適性: ${candidate.project_fit_tags.slice(0, 2).join(" / ")}`);
  }

  const contactedDaysAgo = candidate.last_contacted_at
    ? (Date.now() - new Date(candidate.last_contacted_at).getTime()) / 86_400_000
    : null;
  if (candidate.hiring_pipeline_stage === "new" || candidate.hiring_pipeline_stage === "shortlist") {
    priority += contactedDaysAgo == null || contactedDaysAgo >= 7 ? 10 : 3;
    reasons.push(contactedDaysAgo == null ? "まだ接触していない" : "再確認可能な接触間隔");
  }
  if (candidate.hiring_pipeline_stage === "closed" || candidate.hiring_readiness_status === "blocked") priority = 0;

  const nextAction = resolveNextAction(candidate);
  const conclusion = resolveConclusion(candidate, cgFit);
  return { cgFit, japanReadiness: candidate.hiring_readiness_status, contactPriority: Math.max(0, Math.min(100, priority)), reasons, nextAction, conclusion };
}

function resolveNextAction(candidate: Candidate) {
  if (candidate.hiring_pipeline_stage === "closed") return "クローズ理由を確認";
  if (candidate.hiring_readiness_status === "D") return "英語で日本勤務条件を確認";
  if (candidate.hiring_readiness_status === "blocked") return "条件変更の可能性を人が確認";
  if (candidate.hiring_pipeline_stage === "new") return "Shortlist可否を確認";
  if (candidate.hiring_pipeline_stage === "shortlist") return "スカウト文面を作成";
  if (candidate.hiring_pipeline_stage === "contacted") return "返信状況を確認";
  if (candidate.hiring_pipeline_stage === "interview") return "面談準備を確認";
  return candidate.next_action || "次の選考アクションを確認";
}

function resolveConclusion(candidate: Candidate, cgFit: number | null) {
  const quality = cgFit == null ? "CG品質は未評価です。" : cgFit >= 75 ? "CG品質は有力です。" : "CG品質は追加確認が必要です。";
  if (candidate.hiring_readiness_status === "A") return `${quality} 日本での採用条件は概ね確認済みです。`;
  if (candidate.hiring_readiness_status === "B") return `${quality} 未確認の勤務条件を確認後、優先連絡を検討してください。`;
  if (candidate.hiring_readiness_status === "C") return `${quality} 海外リモートまたは業務委託条件を確認してください。`;
  if (candidate.hiring_readiness_status === "blocked") return `${quality} 現条件では採用が難しいため、人が条件変更の可能性を確認してください。`;
  return `${quality} 日本在住状況と勤務条件が未確認のため、まず英語で確認することを推奨します。`;
}

export function mapLegacyStatus(stage: HiringPipelineStage): Candidate["status"] {
  return ({ new: "sourcing", shortlist: "screening", contacted: "screening", interview: "interview", offer: "offer", closed: "on_hold" } as const)[stage];
}

export function coverageSegment(candidate: Candidate) {
  const inJapan = (candidate.current_country ?? candidate.country).toLowerCase() === "japan";
  const japanese = (candidate.japanese_level ?? "").toLowerCase();
  if (inJapan && ["native", "n1", "n2", "business"].some((level) => japanese.includes(level))) return "japan_japanese";
  if (inJapan) return "japan_international";
  if (candidate.interested_in_japan || candidate.willing_to_relocate_to_japan || candidate.willing_to_work_in_tokyo) return "relocation";
  if (candidate.remote_from_overseas) return "overseas_remote";
  return "global_reference";
}

export function currentHiringTime() { return Date.now(); }
export function isCandidateStale(candidate: Candidate, now = Date.now()) { return candidate.hiring_pipeline_stage !== "closed" && now - new Date(candidate.updated_at).getTime() >= 7 * 86_400_000; }
