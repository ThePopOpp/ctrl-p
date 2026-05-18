import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "controlp.io Admin",
  description: "controlp.io admin dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
