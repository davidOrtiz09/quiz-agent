import ResultClient from "./ResultClient";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultClient quizId={id} />;
}
