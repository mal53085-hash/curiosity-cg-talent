import "server-only";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { DiscoverySourceType } from "@/types/discovery";

const maxHtmlBytes = 512 * 1024;
const timeoutMs = 7_000;

function isPrivateIp(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateIp(normalized.slice(7));
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) || parts[0] >= 224;
}

async function assertPublicUrl(input: string) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("公開http(s) URLだけを指定できます。");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local") || isIP(url.hostname) && isPrivateIp(url.hostname)) throw new Error("プライベートネットワークのURLは取得できません。");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error("公開ネットワークのURLではありません。");
  return url;
}

async function boundedText(response: Response) {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > maxHtmlBytes) throw new Error("ページ容量が上限を超えています。");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxHtmlBytes) { await reader.cancel(); throw new Error("ページ容量が上限を超えています。"); }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

async function safeFetch(input: string, accept: string) {
  let url = await assertPublicUrl(input);
  for (let redirects = 0; redirects <= 2; redirects += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept, "user-agent": "dig-discovery/1.0 (+human-reviewed talent research)" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === 2) throw new Error("リダイレクトが多すぎます。");
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    return { response, finalUrl: url };
  }
  throw new Error("ページを取得できませんでした。");
}

export async function fetchPublicImage(input: string) {
  const { response } = await safeFetch(input, "image/jpeg,image/png,image/webp");
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0];
  if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw new Error("対応する公開作品画像を取得できませんでした。");
  const length = Number(response.headers.get("content-length") ?? 0);
  const maxBytes = 8 * 1024 * 1024;
  if (length > maxBytes || !response.body) throw new Error("作品画像が8MBを超えています。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new Error("作品画像が8MBを超えています。"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { bytes, contentType: contentType as "image/jpeg" | "image/png" | "image/webp" };
}

function robotsAllows(robots: string, pathname: string) {
  const lines = robots.split(/\r?\n/).map((line) => line.replace(/#.*$/, "").trim());
  let applies = false;
  const disallows: string[] = [];
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") applies = value === "*";
    else if (key === "disallow" && applies && value) disallows.push(value);
  }
  return !disallows.some((path) => path === "/" || pathname.startsWith(path));
}

async function assertRobotsAllowed(url: URL) {
  try {
    const { response } = await safeFetch(new URL("/robots.txt", url.origin).toString(), "text/plain");
    if (response.status === 404) return;
    if (!response.ok) throw new Error("robots.txtを確認できません。");
    if (!robotsAllows(await boundedText(response), url.pathname)) throw new Error("robots.txtにより自動取得が許可されていません。");
  } catch (error) {
    if (error instanceof Error && error.message.includes("許可されていません")) throw error;
    throw new Error("robots.txtを安全に確認できないため、手入力してください。");
  }
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function meta(html: string, keys: string[]) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
    ];
    for (const pattern of patterns) { const match = html.match(pattern); if (match?.[1]) return decodeHtml(match[1]); }
  }
  return "";
}

export function identifySource(url: URL): DiscoverySourceType {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "behance.net" || host.endsWith(".behance.net")) return "behance";
  if (host === "artstation.com" || host.endsWith(".artstation.com")) return "artstation";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  return "website";
}

export async function previewPublicPage(input: string) {
  const url = await assertPublicUrl(input);
  const sourceType = identifySource(url);
  if (sourceType === "linkedin" || sourceType === "behance") {
    return {
      sourceType, title: "", authorName: "", description: "", thumbnailUrl: "", externalId: "", manualOnly: true,
      notice: sourceType === "linkedin" ? "LinkedInは自動取得しません。公開URLと必要な情報を手入力してください。" : "Behanceは無断スクレイピングを行いません。Recruiter Proまたは契約済み検索APIで確認した情報を入力してください。",
    };
  }
  await assertRobotsAllowed(url);
  const { response, finalUrl } = await safeFetch(url.toString(), "text/html,application/xhtml+xml");
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("text/html")) throw new Error("公開HTMLページを取得できませんでした。");
  const html = await boundedText(response);
  const title = meta(html, ["og:title", "twitter:title"]) || decodeHtml(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "");
  const thumbnail = meta(html, ["og:image", "twitter:image"]);
  return {
    sourceType,
    title: title.slice(0, 300),
    authorName: meta(html, ["author", "article:author"]).slice(0, 200),
    description: meta(html, ["og:description", "description", "twitter:description"]).slice(0, 5000),
    thumbnailUrl: thumbnail ? new URL(thumbnail, finalUrl).toString() : "",
    externalId: "",
    manualOnly: false,
  };
}
