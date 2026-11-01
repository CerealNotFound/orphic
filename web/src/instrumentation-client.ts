// Product analytics (PostHog), loaded once in the browser before the page becomes interactive.
// Only runs when NEXT_PUBLIC_POSTHOG_KEY is set, so self-hosted copies of Orphic send nothing anywhere.
// One PostHog project covers adarshji.com and orphic.adarshji.com: the visitor cookie is shared across *.adarshji.com
// and every event carries `site`, so people can be split into "site only", "site → Orphic" and "Orphic only".
import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (key) {
  posthog.init(key, {
    api_host: "/ingest", // proxied through this site (next.config.ts) so ad blockers don't drop it
    ui_host: "https://us.posthog.com",
    defaults: "2026-08-30",
    person_profiles: "always", // anonymous visitors too, so "visited both sites" can be counted
    cross_subdomain_cookie: true,
    disable_session_recording: true,
  });
  posthog.register({ site: "orphic" });
}
