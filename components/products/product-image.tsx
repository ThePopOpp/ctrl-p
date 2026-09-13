// ─── ProductImage ───────────────────────────────────────────────────────────
//
// A card's image can point at two very different places:
//   · a licensed asset uploaded to our own Supabase storage — the published case
//   · a vendor's own CDN URL, captured as internal reference on a draft
//
// next/image only accepts hosts declared in next.config's remotePatterns, and
// wildcarding that list would turn the site into an open image proxy. So the
// optimizer is used for our own storage host and a plain <img> covers the rest.
// A draft still previews correctly in the dashboard; a published card is on our
// host and gets the full treatment.

import Image from "next/image";

const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

export function isOptimizable(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("/")) return true;
  try {
    return Boolean(SUPABASE_HOST) && new URL(src).hostname === SUPABASE_HOST;
  } catch {
    return false;
  }
}

type Props = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
};

/** Fills its positioned parent, like `next/image` with `fill`. */
export function ProductImage({ src, alt, sizes, className, priority = false }: Props) {
  if (isOptimizable(src)) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`absolute inset-0 h-full w-full ${className ?? ""}`}
    />
  );
}
