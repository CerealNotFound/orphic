// Cloudinary as private storage for large saved files. Assets are uploaded as type "authenticated" (not publicly
// reachable) and served through short-lived signed download URLs that only Orphic generates.
import { createHash } from "node:crypto";

export type CloudinaryAsset = { public_id: string; resource_type: "image" | "video" | "raw"; format: string; version: number; bytes: number };

const cfg = () => ({
  cloud: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  key: process.env.CLOUDINARY_API_KEY ?? "",
  secret: process.env.CLOUDINARY_API_SECRET ?? "",
});

export const cloudinaryConfigured = () => {
  const c = cfg();
  return Boolean(c.cloud && c.key && c.secret);
};

/** Cloudinary API signature: sha1 of the sorted params (excluding file, api_key, resource_type) + secret. */
export function signParams(params: Record<string, string | number>): string {
  const toSign = Object.keys(params)
    .filter((k) => !["file", "api_key", "resource_type", "cloud_name"].includes(k) && params[k] !== "" && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + cfg().secret).digest("hex");
}

/** Short-lived download link for a private asset (default 1 hour). */
export function privateDownloadUrl(a: Pick<CloudinaryAsset, "public_id" | "resource_type" | "format">, expiresInSec = 3600): string {
  const c = cfg();
  const params: Record<string, string | number> = {
    public_id: a.public_id,
    format: a.format,
    type: "authenticated",
    timestamp: Math.floor(Date.now() / 1000),
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
  };
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: c.key, signature: signParams(params) });
  return `https://api.cloudinary.com/v1_1/${c.cloud}/${a.resource_type}/download?${qs}`;
}
