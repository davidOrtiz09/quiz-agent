"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QUESTION_MAX_SCORE } from "@/domain/services/scoring";
import { ApiRequestError, fetchQuizResult } from "../../_lib/api";
import type { ApiQuiz } from "../../_lib/types";

export default function ResultClient({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<ApiQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuizResult(quizId)
      .then(setQuiz)
      .catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.status === 409) {
          router.replace(`/quiz/${quizId}`);
          return;
        }
        setError("Could not load this quiz's result.");
      })
      .finally(() => setLoading(false));
  }, [quizId, router]);

  if (loading) {
    return <CenteredMessage>Loading result…</CenteredMessage>;
  }

  if (error || !quiz) {
    return <CenteredMessage>{error ?? "Result not found."}</CenteredMessage>;
  }

  const responseByQuestionId = new Map(quiz.responses.map((r) => [r.questionId, r]));
  const finalScore = quiz.finalScore ?? 0;
  const finalPercent = quiz.finalPercent ?? 0;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <main className="w-full max-w-2xl">
        <header className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Final score</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {finalScore.toFixed(2)} <span className="text-lg font-normal text-zinc-500">/ {QUESTION_MAX_SCORE}</span>
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{(finalPercent * 100).toFixed(1)}%</p>
        </header>

        <ol className="flex flex-col gap-6">
          {quiz.questions.map((question, index) => {
            const response = responseByQuestionId.get(question.id);
            const selected = new Set(response?.selectedOptionIds ?? []);
            const correctOptionIds = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));

            return (
              <li
                key={question.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {index + 1}. {question.text}
                  </p>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {response?.rawScore ?? 0}/{QUESTION_MAX_SCORE} pts · weight {question.weight.toFixed(2)}
                  </span>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {question.options.map((option) => {
                    const wasSelected = selected.has(option.id);
                    const isCorrect = correctOptionIds.has(option.id);
                    return (
                      <div
                        key={option.id}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${optionClasses(wasSelected, isCorrect)}`}
                      >
                        <span className="text-zinc-800 dark:text-zinc-200">{option.text}</span>
                        <span className="text-xs font-medium">
                          {isCorrect ? "Correct" : wasSelected ? "Your pick" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Take another quiz
          </Link>
        </div>
      </main>
    </div>
  );
}

function optionClasses(wasSelected: boolean, isCorrect: boolean): string {
  if (isCorrect && wasSelected) {
    return "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40";
  }
  if (isCorrect) {
    return "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20";
  }
  if (wasSelected) {
    return "border-red-400 bg-red-50 dark:bg-red-950/30";
  }
  return "border-zinc-200 dark:border-zinc-800";
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 text-sm text-zinc-600 dark:bg-black dark:text-zinc-400">
      {children}
    </div>
  );
}
