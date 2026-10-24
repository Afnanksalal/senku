import ResearchWorkspace from '../ResearchWorkspace';
export default async function InvestigationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResearchWorkspace investigationId={id} />;
}
