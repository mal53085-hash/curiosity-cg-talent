import type {
  AcquisitionField,
  AcquisitionPreviewRow,
  AcquisitionRecord,
  ColumnMapping,
} from "@/types/acquisition";
import {
  acquisitionFields,
} from "@/types/acquisition";
import {
  discoverySourceTypes,
  type DiscoverySourceType,
} from "@/types/discovery";

export const MAX_ACQUISITION_ROWS = 100;
export const forbiddenCsvColumns = ["email", "phone", "telephone", "address", "postal_address"];

function isPrivateIpv4(host: string) {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export function isObviouslyPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") ||
    host.startsWith("fe80:") || isPrivateIpv4(host);
}

export function normalizeCandidateUrl(input: string) {
  const url = new URL(input.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("公開http(s) URLを入力してください。");
  }
  if (isObviouslyPrivateHost(url.hostname)) throw new Error("プライベートネットワークのURLは登録できません。");
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid"].forEach((key) => url.searchParams.delete(key));
  if (url.toString().length > 2048) throw new Error("URLが長すぎます。");
  return url.toString();
}

export function identifyAcquisitionSource(input: string): DiscoverySourceType {
  const host = new URL(input).hostname.toLowerCase().replace(/^www\./, "");
  if (host === "behance.net" || host.endsWith(".behance.net")) return "behance";
  if (host === "artstation.com" || host.endsWith(".artstation.com")) return "artstation";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  if (host === "cgarchitect.com" || host.endsWith(".cgarchitect.com")) return "cgarchitect";
  return "website";
}

export function splitAcquisitionList(value: string) {
  return value.split(/[;、,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 30);
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSVの引用符が閉じられていません。");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function defaultColumnMapping(headers: string[]): ColumnMapping {
  return Object.fromEntries(headers.map((header) => {
    const normalized = header.trim().toLowerCase();
    return [header, acquisitionFields.includes(normalized as AcquisitionField) ? normalized : "ignore"];
  })) as ColumnMapping;
}

function listFromRecord(record: Record<string, string>, field: AcquisitionField) {
  return splitAcquisitionList(record[field] ?? "");
}

export function csvRowsToPreview(text: string, mapping: ColumnMapping) {
  const parsed = parseCsv(text);
  if (parsed.length < 2) throw new Error("CSVにはヘッダーと1件以上のデータが必要です。");
  if (parsed.length - 1 > MAX_ACQUISITION_ROWS) throw new Error("CSVは一度に100件までです。");
  const headers = parsed[0].map((value) => value.trim());
  const fields = Object.values(mapping).filter((value) => value !== "ignore");
  if (!fields.includes("name") || !fields.includes("source_url")) throw new Error("nameとsource_urlの列マッピングが必要です。");
  const duplicateMapping = fields.find((field, index) => fields.indexOf(field) !== index);
  if (duplicateMapping) throw new Error(`${duplicateMapping}が複数の列に割り当てられています。`);

  return parsed.slice(1).map((cells, index): AcquisitionPreviewRow => {
    const record: Record<string, string> = {};
    headers.forEach((header, cellIndex) => {
      const field = mapping[header];
      if (field && field !== "ignore") record[field] = (cells[cellIndex] ?? "").trim();
    });
    const errors: string[] = [];
    let normalizedUrl: string | null = null;
    let sourceType: DiscoverySourceType | null = null;
    try {
      normalizedUrl = normalizeCandidateUrl(record.source_url ?? "");
      const requestedType = record.source_type?.toLowerCase();
      sourceType = discoverySourceTypes.includes(requestedType as DiscoverySourceType)
        ? requestedType as DiscoverySourceType
        : identifyAcquisitionSource(normalizedUrl);
    } catch (error) { errors.push(error instanceof Error ? error.message : "URLが不正です。"); }
    if (!record.name) errors.push("公開名がありません。");
    if ((record.name ?? "").length > 200) errors.push("公開名は200文字以下にしてください。");
    const portfolio = record.portfolio_url ?? "";
    let normalizedPortfolio = "";
    if (portfolio) {
      try { normalizedPortfolio = normalizeCandidateUrl(portfolio); } catch { errors.push("ポートフォリオURLが不正です。"); }
    }
    return {
      rowNumber: index + 1,
      rawInput: JSON.stringify(record).slice(0, 10000),
      normalizedUrl,
      sourceType,
      supported: errors.length === 0,
      duplicate: false,
      duplicateKind: null,
      errors,
      data: {
        name: record.name ?? "",
        source_type: sourceType ?? "manual",
        source_url: normalizedUrl ?? record.source_url ?? "",
        portfolio_url: normalizedPortfolio,
        region: (record.region ?? "").slice(0, 120),
        skills: listFromRecord(record, "skills"),
        software: listFromRecord(record, "software"),
        languages: listFromRecord(record, "languages"),
        employment_types: listFromRecord(record, "employment_types"),
        work_location_preferences: listFromRecord(record, "work_location_preferences"),
        notes_for_review: (record.notes_for_review ?? "").slice(0, 5000),
        public_profile: "",
        research_status: "new",
      },
    };
  });
}

export function urlLinesToPreview(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error("URLを1件以上入力してください。");
  if (lines.length > MAX_ACQUISITION_ROWS) throw new Error("URLは一度に100件までです。");
  const seen = new Set<string>();
  return lines.map((line, index): AcquisitionPreviewRow => {
    try {
      const normalizedUrl = normalizeCandidateUrl(line);
      const sourceType = identifyAcquisitionSource(normalizedUrl);
      const batchDuplicate = seen.has(normalizedUrl.toLowerCase());
      seen.add(normalizedUrl.toLowerCase());
      return {
        rowNumber: index + 1,
        rawInput: line,
        normalizedUrl,
        sourceType,
        supported: true,
        duplicate: batchDuplicate,
        duplicateKind: batchDuplicate ? "batch" : null,
        errors: [],
        data: {
          name: new URL(normalizedUrl).hostname.replace(/^www\./, ""),
          source_type: sourceType,
          source_url: normalizedUrl,
          portfolio_url: normalizedUrl,
          region: "",
          skills: [], software: [], languages: [], employment_types: [], work_location_preferences: [],
          notes_for_review: sourceType === "linkedin" ? "LinkedInはURLと手入力情報のみで確認" : "公開情報を人が確認してください",
          public_profile: "",
          research_status: "new",
        },
      };
    } catch (error) {
      return { rowNumber: index + 1, rawInput: line, normalizedUrl: null, sourceType: null, supported: false, duplicate: false, duplicateKind: null, errors: [error instanceof Error ? error.message : "URLが不正です。"], data: {} };
    }
  });
}

export function acquisitionRecordSchemaInput(row: AcquisitionPreviewRow): AcquisitionRecord | null {
  if (!row.supported || row.duplicate || !row.normalizedUrl || !row.sourceType) return null;
  const data = row.data;
  return {
    name: String(data.name ?? "").trim().slice(0, 200),
    source_type: row.sourceType,
    source_url: row.normalizedUrl,
    portfolio_url: String(data.portfolio_url ?? "").trim(),
    region: String(data.region ?? "").trim().slice(0, 120),
    skills: data.skills ?? [], software: data.software ?? [], languages: data.languages ?? [],
    employment_types: data.employment_types ?? [], work_location_preferences: data.work_location_preferences ?? [],
    notes_for_review: String(data.notes_for_review ?? "").slice(0, 5000),
    public_profile: String(data.public_profile ?? "").slice(0, 5000),
    research_status: data.research_status ?? "new",
  };
}
