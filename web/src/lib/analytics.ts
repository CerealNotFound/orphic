"use client";
// Named product events (on top of PostHog's automatic page views and clicks). A no-op when analytics is off.
import posthog from "posthog-js";

export function track(event: string, props?: Record<string, unknown>) {
  if (posthog.__loaded) posthog.capture(event, props);
}
