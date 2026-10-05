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

export async function fetchWithRetry(url: string, init: RequestInit, label = url): Promise<Response> {
  const method = init.method ?? "GET";
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { "user-agent": USER_AGENT, ...init.headers },
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (res?.ok) return res;
    if (attempt === MAX_ATTEMPTS || (res && !RETRYABLE_STATUSES.has(res.status))) {
      throw new Error(`${method} ${label} failed: ${res?.status ?? "network error"}`);
    }
    await sleep(retryDelayMs(res, attempt));
  }
}

export async function fetchJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetchWithRetry(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await res.json()) as T;
}
