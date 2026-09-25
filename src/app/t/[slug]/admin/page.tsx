import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dropOption, lockTrip, publish, rerun, resetClaim } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CopyField } from "@/components/CopyButton";
import { Disclaimer } from "@/components/Disclaimer";
import { FitMatrix } from "@/components/FitMatrix";
import { MetricsPanel } from "@/components/MetricsPanel";
import { OptionCard } from "@/components/OptionCard";
import { SubmissionCounter } from "@/components/SubmissionCounter";
import { WhatsAppShare } from "@/components/WhatsAppShare";
import { formatInr, formatWindow } from "@/lib/format";
import { formatIST, hasPassed } from "@/lib/logic/dates";
import { baseUrl } from "@/lib/server/auth";
import { recoverStuckGeneration, triggerIfDue } from "@/lib/server/generation";
import { getMetrics } from "@/lib/server/metrics";
import { getShortlist } from "@/lib/server/shortlist";
import { getParticipantsWithStatus, getTripBySlug, isAdmin } from "@/lib/server/trips";
import { lockMessage } from "@/lib/whatsapp";

export const maxDuration = 300;
export const metadata: Metadata = { robots: { index: false, follow: false } };

const STATUS_LABEL: Record<string, string> = {
  collecting: "Collecting answers",
  generating: "Generating options",
  review: "Waiting for your review",
  published: "Published to the group",
  locked: "Locked",
};

