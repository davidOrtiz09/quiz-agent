import "dotenv/config";
import { Langfuse } from "langfuse";
import { FALLBACK_PROMPTS } from "../src/infrastructure/llm/prompts/fallbacks";

const PRODUCTION_LABEL = "production";

async function main() {
  const { LANGFUSE_BASEURL, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY } = process.env;

  if (!LANGFUSE_BASEURL || !LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
    console.log("Langfuse env vars not set — nothing to seed. The app runs fine on in-code fallbacks.");
    return;
  }

  const langfuse = new Langfuse({
    baseUrl: LANGFUSE_BASEURL,
    publicKey: LANGFUSE_PUBLIC_KEY,
    secretKey: LANGFUSE_SECRET_KEY,
  });

  for (const [name, prompt] of Object.entries(FALLBACK_PROMPTS)) {
    let existing: string | undefined;
    try {
      const current = await langfuse.getPrompt(name, undefined, { label: PRODUCTION_LABEL, type: "text" });
      existing = current.prompt;
    } catch {
      existing = undefined;
    }

    if (existing === prompt) {
      console.log(`= ${name} already up to date`);
      continue;
    }

    await langfuse.createPrompt({ name, prompt, labels: [PRODUCTION_LABEL], type: "text" });
    console.log(existing === undefined ? `+ created ${name}` : `~ updated ${name}`);
  }

  await langfuse.flushAsync();
  console.log("Done.");
}

main().catch((error) => {
  console.error("Seeding Langfuse prompts failed", error);
  process.exit(1);
});
