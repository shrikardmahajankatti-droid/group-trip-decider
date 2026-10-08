import type { Metadata } from "next";
import { DemoStudio } from "@/components/DemoStudio";
import { SiteHeader } from "@/components/SiteHeader";
import { DEMO_ADMIN_KEY, DEMO_SLUG } from "@/lib/demo";

export const metadata: Metadata = { title: "Demo studio · Group Trip Decider" };

export default function DemoPage() {
  return (
    <>
      <SiteHeader />
      <DemoStudio friendUrl={`/t/${DEMO_SLUG}`} riyaUrl={`/t/${DEMO_SLUG}/admin?k=${DEMO_ADMIN_KEY}`} />
    </>
  );
}
