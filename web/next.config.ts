import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The landing page used to live at /welcome; it's the home page now.
  async redirects() {
    return [{ source: "/welcome", destination: "/", permanent: true }];
  },
  // Agent pages: Markdown versions of the catalogue (see src/lib/agent-pages.ts). Also served when an agent asks
  // for Markdown on the normal page (Accept: text/markdown), so it never has to parse the HTML.
  async rewrites() {
    const wantsMd = [{ type: "header" as const, key: "accept", value: "(.*)text/markdown(.*)" }];
    return {
      beforeFiles: [
        { source: "/explore.md", destination: "/md/explore" },
        { source: "/explore/category/:category([a-z0-9-]+)\\.md", destination: "/md/category/:category" },
        { source: "/explore/:slug([a-z0-9-]+)\\.md", destination: "/md/tool/:slug" },
        { source: "/explore", has: wantsMd, destination: "/md/explore" },
        { source: "/explore/:slug([a-z0-9-]+)", has: wantsMd, destination: "/md/tool/:slug" },
        { source: "/", has: wantsMd, destination: "/llms.txt" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
