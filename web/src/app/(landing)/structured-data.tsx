import { env } from "@/lib/env";
import { allPublicItems } from "@/lib/public-catalogue";

export async function StructuredData() {
  const base = env.APP_URL;
  const items = (await allPublicItems()).slice(0, 20);
  const graph = [
    {
      "@type": "WebSite",
      "@id": `${base}/#website`,
      url: base,
      name: "Orphic",
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${base}/explore?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
    { "@type": "Organization", "@id": `${base}/#org`, name: "Orphic", url: base, logo: `${base}/icon.svg` },
    {
      "@type": "SoftwareApplication",
      name: "Orphic",
      url: base,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      isAccessibleForFree: true,
      license: "https://opensource.org/licenses/MIT",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "ItemList",
      name: "AI tools found in Instagram reels",
      numberOfItems: items.length,
      itemListElement: items.map((i, n) => ({ "@type": "ListItem", position: n + 1, name: i.name, url: i.url, description: i.summary })),
    },
  ];
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
