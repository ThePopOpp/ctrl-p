// ─── Card image URLs ────────────────────────────────────────────────────────
//
// A card image's `storage_path` is one of two things:
//   · a path inside our Supabase `artwork` bucket — the licensed, published case
//   · an absolute vendor CDN URL, captured as reference while the card is a draft
//
// Both have to render, in server components and in the dashboard alike, so this
// helper is deliberately free of any Supabase import — it reads only the public
// env var and is safe to pull into a client bundle.

const IMAGE_BUCKET = "artwork";

export function imageUrl(storagePath: string): string {
  if (!storagePath) return "";
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  if (storagePath.startsWith("data:")) return storagePath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${IMAGE_BUCKET}/${storagePath.replace(/^\/+/, "")}`;
}
