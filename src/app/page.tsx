"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_QUESTIONS, MIN_QUESTIONS } from "@/domain/schemas/generatedQuiz.schema";
import { ApiRequestError, fetchStrategies, generateQuiz } from "./_lib/api";
import type { Strategy } from "./_lib/types";

const PRESET_READMES = [
  {
    label: "Pipecat README",
    url: "https://github.com/pipecat-ai/pipecat/blob/main/README.md",
  },
  {
    label: "LangChain.js README",
    url: "https://github.com/langchain-ai/langchainjs/blob/main/README.md",
  },
];

export default function HomePage() {
  const router = useRouter();

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [strategyId, setStrategyId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStrategies()
      .then((list) => {
        setStrategies(list);
        setStrategyId((current) => current || list[0]?.id || "");
      })
      .catch(() => setError("Could not load strategies. Is the server running?"));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!sourceUrl.trim()) {
      setError("Please provide a source URL.");
      return;
    }

    setSubmitting(true);
    try {
      const quiz = await generateQuiz({
        sourceUrl: sourceUrl.trim(),
        topic: topic.trim() || null,
        strategy: strategyId,
        numQuestions,
      });
      router.push(`/quiz/${quiz.id}`);
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Failed to generate quiz.";
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">AI Quiz Agent</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Generate a short multiple-choice quiz from any Markdown README, then take it and see your score.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <div>
            <label htmlFor="sourceUrl" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Source Markdown URL
            </label>
            <input
              id="sourceUrl"
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://github.com/org/repo/blob/main/README.md"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESET_READMES.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => setSourceUrl(preset.url)}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Focus topic <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. installation and configuration"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="numQuestions" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Questions
              </label>
              <select
                id="numQuestions"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {Array.from({ length: MAX_QUESTIONS - MIN_QUESTIONS + 1 }, (_, i) => MIN_QUESTIONS + i).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="strategy" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Strategy
              </label>
              <select
                id="strategy"
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              {strategies.find((s) => s.id === strategyId) && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {strategies.find((s) => s.id === strategyId)?.description}
                </p>
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !strategyId}
            className="mt-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {submitting ? "Generating quiz… this can take up to a minute" : "Generate Quiz"}
          </button>
        </form>
      </main>
    </div>
  );
}
