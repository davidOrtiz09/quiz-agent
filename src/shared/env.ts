import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GROQ_API_KEY: z.string().optional().default(""),
  GROQ_MODEL: z.string().min(1).default("llama-3.3-70b-versatile"),
  LANGFUSE_BASEURL: z.string().optional().default(""),
  LANGFUSE_PUBLIC_KEY: z.string().optional().default(""),
  LANGFUSE_SECRET_KEY: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validates process.env once (fail fast) and returns the typed, cached result. */
export function getEnv(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      throw new Error(`Invalid environment configuration: ${JSON.stringify(fieldErrors)}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function isLangfuseEnabled(env: Env = getEnv()): boolean {
  return Boolean(env.LANGFUSE_BASEURL && env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
}
