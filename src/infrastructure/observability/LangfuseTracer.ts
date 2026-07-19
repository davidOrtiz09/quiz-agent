import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { CallbackHandler } from "langfuse-langchain";
import type { Tracer } from "../../application/ports/Tracer";
import { createLangfuseCallbackHandler } from "./langfuseHandler";

/**
 * Wraps LangChain's native Langfuse CallbackHandler behind the Tracer port. When Langfuse
 * env vars are absent, getCallbackHandler() returns undefined and generation runs untraced —
 * the app never hard-depends on Langfuse being reachable.
 */
export class LangfuseTracer implements Tracer {
  private handlers: CallbackHandler[] = [];

  getCallbackHandler(metadata: Record<string, unknown>): BaseCallbackHandler | undefined {
    const handler = createLangfuseCallbackHandler(metadata);
    if (handler) this.handlers.push(handler);
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
