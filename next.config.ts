import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
