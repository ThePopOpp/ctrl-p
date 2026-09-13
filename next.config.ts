import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Only our own storage host is optimizable. Product card images can also
  // point at a vendor's CDN while a card is still a draft; components/products/
  // product-image.tsx falls back to a plain <img> for those rather than
  // wildcarding this list, which would make the site an open image proxy.
  images: supabaseHost
    ? { remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] }
    : undefined,
  output: "standalone",
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: "/c/:slug*",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/login.html", destination: "/login", permanent: true },
      { source: "/register.html", destination: "/register", permanent: true },
      { source: "/forgot-password.html", destination: "/forgot-password", permanent: true },
      { source: "/new-password.html", destination: "/reset-password", permanent: true },
      { source: "/dashboard.html", destination: "/dashboard/customer", permanent: true },
      { source: "/admin-dashboard.html", destination: "/admin", permanent: true },
      { source: "/logout.html", destination: "/login", permanent: true },
    ];
  },
};

export default nextConfig;