const RERUN_CONFIRM = "This takes the options back from the group and clears all votes. Continue?";

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

  const [participants, shortlist] = await Promise.all([getParticipantsWithStatus(trip.id), getShortlist(trip.id)]);
  const metrics = await getMetrics(trip, participants);
  const groupUrl = `${await baseUrl()}/t/${slug}`;
  const deadlinePassed = hasPassed(trip.deadline);
  const people = participants.map((p) => ({ id: p.id, name: p.name }));
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "?";
  const run = shortlist?.run;
  const showShortlist = shortlist && ["review", "published", "locked"].includes(trip.status);
  const winner = trip.locked_option_id ? shortlist?.options.find((o) => o.id === trip.locked_option_id) : undefined;
  const totalVotes = shortlist?.options.reduce((n, o) => n + o.votes, 0) ?? 0;
  const c = shortlist?.constraints;

  return (
    <div className="space-y-5">
      <AutoRefresh seconds={trip.status === "generating" ? 8 : 20} />
      <header className="space-y-1">
        <p className="text-sm font-medium text-indigo-700">Coordinator view · only you can see this</p>
        <h1 className="text-2xl font-bold tracking-tight">{trip.name}</h1>
        <p className="text-sm text-slate-600">
          {STATUS_LABEL[trip.status]} · Deadline {formatIST(trip.deadline)} · {trip.trip_nights} nights
        </p>
      </header>

      {run?.status === "stale" && (trip.status === "review" || trip.status === "published") && (
        <div className="space-y-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <p>Someone edited their answers after these options were generated. Re-run to include the change.</p>
          <ActionButton
            action={rerun.bind(null, slug, key)}
            label="Re-run with the latest answers"
            pendingLabel="Starting…"
            confirm={trip.status === "published" ? RERUN_CONFIRM : undefined}
          />
        </div>
      )}
      {run?.status === "failed" && trip.status === "review" && (
        <div className="space-y-2 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          <p>Generation failed: {run.error ?? "unknown error"}</p>
          <ActionButton action={rerun.bind(null, slug, key)} label="Re-run" pendingLabel="Starting…" />
        </div>
      )}

      {trip.status === "generating" && (
        <p className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          Generating options… This takes a minute or two. The page refreshes by itself.
        </p>
      )}
      {trip.status === "collecting" && (
        <p className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          Options are generated automatically when everyone has submitted or at the deadline.
        </p>
      )}

      {showShortlist && (
        <>
          {trip.status === "review" && (
            <section className="card space-y-3 border-indigo-300">
              <h2 className="text-lg font-semibold">◆ Your review</h2>
              <p className="text-sm text-slate-600">
                Nobody else can see these yet. Drop any option you don&apos;t want (the next best one takes its
                place), re-run from scratch, or publish to the group.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <ActionButton
                  action={publish.bind(null, slug, key)}
                  label="Publish to group"
                  pendingLabel="Publishing…"
                  confirm="Publish these options? Your group will see them and can vote."
                />
                <ActionButton
                  action={rerun.bind(null, slug, key)}
                  label="Re-run everything"
                  pendingLabel="Starting…"
                  className="btn-secondary"
                />
              </div>
            </section>
          )}

          {trip.status === "published" && (
            <section className="card space-y-2">
              <h2 className="text-lg font-semibold">
                Voting · {totalVotes} of {participants.length} voted
              </h2>
              <p className="text-sm text-slate-600">
                When you&apos;re ready, lock the winning option below. After that, nothing can change.
              </p>
              <ActionButton
                action={rerun.bind(null, slug, key)}
                label="Re-run (takes options back, clears votes)"
                pendingLabel="Starting…"
                className="btn-secondary"
                confirm={RERUN_CONFIRM}
              />
            </section>
          )}

          {trip.status === "locked" && winner && (
            <>
              <p className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-900">
                🔒 Locked: {winner.card?.title ?? winner.candidate.data.name} ·{" "}
                {formatWindow(winner.candidate.data.suggested_window)}
              </p>
              <WhatsAppShare
                message={lockMessage({
                  tripName: trip.name,
                  destination: winner.candidate.data,
                  costs: winner.candidate.costs,
                  people,
                  url: groupUrl,
                })}
              />
            </>
          )}

          {shortlist.options.length === 0 ? (
            <p className="card text-sm">
              Every candidate broke at least one person&apos;s hard &quot;won&apos;t do&quot;, so there are no options
              to show. See the removed destinations below, then re-run.
            </p>
          ) : (
            shortlist.options.length < 3 && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Only {shortlist.options.length} destination{shortlist.options.length > 1 ? "s" : ""} survived
                everyone&apos;s hard &quot;won&apos;t do&quot; list, so you&apos;re seeing fewer than 3 options.
              </p>
            )
          )}

          <div className="space-y-4">
            {shortlist.options.map((o) => (
              <OptionCard key={o.id} option={o} people={people} showAllLines>
                {trip.status === "review" && (
                  <ActionButton
                    action={dropOption.bind(null, slug, key, o.id)}
                    label="Drop this option"
                    pendingLabel="Replacing…"
                    className="btn-danger"
                    confirm={`Drop ${o.candidate.data.name}? The next best destination will take its place.`}
                  />
                )}
                {trip.status === "published" && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="shrink-0 text-sm font-semibold">
                      {o.votes} vote{o.votes === 1 ? "" : "s"}
                    </p>
                    <ActionButton
                      action={lockTrip.bind(null, slug, key, o.id)}
                      label="Lock this option"
                      pendingLabel="Locking…"
                      confirm={`Lock ${o.candidate.data.name}? Nobody can edit or vote after this.`}
                    />
                  </div>
                )}
                {trip.status === "locked" && (
                  <p className="text-sm font-semibold">
                    {o.votes} vote{o.votes === 1 ? "" : "s"}
                    {o.id === trip.locked_option_id ? " · 🔒 Winner" : ""}
                  </p>
                )}
              </OptionCard>
            ))}
          </div>

          {shortlist.options.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold">Fit matrix</h2>
              <FitMatrix
                rows={people}
                cols={shortlist.options.map((o) => ({
                  id: o.id,
                  label: o.candidate.data.name,
                  scores: o.candidate.scores ?? {},
                }))}
              />
            </section>
          )}

          {c && (
            <section className="card space-y-2 text-sm">
              <h2 className="font-semibold">What the options are based on</h2>
              <ul className="list-inside list-disc space-y-1 text-slate-700">
                <li>Budget floor (lowest cap): {c.budgetFloorInr !== null ? formatInr(c.budgetFloorInr) : "—"}</li>
                <li>
                  Date windows: {c.windows.map((w) => formatWindow(w)).join("; ") || "none"}
                  {!c.fullOverlap && c.windows[0] && (
                    <> (no window fits everyone; left out: {c.windows[0].excludedIds.map(nameOf).join(", ")})</>
                  )}
                </li>
                <li>
                  Hard no&apos;s:{" "}
                  {c.hardNos.map((h) => `${h.tag} (${h.participantIds.map(nameOf).join(", ")})`).join("; ") || "none"}
                </li>
                {c.noDataIds.length > 0 && <li>No data: {c.noDataIds.map(nameOf).join(", ")}</li>}
              </ul>
              {c.notes.length > 0 && (
                <div>
                  <p className="font-semibold">Free-text notes (not enforced automatically)</p>
                  <ul className="space-y-1 text-slate-700">
                    {c.notes.map((n) => (
                      <li key={n.participantId}>
                        <strong>{nameOf(n.participantId)}:</strong> {n.note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section className="card space-y-2 text-sm">
            <h2 className="font-semibold">Removed by hard veto ({shortlist.vetoed.length})</h2>
            {shortlist.vetoed.length === 0 ? (
              <p className="text-slate-600">No candidate broke anyone&apos;s hard &quot;won&apos;t do&quot;.</p>
            ) : (
              <ul className="space-y-1">
                {shortlist.vetoed.map((v) => (
                  <li key={v.id}>
                    <strong>{v.data.name}</strong>:{" "}
                    {(v.veto_reasons ?? []).map((r) => `${r.name} won't do ${r.tag}`).join("; ")}
                  </li>
                ))}
              </ul>
            )}
            {shortlist.reserve.length > 0 && (
              <p className="text-slate-600">
                Next in line if you drop one:{" "}
                {shortlist.reserve.map((r) => `${r.data.name} (lowest fit ${r.min_score})`).join(", ")}
              </p>
            )}
          </section>

          <Disclaimer />
        </>
      )}

      <MetricsPanel m={metrics} />

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
          Reset a claim if someone switched phones. Their answers are kept, and they just pick their name again.
        </p>
      </section>
    </div>
  );
}
