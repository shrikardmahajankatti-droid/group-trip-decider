import { DEMO_SLUG } from "@/lib/demo";
import { getShortlist } from "@/lib/server/shortlist";
import { getParticipantsWithStatus, getTripBySlug } from "@/lib/server/trips";

export const dynamic = "force-dynamic";

/** Live state of the public demo trip, for the /demo studio guide. Demo data only. */
export async function GET() {
  const trip = await getTripBySlug(DEMO_SLUG);
  if (!trip) return Response.json({ exists: false });

  const [participants, shortlist] = await Promise.all([getParticipantsWithStatus(trip.id), getShortlist(trip.id)]);
  const run = shortlist?.run ?? null;
  const locked = trip.locked_option_id ? shortlist?.options.find((o) => o.id === trip.locked_option_id) : undefined;

  return Response.json(
    {
      exists: true,
      status: trip.status,
      submitted: participants.filter((p) => p.submitted).length,
      total: participants.length,
      missing: participants.filter((p) => !p.submitted).map((p) => p.name),
      stage: run?.status === "running" ? run.stage : null,
      runFailed: run?.status === "failed",
      vetoed: run?.trace?.vetoed ?? [],
      options: shortlist?.options.map((o) => ({ name: o.candidate.data.name, votes: o.votes })) ?? [],
      votes: shortlist?.options.reduce((n, o) => n + o.votes, 0) ?? 0,
      locked: locked ? locked.candidate.data.name : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
