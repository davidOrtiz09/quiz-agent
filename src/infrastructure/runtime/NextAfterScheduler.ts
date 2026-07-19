import { after } from "next/server";
import type { BackgroundScheduler } from "../../application/ports/BackgroundScheduler";

/**
 * Schedules work via Next.js's after() so it runs once the response has already been sent,
 * without adding latency to the request. Isolated here so the application layer never
 * imports next/server directly.
 */
export class NextAfterScheduler implements BackgroundScheduler {
  schedule(task: () => Promise<void>): void {
    after(() => task().catch((error) => console.error("Background task failed", error)));
  }
}
