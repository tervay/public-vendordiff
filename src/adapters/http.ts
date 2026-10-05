const USER_AGENT = "frc-vendordiff/1.0";
const MAX_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MS = 30_000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const retryDelayMs = (res: Response | null, attempt: number) => {
  const retryAfterSeconds = Number(res?.headers.get("retry-after"));
  const delay = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 2 ** attempt * 500;
  return Math.min(delay, MAX_RETRY_DELAY_MS);
};

export async function fetchJson<T>(url: string, body?: unknown): Promise<T> {
  const method = body === undefined ? "GET" : "POST";
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method,
      headers: { "user-agent": USER_AGENT, accept: "application/json", "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (res?.ok) return (await res.json()) as T;
    if (attempt === MAX_ATTEMPTS || (res && !RETRYABLE_STATUSES.has(res.status))) {
      throw new Error(`${method} ${url} failed: ${res?.status ?? "network error"}`);
    }
    await sleep(retryDelayMs(res, attempt));
  }
}
