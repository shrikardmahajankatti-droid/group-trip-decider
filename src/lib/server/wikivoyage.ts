import "server-only";
import type { StoredWikivoyage } from "@/lib/pipelineTypes";
import { env } from "./env";
import { fetchJson } from "./http";

const API = "https://en.wikivoyage.org/w/api.php";

async function api<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", origin: "*", ...params })) {
    url.searchParams.set(k, v);
  }
  // MediaWiki policy: a descriptive User-Agent with contact info.
  return fetchJson<T>(url, { timeoutMs: 12_000, headers: { "User-Agent": env.wikivoyageUserAgent() } });
}

/** Light wikitext → text: keep link labels and listing fields, drop markup noise. */
export function cleanWikitext(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[\s\S]*?<\/ref>/g, "")
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+ ([^\]]*)\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/\{\{(?:marker|flag|IATA|seealso|see also)[^}]*\}\}/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function resolveTitle(query: string): Promise<string | null> {
  const direct = await api<{ query?: { pages?: { title: string; missing?: boolean }[] } }>({
    action: "query",
    titles: query,
    redirects: "1",
  });
  const page = direct.query?.pages?.[0];
  if (page && !page.missing) return page.title;
  const search = await api<{ query?: { search?: { title: string }[] } }>({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "1",
  });
  return search.query?.search?.[0]?.title ?? null;
}

async function sectionText(title: string, names: string[]): Promise<string> {
  const parsed = await api<{ parse?: { sections?: { line: string; index: string; toclevel: number }[] } }>({
    action: "parse",
    page: title,
    prop: "sections",
    redirects: "1",
  });
  const section = parsed.parse?.sections?.find(
    (s) => s.toclevel === 1 && names.includes(s.line.trim().toLowerCase()),
  );
  if (!section) return "";
  const wt = await api<{ parse?: { wikitext?: string } }>({
    action: "parse",
    page: title,
    section: section.index,
    prop: "wikitext",
    redirects: "1",
  });
  return cleanWikitext(wt.parse?.wikitext ?? "");
}

/** Intro extract + "Get in" section text for a destination, or null if no page. */
export async function getWikivoyage(query: string): Promise<(StoredWikivoyage & { sleep: string }) | null> {
  const title = await resolveTitle(query);
  if (!title) return null;

  const [extract, getIn, sleep] = await Promise.all([
    api<{ query?: { pages?: { extract?: string }[] } }>({
      action: "query",
      prop: "extracts",
      exintro: "1",
      explaintext: "1",
      titles: title,
      redirects: "1",
    }),
    sectionText(title, ["get in"]),
    sectionText(title, ["sleep"]),
  ]);

  return {
    title,
    url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    intro: (extract.query?.pages?.[0]?.extract ?? "").slice(0, 1200),
    getIn: getIn.slice(0, 8000),
    sleep: sleep.slice(0, 8000),
  };
}
