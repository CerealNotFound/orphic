import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  headers: [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      ],
    },
  ],
  crons: [
    // Weekly digest to the team group: Mondays 04:30 UTC (10:00 IST).
    { path: "/api/cron/digest", schedule: "30 4 * * 1" },
    // DM-link reminders: daily 06:30 UTC (12:00 IST).
    { path: "/api/cron/reminders", schedule: "30 6 * * *" },
  ],
};
