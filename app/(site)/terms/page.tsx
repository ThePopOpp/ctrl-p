import type { Metadata } from "next";

import { LegalArticle } from "@/components/legal/legal-article";
import { loadLegalDoc } from "@/lib/legal";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms of Service — Ctrl+P",
  description: "The terms governing your use of ControlP.io products, services, accounts, and SMS messaging.",
};

export default function TermsPage() {
  return <LegalArticle {...loadLegalDoc("controlp-terms-of-service.md")} />;
}
