// Worker-side upload of large saved files to Cloudinary (private, type "authenticated").
import { readFileSync } from "node:fs";
import { signParams, type CloudinaryAsset } from "../src/lib/cloudinary";

export const cloudReady = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

/** Share of the Cloudinary plan's monthly credits already used (0-1), or null if it can't be read. */
export async function cloudUsageShare(): Promise<number | null> {
  try {
    const auth = Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString("base64");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/usage`, { headers: { authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(15_000) });
    const j = (await res.json()) as { credits?: { usage?: number; limit?: number } };
    return j.credits?.limit ? (j.credits.usage ?? 0) / j.credits.limit : null;
  } catch {
    return null;
  }
}

export function resourceTypeFor(mime: string, name: string): CloudinaryAsset["resource_type"] {
  if (mime.startsWith("audio/") || mime.startsWith("video/") || /\.(wav|mp3|m4a|aac|flac|ogg|aiff?|mp4|mov|webm)$/i.test(name)) return "video";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|pdf)$/i.test(name)) return "image";
  return "raw";
}

/** Uploads either a remote URL (Cloudinary fetches it) or a local file path. */
export async function uploadToCloudinary(source: { url?: string; path?: string }, publicId: string, resourceType: CloudinaryAsset["resource_type"]): Promise<CloudinaryAsset> {
  const params: Record<string, string | number> = { public_id: publicId, type: "authenticated", timestamp: Math.floor(Date.now() / 1000), overwrite: "false" };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));
  form.append("api_key", process.env.CLOUDINARY_API_KEY!);
  form.append("signature", signParams(params));
  if (source.url) form.append("file", source.url);
  else form.append("file", new Blob([new Uint8Array(readFileSync(source.path!))]), publicId.split("/").pop());
  const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(15 * 60_000),
  });
  const j = (await res.json()) as { public_id?: string; resource_type?: string; format?: string; version?: number; bytes?: number; error?: { message: string } };
  if (!res.ok || !j.public_id) throw new Error(`Cloudinary upload failed: ${j.error?.message ?? res.status}`);
  return { public_id: j.public_id, resource_type: j.resource_type as CloudinaryAsset["resource_type"], format: j.format ?? (publicId.split(".").pop() || "bin"), version: j.version ?? 0, bytes: j.bytes ?? 0 };
}
