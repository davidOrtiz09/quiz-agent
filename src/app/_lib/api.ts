import type { ApiErrorBody, ApiQuiz, Strategy } from "./types";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  throw new ApiRequestError(
    body?.error?.message ?? `Request failed with status ${response.status}`,
    response.status,
    body?.error?.code ?? "UNKNOWN_ERROR",
  );
}

export async function fetchStrategies(): Promise<Strategy[]> {
  const res = await fetch("/api/strategies");
  const { strategies } = await parseOrThrow<{ strategies: Strategy[] }>(res);
  return strategies;
}

export interface GenerateQuizPayload {
  sourceUrl: string;
  topic: string | null;
  strategy: string;
  numQuestions: number;
}

export async function generateQuiz(payload: GenerateQuizPayload): Promise<ApiQuiz> {
  const res = await fetch("/api/quizzes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseOrThrow<ApiQuiz>(res);
}

export async function fetchQuiz(id: string): Promise<ApiQuiz> {
  const res = await fetch(`/api/quizzes/${id}`);
  return parseOrThrow<ApiQuiz>(res);
}

export interface SubmitAnswer {
  questionId: string;
  selectedOptionIds: string[];
}

export async function submitQuiz(id: string, answers: SubmitAnswer[]): Promise<ApiQuiz> {
  const res = await fetch(`/api/quizzes/${id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  return parseOrThrow<ApiQuiz>(res);
}

export async function fetchQuizResult(id: string): Promise<ApiQuiz> {
  const res = await fetch(`/api/quizzes/${id}/result`);
  return parseOrThrow<ApiQuiz>(res);
}
