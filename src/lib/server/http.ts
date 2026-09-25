import "server-only";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** GET JSON with a hard timeout. */
export async function fetchJson<T>(
  url: string | URL,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const res = await fetch(url, {
    headers: opts.headers,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new HttpError(`HTTP ${res.status} from ${new URL(url).host}`, res.status);
  return (await res.json()) as T;
}

/** Map with bounded concurrency; each item's failure becomes null. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i], i);
      } catch (e) {
        console.error(`[mapLimit] item ${i} failed: ${e instanceof Error ? e.message : e}`);
        out[i] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
