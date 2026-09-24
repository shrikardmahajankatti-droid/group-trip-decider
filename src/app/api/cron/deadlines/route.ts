import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/server/env";
import { claimGeneration } from "@/lib/server/generation";
import { db } from "@/lib/server/db";
import { runPipeline } from "@/lib/server/pipeline";
import type { Trip } from "@/lib/server/trips";

export const maxDuration = 300;

function authorized(header: string | null) {
  const expected = Buffer.from(`Bearer ${env.cronSecret()}`);
  const got = Buffer.from(header ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Daily backstop (Vercel Cron): start generation for trips past their deadline. */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data, error } = await db()
    .from("trips")
    .select("*")
    .eq("status", "collecting")
    .lte("deadline", new Date().toISOString());
  if (error) return Response.json({ error: "query failed" }, { status: 500 });

  const claimed: string[] = [];
  for (const trip of (data ?? []) as Trip[]) {
    if (await claimGeneration(trip)) claimed.push(trip.id);
  }
  await Promise.allSettled(claimed.map((id) => runPipeline(id)));
  return Response.json({ checked: data?.length ?? 0, triggered: claimed.length });
}
