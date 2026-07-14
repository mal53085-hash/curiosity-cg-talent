import "server-only";

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return Boolean(origin && host && URL.canParse(origin) && new URL(origin).host === host);
}

export function containsPromptInjection(value: string) {
  return /(ignore\s+(all\s+)?previous|reveal\s+(the\s+)?system|system\s+prompt|api\s*key|前の指示を無視|システムプロンプト|秘密情報を表示)/i.test(value);
}
