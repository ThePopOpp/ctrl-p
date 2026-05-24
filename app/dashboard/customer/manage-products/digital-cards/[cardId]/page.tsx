import { CustomerDigitalCardBuilder } from "@/components/dashboard/customer-digital-card-builder";

export default async function EditDigitalCardPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <CustomerDigitalCardBuilder cardId={cardId} />;
}
