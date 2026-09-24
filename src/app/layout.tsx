import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Group Trip Decider",
  description:
    "One link. Everyone's preferences. Three trip options with where each person stands.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-2xl px-4 py-6 text-xs text-slate-500">
          <p>
            Weather data by{" "}
            <a className="underline" href="https://open-meteo.com/">
              Open-Meteo.com
            </a>
            . Destination info from{" "}
            <a className="underline" href="https://en.wikivoyage.org/">
              Wikivoyage
            </a>{" "}
            (
            <a
              className="underline"
              href="https://creativecommons.org/licenses/by-sa/4.0/"
            >
              CC BY-SA
            </a>
            ). All costs are indicative.
          </p>
        </footer>
      </body>
    </html>
  );
}
