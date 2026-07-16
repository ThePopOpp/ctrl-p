import type { ReactNode } from "react";

import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

/** Shared chrome (nav + footer) for all public/marketing pages. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      {children}
      <SiteFooter />
    </>
  );
}
