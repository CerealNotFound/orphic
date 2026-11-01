import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { publicSlugs } from "@/lib/public-catalogue";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL;
  const slugs = await publicSlugs().catch(() => [] as string[]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/explore`, changeFrequency: "daily", priority: 0.9 },
    ...slugs.map((s) => ({ url: `${base}/explore/${s}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    { url: `${base}/llms.txt`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/llms-full.txt`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/api/public/openapi.json`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
