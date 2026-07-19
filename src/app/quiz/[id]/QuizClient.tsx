"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchQuiz, submitQuiz } from "../../_lib/api";
import type { ApiQuiz } from "../../_lib/types";

export default function QuizClient({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<ApiQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuiz(quizId)
      .then((data) => {
        if (data.status === "COMPLETED") {
          router.replace(`/result/${quizId}`);
          return;
        }
        setQuiz(data);
      })
      .catch(() => setError("Could not load this quiz."))
      .finally(() => setLoading(false));
  }, [quizId, router]);

  function selectSingle(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: [optionId] }));
  }

  function toggleMultiple(questionId: string, optionId: string) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [questionId]: next };
    });
  }

  async function handleSubmit() {
    if (!quiz) return;
    setSubmitting(true);
    setError(null);
    try {
      const answerList = quiz.questions.map((question) => ({
        questionId: question.id,
        selectedOptionIds: answers[question.id] ?? [],
      }));
      await submitQuiz(quizId, answerList);
      router.push(`/result/${quizId}`);
    } catch {
      setError("Failed to submit your answers. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <CenteredMessage>Loading quiz…</CenteredMessage>;
  }

  if (error && !quiz) {
    return <CenteredMessage>{error}</CenteredMessage>;
  }

  if (!quiz) {
    return null;
  }

  const answeredCount = quiz.questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <main className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Quiz</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {quiz.sourceUrl} · {quiz.questions.length} questions · {answeredCount}/{quiz.questions.length} answered
          </p>
        </header>

        <ol className="flex flex-col gap-6">
          {quiz.questions.map((question, index) => (
            <li
              key={question.id}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {index + 1}. {question.text}
                {question.type === "MULTIPLE" && (
                  <span className="ml-2 text-xs font-normal text-zinc-500">(select all that apply)</span>
                )}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {question.options.map((option) => {
                  const selected = (answers[question.id] ?? []).includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        selected
                          ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <input
                        type={question.type === "SINGLE" ? "radio" : "checkbox"}
                        name={question.id}
                        checked={selected}
                        onChange={() =>
                          question.type === "SINGLE"
                            ? selectSingle(question.id, option.id)
                            : toggleMultiple(question.id, option.id)
                        }
                        className="h-4 w-4"
                      />
                      <span className="text-zinc-800 dark:text-zinc-200">{option.text}</span>
                    </label>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? "Submitting…" : "Submit answers"}
        </button>
      </main>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 text-sm text-zinc-600 dark:bg-black dark:text-zinc-400">
      {children}
    </div>
  );
}
