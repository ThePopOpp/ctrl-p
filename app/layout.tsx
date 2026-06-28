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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('cp-theme');if(t==='dark')document.documentElement.classList.add('dark');else if(t==='light')document.documentElement.classList.remove('dark');else if(window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
      </head>
      <body className="overflow-x-hidden">{children}</body>
    </html>
  );
}
