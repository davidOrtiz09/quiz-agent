import QuizClient from "./QuizClient";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizClient quizId={id} />;
}
