import { CallbackHandler } from "langfuse-langchain";
import { getEnv, isLangfuseEnabled } from "../../shared/env";

/**
 * Single place the Langfuse connection settings turn into a LangChain callback handler.
 * Returns undefined when Langfuse env vars are absent — callers run untraced.
 */
export function createLangfuseCallbackHandler(metadata: Record<string, unknown>): CallbackHandler | undefined {
  const env = getEnv();
  if (!isLangfuseEnabled(env)) return undefined;

  return new CallbackHandler({
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    baseUrl: env.LANGFUSE_BASEURL,
    metadata,
  });
}
