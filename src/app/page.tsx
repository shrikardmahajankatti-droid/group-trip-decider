import { connection } from "next/server";
import { CreateTripForm } from "@/components/CreateTripForm";
import Link from "next/link";
import { DEMO_ADMIN_KEY, DEMO_SLUG } from "@/lib/demo";
import { defaultDeadlineLocal } from "@/lib/logic/dates";

export default async function Home() {
  await connection(); // the default deadline depends on "now"
  const defaultDeadline = defaultDeadlineLocal();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Group Trip Decider</h1>
        <p className="text-slate-600">
          One link for the group. Everyone submits budget, dates and hard no&apos;s in about 3
          minutes. You get 3 options showing where each person stands, the group votes once, and you
          lock it.
        </p>
      </header>
      <section className="card space-y-3 border-indigo-200 bg-indigo-50/50">
        <h2 className="font-semibold">🎬 Try the demo trip</h2>
        <p className="text-sm text-slate-600">
          Riya, Siddharth, Karan and Aisha have already answered. Preethi hasn&apos;t. Open both views side by side:
          submit as Preethi to trigger the options, then review, publish, vote and lock as Riya.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link className="btn-primary" href={`/t/${DEMO_SLUG}`}>
            Friend&apos;s view (group link)
          </Link>
          <Link className="btn-secondary" href={`/t/${DEMO_SLUG}/admin?k=${DEMO_ADMIN_KEY}`}>
            Riya&apos;s coordinator view
          </Link>
        </div>
      </section>

      <h2 className="pt-2 text-lg font-semibold">Or create your own trip</h2>
      <CreateTripForm defaultDeadline={defaultDeadline} />
    </div>
  );
}
