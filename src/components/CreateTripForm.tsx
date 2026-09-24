"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { createTrip, type CreateTripState } from "@/app/actions/trip";
import { CopyField } from "./CopyButton";

const FRIEND_PLACEHOLDERS = ["Siddharth", "Karan", "Aisha", "Preethi"];

export function CreateTripForm({ defaultDeadline }: { defaultDeadline: string }) {
  const [state, action, pending] = useActionState<CreateTripState, FormData>(createTrip, {});
  const [coordinator, setCoordinator] = useState("Riya");

  if (state.created) {
    const { groupUrl, adminUrl, slug } = state.created;
    return (
      <div className="space-y-4">
        <div className="card space-y-2">
          <h2 className="text-lg font-semibold">Trip created 🎉</h2>
          <p className="text-sm text-slate-600">
            Paste this <strong>one link</strong> in your WhatsApp group. Nobody needs an account.
          </p>
          <CopyField value={groupUrl} label="Copy link" />
        </div>

        <div className="card space-y-2 border-amber-300 bg-amber-50">
          <h2 className="font-semibold text-amber-900">⚠️ Save this link. It&apos;s your coordinator key.</h2>
          <p className="text-sm text-amber-900">
            This is the only way into your review page (shortlist, publish, lock). It is shown{" "}
            <strong>once</strong> and can&apos;t be recovered. Don&apos;t share it with the group.
          </p>
          <CopyField value={adminUrl} label="Copy key link" />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className="btn-primary" href={`/t/${slug}`}>
            Fill in my preferences →
          </Link>
          <a className="btn-secondary" href={adminUrl}>
            Open coordinator page
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        // Submit via a transition so React doesn't reset the fields on error.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <div>
        <label className="label" htmlFor="tripName">Trip name</label>
        <input id="tripName" name="tripName" className="input" required maxLength={80} placeholder="College gang trip 2026" />
      </div>

      <div>
        <label className="label" htmlFor="coordinatorName">Your name (coordinator)</label>
        <input
          id="coordinatorName"
          name="coordinatorName"
          className="input"
          required
          maxLength={40}
          value={coordinator}
          onChange={(e) => setCoordinator(e.target.value)}
        />
      </div>

      <fieldset>
        <legend className="label">The 5 people going</legend>
        <div className="space-y-2">
          <input className="input" value={coordinator ? `${coordinator} (you)` : "You"} disabled aria-label="Participant 1 (you)" />
          {FRIEND_PLACEHOLDERS.map((p, i) => (
            <input
              key={p}
              name="friendNames"
              className="input"
              required
              maxLength={40}
              placeholder={p}
              aria-label={`Participant ${i + 2}`}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="deadlineLocal">Response deadline (IST)</label>
          <input id="deadlineLocal" name="deadlineLocal" type="datetime-local" className="input" required defaultValue={defaultDeadline} />
          <p className="hint">Options appear when all 5 submit or at this time.</p>
        </div>
        <div>
          <label className="label" htmlFor="tripNights">Trip length (nights)</label>
          <input id="tripNights" name="tripNights" type="number" inputMode="numeric" min={1} max={30} defaultValue={3} className="input" required />
        </div>
      </div>

      {state.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{state.error}</p>}

      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Creating…" : "Create trip & get the link"}
      </button>
    </form>
  );
}
