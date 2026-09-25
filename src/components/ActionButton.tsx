"use client";

import { useActionState } from "react";

type State = { error?: string; ok?: string | boolean };

/** A one-click server action with an optional confirm and inline result. */
export function ActionButton({
  action,
  label,
  pendingLabel = "Working…",
  confirm,
  className = "btn-primary",
}: {
  action: (prev: State) => Promise<State>;
  label: string;
  pendingLabel?: string;
  confirm?: string;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="space-y-1"
    >
      <button className={`${className} w-full`} disabled={pending}>
        {pending ? pendingLabel : label}
      </button>
      {state.error && <p className="text-xs text-red-700" role="alert">{state.error}</p>}
      {typeof state.ok === "string" && <p className="text-xs text-emerald-700" role="status">{state.ok}</p>}
    </form>
  );
}
