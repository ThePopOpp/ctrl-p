import { OpportunityWorkspace } from "@/components/admin/pipeline/opportunity-workspace";

export default async function AdminOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OpportunityWorkspace id={id} />;
}
