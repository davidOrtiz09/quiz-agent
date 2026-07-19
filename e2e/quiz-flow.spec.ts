import { expect, test } from "@playwright/test";

/**
 * Always exercises the REAL Groq LLM (no mocking) — see the plan's rationale: assertions
 * target structure (question/option counts, input types, a numeric score), never exact
 * wording, since generation is nondeterministic. Requires GROQ_API_KEY; skips cleanly
 * without it rather than failing in a confusing way.
 */
test.skip(!process.env.GROQ_API_KEY, "requires GROQ_API_KEY to exercise the real LLM");

const README_PRESETS = ["Pipecat README", "LangChain.js README"];

for (const presetLabel of README_PRESETS) {
  test(`generate, take, and review a quiz from the ${presetLabel}`, async ({ page }) => {
    await page.goto("/");

    // Strategy dropdown is populated from GET /api/strategies — wait for real options.
    const strategySelect = page.locator("#strategy");
    await expect(strategySelect.locator("option")).not.toHaveCount(0);

    await page.getByRole("button", { name: presetLabel }).click();
    await expect(page.locator("#sourceUrl")).not.toHaveValue("");

    await page.locator("#numQuestions").selectOption("5");
    await page.getByRole("button", { name: /Generate Quiz/i }).click();

    // Real generation can take up to ~a minute.
    await page.waitForURL(/\/quiz\/.+/, { timeout: 90_000 });

    const questionItems = page.locator("main ol > li");
    await expect(questionItems).toHaveCount(5);

    const questionCount = await questionItems.count();
    let multipleAnswerQuestions = 0;

    for (let i = 0; i < questionCount; i++) {
      const question = questionItems.nth(i);
      const radios = question.locator('input[type="radio"]');
      const checkboxes = question.locator('input[type="checkbox"]');
      const radioCount = await radios.count();
      const checkboxCount = await checkboxes.count();

      // Every question has exactly 4 options, all of one input type (SINGLE xor MULTIPLE).
      expect(radioCount + checkboxCount).toBe(4);
      expect(radioCount === 4 || checkboxCount === 4).toBe(true);

      if (checkboxCount === 4) {
        multipleAnswerQuestions += 1;
        await checkboxes.first().check();
      } else {
        await radios.first().check();
      }
    }

    // The generation prompt guarantees at least one MULTIPLE question.
    expect(multipleAnswerQuestions).toBeGreaterThanOrEqual(1);

    await page.getByRole("button", { name: /Submit answers/i }).click();
    await page.waitForURL(/\/result\/.+/, { timeout: 30_000 });

    await expect(page.getByText(/\/\s*4/)).toBeVisible();
    await expect(page.getByText(/%/)).toBeVisible();
    await expect(page.locator("main ol > li")).toHaveCount(5);
  });
}
