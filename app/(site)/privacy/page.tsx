import type { Metadata } from "next";

import { LegalArticle } from "@/components/legal/legal-article";
import { loadLegalDoc } from "@/lib/legal";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy Policy — Ctrl+P",
  description: "How ControlP.io collects, uses, discloses, and protects your information, including SMS/MMS messaging privacy.",
};

export default function PrivacyPage() {
  return <LegalArticle {...loadLegalDoc("controlp-privacy-policy.md")} />;
}
