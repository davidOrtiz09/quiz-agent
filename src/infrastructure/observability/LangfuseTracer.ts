import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { CallbackHandler } from "langfuse-langchain";
import type { Tracer } from "../../application/ports/Tracer";
import { getEnv, isLangfuseEnabled } from "../../shared/env";

interface LangfuseConnectionOptions {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
}

/**
 * Wraps LangChain's native Langfuse CallbackHandler behind the Tracer port. When Langfuse
 * env vars are absent, getCallbackHandler() returns undefined and generation runs untraced —
 * the app never hard-depends on Langfuse being reachable.
 */
export class LangfuseTracer implements Tracer {
  private readonly options: LangfuseConnectionOptions | undefined;
  private handlers: CallbackHandler[] = [];

  constructor() {
    const env = getEnv();
    this.options = isLangfuseEnabled(env)
      ? { publicKey: env.LANGFUSE_PUBLIC_KEY, secretKey: env.LANGFUSE_SECRET_KEY, baseUrl: env.LANGFUSE_BASEURL }
      : undefined;
  }

  getCallbackHandler(metadata: Record<string, unknown>): BaseCallbackHandler | undefined {
    if (!this.options) return undefined;

    const handler = new CallbackHandler({ ...this.options, metadata });
    this.handlers.push(handler);
    return handler;
  }

  async flush(): Promise<void> {
    const pending = this.handlers;
    this.handlers = [];
    await Promise.all(
      pending.map((handler) => handler.flushAsync().catch((error) => console.error("Langfuse flush failed", error))),
    );
  }
}
