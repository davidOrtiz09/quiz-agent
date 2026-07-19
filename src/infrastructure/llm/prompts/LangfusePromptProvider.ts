import { Langfuse } from "langfuse";
import type { PromptHandle, PromptProvider } from "../../../application/ports/PromptProvider";
import { getEnv, isLangfuseEnabled } from "../../../shared/env";
import { FALLBACK_PROMPTS } from "./fallbacks";

const PROMPT_CACHE_TTL_SECONDS = 60;

function compileFallback(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((text, [key, value]) => text.split(`{{${key}}}`).join(value), template);
}

function fallbackHandle(template: string): PromptHandle {
  return {
    compile: (vars) => compileFallback(template, vars),
    version: "fallback",
    source: "fallback",
  };
}

/**
 * Fetches prompts from Langfuse Prompt Management, with an in-code fallback so the app
 * never hard-depends on Langfuse being reachable. Also doubles as the mechanism that links
 * a generation's trace to the exact prompt version that produced it (see LangfuseTracer).
 */
export class LangfusePromptProvider implements PromptProvider {
  private readonly client: Langfuse | undefined;

  constructor() {
    const env = getEnv();
    if (isLangfuseEnabled(env)) {
      this.client = new Langfuse({
        baseUrl: env.LANGFUSE_BASEURL,
        publicKey: env.LANGFUSE_PUBLIC_KEY,
        secretKey: env.LANGFUSE_SECRET_KEY,
      });
    }
  }

  async getPrompt(name: string): Promise<PromptHandle> {
    const template = FALLBACK_PROMPTS[name];
    if (template === undefined) {
      throw new Error(`No fallback registered for prompt "${name}" — every prompt must have one.`);
    }

    if (!this.client) {
      return fallbackHandle(template);
    }

    try {
      const prompt = await this.client.getPrompt(name, undefined, {
        type: "text",
        fallback: template,
        cacheTtlSeconds: PROMPT_CACHE_TTL_SECONDS,
      });

      return {
        compile: (vars) => prompt.compile(vars),
        version: prompt.version,
        source: prompt.isFallback ? "fallback" : "langfuse",
      };
    } catch (error) {
      console.error(`Langfuse getPrompt("${name}") failed, using in-code fallback`, error);
      return fallbackHandle(template);
    }
  }
}
