import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import {
  csvRowsToPreview,
  defaultColumnMapping,
  forbiddenCsvColumns,
  parseCsv,
  urlLinesToPreview,
} from "@/lib/acquisition/import";
import { createClient } from "@/lib/supabase/server";
import type { AcquisitionPreviewRow, ColumnMapping } from "@/types/acquisition";

const requestSchema = z.object({
  kind: z.enum(["url", "csv"]),
  text: z.string().min(1).max(1_000_000),
  mapping: z.record(z.string(), z.string()).optional(),
});

async function addDatabaseDuplicates(rows: AcquisitionPreviewRow[]) {
  const urls = rows.flatMap((row) => row.normalizedUrl ? [row.normalizedUrl] : []);
  if (!urls.length) return rows;
  const supabase = await createClient();
  const [{ data: discoveries }, { data: candidates }] = await Promise.all([
    supabase.from("discovery_items").select("id,source_url").in("source_url", urls),
    supabase.from("candidates").select("id,source_url").in("source_url", urls),
  ]);
  const discoveryUrls = new Set((discoveries ?? []).map((item) => item.source_url.toLowerCase()));
  const candidateUrls = new Set((candidates ?? []).flatMap((item) => item.source_url ? [item.source_url.toLowerCase()] : []));
  return rows.map((row) => {
    if (!row.normalizedUrl || row.duplicate) return row;
    const key = row.normalizedUrl.toLowerCase();
    const duplicateKind: AcquisitionPreviewRow["duplicateKind"] = discoveryUrls.has(key) ? "discovery" : candidateUrls.has(key) ? "candidate" : null;
    return duplicateKind ? { ...row, duplicate: true, duplicateKind } : row;
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "取込内容を確認してください。" }, { status: 400 });
  try {
    let excludedColumns: string[] = [];
    let rows: AcquisitionPreviewRow[];
    if (parsed.data.kind === "url") {
      rows = urlLinesToPreview(parsed.data.text);
    } else {
      const csv = parseCsv(parsed.data.text);
      const headers = csv[0]?.map((header) => header.trim()) ?? [];
      excludedColumns = headers.filter((header) => forbiddenCsvColumns.includes(header.toLowerCase()));
      const mapping = parsed.data.mapping
        ? parsed.data.mapping as ColumnMapping
        : defaultColumnMapping(headers);
      rows = csvRowsToPreview(parsed.data.text, mapping);
    }
    rows = await addDatabaseDuplicates(rows);
    const supported = rows.filter((row) => row.supported).length;
    const duplicates = rows.filter((row) => row.duplicate).length;
    return Response.json({
      rows,
      summary: {
        total: rows.length,
        supported,
        unsupported: rows.length - supported,
        duplicates,
        newItems: rows.filter((row) => row.supported && !row.duplicate).length,
        plannedFields: ["公開名（仮）", "ソース種別", "ソースURL", "ポートフォリオURL", "調査状態"],
        excludedColumns,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "プレビューを作成できませんでした。" }, { status: 400 });
  }
}
