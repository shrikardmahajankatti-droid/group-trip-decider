import { connection } from "next/server";
import { CreateTripForm } from "@/components/CreateTripForm";
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
      <CreateTripForm defaultDeadline={defaultDeadline} />
    </div>
  );
}
