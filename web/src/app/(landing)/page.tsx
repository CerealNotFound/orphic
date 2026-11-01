import type { Metadata } from "next";
import { Gloock } from "next/font/google";
import { env } from "@/lib/env";
import { getLandingData, exampleSearches } from "@/lib/landing";
import { buildIndex, searchCatalogue } from "@/lib/catalogue-search";
import { catalogueIndex } from "@/lib/public-catalogue";
import { AnyAI } from "./_sections/any-ai";
import { CatalogueDemo } from "./_sections/catalogue-demo";
import { CommentStrike } from "./_sections/comment-strike";
import { Hero } from "./_sections/hero";
import { HowItWorks } from "./_sections/how-it-works";
import { Nav } from "./_sections/nav";
import { Footer, OpenSource } from "./_sections/open-source";
import { StructuredData } from "./structured-data";
import "./landing.css";

const display = Gloock({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  alternates: { canonical: "/", types: { "text/markdown": "/llms.txt" } },
  keywords: ["AI tools", "Instagram reels", "AI tool directory", "open source", "llms.txt"],
  title: "Orphic: reels in, real links out",
  description:
    "Share an Instagram reel. Orphic reads every frame, finds the AI tool behind it and verifies the official link, even when the creator says “comment SKILL”. Free, open source, no login.",
  openGraph: {
    title: "Orphic: reels in, real links out",
    description: "Every AI tool from every reel, found and verified. Free, open source, searchable by anyone or any AI.",
    type: "website",
    siteName: "Orphic",
  },
  twitter: { card: "summary_large_image", title: "Orphic: reels in, real links out" },
};

export default async function Welcome() {
  const [data, entries, placeholders] = await Promise.all([getLandingData(), catalogueIndex(), exampleSearches()]);
  const videoAds = searchCatalogue(buildIndex(entries), "video ads");
  const aiSample = { total: videoAds.length, items: videoAds.slice(0, 3) };
  const example = data.heroExamples[0] ?? data.items[0];
  return (
    <div id="top" className={`lp ${display.variable} min-h-full`}>
      <StructuredData />
      <Nav />
      <main>
        <Hero examples={data.heroExamples} stats={data.stats} />
        <CommentStrike keywords={data.keywords} stats={data.stats} />
        <div id="how">{example && <HowItWorks example={example} />}</div>
        <div id="catalogue">
          <CatalogueDemo entries={entries} categories={data.stats.categories} placeholders={placeholders} />
        </div>
        <div id="ai">
          <AnyAI sample={aiSample.total ? { query: "video ads", total: aiSample.total, items: aiSample.items.map((i) => ({ name: i.name, domain: i.domain })) } : null} />
        </div>
        <OpenSource />
      </main>
      <Footer />
    </div>
  );
}
