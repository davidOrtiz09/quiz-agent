import type { MarkdownFetcher } from "../../application/ports/MarkdownFetcher";
import { UpstreamError, ValidationError } from "../../shared/errors";
import { normalizeMarkdownUrl } from "./githubUrl";
import { assertSafeUrl, UnsafeUrlError } from "./urlSafety";

const FETCH_TIMEOUT_MS = 10_000;
// ~6K tokens. Sized so a generation plus its trailing LLM-judge call fit together inside
// Groq's free-tier tokens-per-minute window — 40K chars worked but throttled back-to-back
// runs (each quiz costs ~2x its content: generate now, judge in the background right after).
const MAX_CONTENT_CHARS = 24_000;

export class HttpMarkdownFetcher implements MarkdownFetcher {
  async fetch(rawUrl: string): Promise<string> {
    const url = normalizeMarkdownUrl(rawUrl);

    try {
      await assertSafeUrl(url);
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        throw new ValidationError(`Unsafe source URL: ${error.message}`);
      }
      throw error;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal, redirect: "error" });
    } catch (error) {
      throw new UpstreamError(`Failed to fetch source markdown: ${(error as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new UpstreamError(`Source URL returned ${response.status}`);
    }

    const text = await response.text();
    if (text.trim().length === 0) {
      throw new ValidationError("Source markdown is empty");
    }

    return text.length > MAX_CONTENT_CHARS ? text.slice(0, MAX_CONTENT_CHARS) : text;
  }
}
