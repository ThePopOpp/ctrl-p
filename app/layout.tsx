import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ControlP.io",
  description: "Print management, orders, proofs, and customer communication — all in one workspace.",
  icons: {
    icon: [
      { url: "/logos/favicon.png", type: "image/png" },
      { url: "/logos/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/logos/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
