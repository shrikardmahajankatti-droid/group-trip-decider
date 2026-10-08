import Link from "next/link";

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm ${className}`}>
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
        <circle cx="12" cy="11" r="2.2" />
      </svg>
    </span>
  );
}

const ROLE = {
  friend: { label: "Friend view", cls: "bg-emerald-100 text-emerald-800" },
  coordinator: { label: "Coordinator view", cls: "bg-amber-100 text-amber-800" },
} as const;

export function SiteHeader({ role }: { role?: keyof typeof ROLE }) {
  return (
    <header className="site-chrome sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Logo />
          <span className="hidden sm:inline">Group Trip Decider</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {role && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ROLE[role].cls}`}>{ROLE[role].label}</span>}
          <Link href="/demo" className="rounded-full px-3 py-1.5 font-medium text-indigo-700 hover:bg-indigo-50">
            ▶ Live demo
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Narrow app column used by the trip pages. */
export function AppShell({ role, children }: { role?: keyof typeof ROLE; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader role={role} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
