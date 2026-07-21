import { describe, expect, it } from "vitest";
import { normalizeMarkdownUrl } from "@/infrastructure/markdown/githubUrl";

describe("normalizeMarkdownUrl", () => {
  it("rewrites a github.com blob URL to raw.githubusercontent.com", () => {
    expect(normalizeMarkdownUrl("https://github.com/pipecat-ai/pipecat/blob/main/README.md")).toBe(
      "https://raw.githubusercontent.com/pipecat-ai/pipecat/main/README.md",
    );
  });

  it("handles nested paths", () => {
    expect(normalizeMarkdownUrl("https://github.com/org/repo/blob/main/docs/guide.md")).toBe(
      "https://raw.githubusercontent.com/org/repo/main/docs/guide.md",
    );
  });

  it("leaves a raw.githubusercontent.com URL unchanged", () => {
    const url = "https://raw.githubusercontent.com/org/repo/main/README.md";
    expect(normalizeMarkdownUrl(url)).toBe(url);
  });

  it("leaves an unrelated URL unchanged", () => {
    const url = "https://example.com/README.md";
    expect(normalizeMarkdownUrl(url)).toBe(url);
  });

  it("leaves a github.com URL that isn't a blob URL unchanged", () => {
    const url = "https://github.com/org/repo";
    expect(normalizeMarkdownUrl(url)).toBe(url);
  });
});
