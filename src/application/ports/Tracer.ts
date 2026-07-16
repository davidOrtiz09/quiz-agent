import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";

export interface Tracer {
  /** LangChain callback handler to attach to a chain invocation, or undefined when tracing is disabled. */
  getCallbackHandler(metadata: Record<string, unknown>): BaseCallbackHandler | undefined;
  /** Flush any buffered events. Call before the process may exit (e.g. serverless, scripts). */
  flush(): Promise<void>;
}
