export interface PromptHandle {
  /** Fill in the prompt's variables and return the final text. */
  compile(variables: Record<string, string>): string;
  /** Version identifier from the prompt source, used to link traces to the exact prompt used. */
  version: string | number;
  /** "langfuse" when fetched remotely, "fallback" when the in-code default was used. */
  source: "langfuse" | "fallback";
}

export interface PromptProvider {
  getPrompt(name: string): Promise<PromptHandle>;
}
