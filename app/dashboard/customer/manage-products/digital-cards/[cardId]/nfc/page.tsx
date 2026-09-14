import { DigitalCardNfcPhone } from "@/components/dashboard/digital-card-nfc-phone";

export default async function DigitalCardNfcPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <DigitalCardNfcPhone cardId={cardId} />;
}
