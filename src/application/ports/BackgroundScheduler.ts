/**
 * Schedules work to run after the current request/use-case has already produced its
 * result — used for the async LLM-as-judge so it never adds latency to the request path.
 * The Next.js-specific implementation (using next/server's after()) lives in
 * infrastructure/runtime, keeping that framework detail out of the application layer.
 */
export interface BackgroundScheduler {
  schedule(task: () => Promise<void>): void;
}
