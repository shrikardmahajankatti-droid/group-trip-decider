"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card space-y-3">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-slate-600">
        That didn&apos;t load. Your answers are safe. Try again in a moment.
      </p>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link className="btn-secondary" href="/">
          Home
        </Link>
      </div>
    </div>
  );
}
