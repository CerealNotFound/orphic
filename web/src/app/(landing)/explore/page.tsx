// /explore: the open catalogue. Anyone, no login. A fully prerendered page: the whole catalogue comes with it, and
// searching, filtering and ?q= / ?category= links are handled in the browser. No database work per visit.
import type { Metadata } from "next";
import { Gloock } from "next/font/google";
import { Suspense } from "react";
import { getLandingData, exampleSearches } from "@/lib/landing";
import { catalogueIndex } from "@/lib/public-catalogue";
import { CatalogueDemo } from "../_sections/catalogue-demo";
import { Nav } from "../_sections/nav";
import { Footer } from "../_sections/open-source";
import "../landing.css";

const display = Gloock({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "The open catalogue of AI tools from reels",
  description: "Every AI tool, skill, repo and prompt pack found in Instagram reels, each with a verified official link. Free, open, no login.",
  alternates: { canonical: "/explore", types: { "text/markdown": "/explore.md" } },
};

export default function Explore() {
  return (
    <div className={`lp ${display.variable} min-h-full`}>
      <Nav />
      <main className="pt-16">
        <Suspense fallback={<ExploreSkeleton />}>
          <Results />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

async function Results() {
  const [data, entries, placeholders] = await Promise.all([getLandingData(), catalogueIndex(), exampleSearches()]);
  return <CatalogueDemo variant="full" entries={entries} categories={data.stats.categories} placeholders={placeholders} />;
}

function ExploreSkeleton() {
  return (
    <section className="cd-section" aria-busy="true">
      <div className="lp-wrap">
        <p className="lp-label">The open catalogue</p>
        <div className="cd-skel-bar mt-6" style={{ height: 72, width: "60%" }} />
        <div className="cd-skel-bar mt-10" style={{ height: 64, width: "66%", borderRadius: 14 }} />
        <ul className="cd-list cd-skel mt-12">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="cd-skel-row" style={{ ["--i" as string]: i }}>
              <span className="cd-skel-bar" style={{ width: "30%", height: 16 }} />
              <span className="cd-skel-bar" style={{ width: "75%", height: 11, marginTop: 12 }} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
