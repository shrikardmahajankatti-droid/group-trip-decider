import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resetClaim } from "@/app/actions/admin";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CopyField } from "@/components/CopyButton";
import { SubmissionCounter } from "@/components/SubmissionCounter";
import { formatIST, hasPassed } from "@/lib/logic/dates";
import { baseUrl } from "@/lib/server/auth";
import { recoverStuckGeneration, triggerIfDue } from "@/lib/server/generation";
import { getLatestRun, getParticipantsWithStatus, getTripBySlug, isAdmin } from "@/lib/server/trips";

export const maxDuration = 300;
export const metadata: Metadata = { robots: { index: false, follow: false } };

const STATUS_LABEL: Record<string, string> = {
  collecting: "Collecting answers",
  generating: "Generating options",
  review: "Waiting for your review",
  published: "Published to the group",
  locked: "Locked",
};

export default async function AdminPage({ params, searchParams }: PageProps<"/t/[slug]/admin">) {
  const { slug } = await params;
  const { k } = await searchParams;
  const key = typeof k === "string" ? k : "";

  let trip = await getTripBySlug(slug);
  if (!trip) notFound();
  if (!isAdmin(trip, key)) {
    return (
      <div className="card space-y-2">
        <h1 className="text-lg font-semibold">Coordinator key needed</h1>
        <p className="text-sm text-slate-600">
          This page needs the coordinator link you saved when you created the trip.
        </p>
      </div>
    );
  }

  trip = await recoverStuckGeneration(trip);
  if (await triggerIfDue(trip)) trip = { ...trip, status: "generating" };

  const [participants, run] = await Promise.all([
    getParticipantsWithStatus(trip.id),
    getLatestRun(trip.id),
  ]);
  const groupUrl = `${await baseUrl()}/t/${slug}`;
  const deadlinePassed = hasPassed(trip.deadline);

  return (
    <div className="space-y-5">
      <AutoRefresh seconds={20} />
      <header className="space-y-1">
        <p className="text-sm font-medium text-indigo-700">Coordinator view · only you can see this</p>
        <h1 className="text-2xl font-bold tracking-tight">{trip.name}</h1>
        <p className="text-sm text-slate-600">
          {STATUS_LABEL[trip.status]} · Deadline {formatIST(trip.deadline)} · {trip.trip_nights} nights
        </p>
      </header>

      {run?.status === "stale" && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Someone edited their answers after the options were generated. Re-run to include the change.
        </p>
      )}
      {run?.status === "failed" && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Generation failed: {run.error ?? "unknown error"}
        </p>
      )}

      <section className="card space-y-2">
        <h2 className="font-semibold">Group link</h2>
        <p className="text-sm text-slate-600">Paste this in WhatsApp. It&apos;s the only link friends need.</p>
        <CopyField value={groupUrl} label="Copy link" />
      </section>

      <SubmissionCounter participants={participants} deadlinePassed={deadlinePassed} />

      <section className="card space-y-3">
        <h2 className="font-semibold">People</h2>
        <ul className="divide-y divide-slate-100">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="font-medium">
                  {p.name}
                  {p.is_coordinator ? " (you)" : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {p.submitted ? `Submitted ${formatIST(p.submitted_at!)}` : "Not submitted"} ·{" "}
                  {p.claimed_at ? "name claimed" : "name not claimed"}
                </p>
              </div>
              {p.claimed_at && trip.status !== "locked" && (
                <form action={resetClaim.bind(null, slug, key, p.id)}>
                  <button className="btn-secondary text-xs">Reset claim</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <p className="hint">
          Reset a claim if someone switched phones. Their answers are kept, and they just pick their
          name again.
        </p>
      </section>
    </div>
  );
}
