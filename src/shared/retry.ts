export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 2, baseDelayMs = 500, isRetryable = () => true } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryable(error)) {
        throw error;
      }
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/** Retryable: rate limits, server errors, and timeouts from an LLM provider's client. */
export function isRetryableLlmError(error: unknown): boolean {
  const err = error as { status?: number; name?: string; message?: string } | undefined;
  if (!err) return false;
  if (err.status === 429) return true;
  if (typeof err.status === "number" && err.status >= 500) return true;
  if (err.name === "TimeoutError" || err.name === "AbortError") return true;
  if (typeof err.message === "string" && /timeout/i.test(err.message)) return true;
  return false;
}
