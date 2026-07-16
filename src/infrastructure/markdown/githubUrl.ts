/**
 * Rewrites a GitHub "blob" URL (as seen in a browser) to the raw-content URL that
 * actually serves the file bytes. Any other URL is returned unchanged.
 *
 * e.g. https://github.com/pipecat-ai/pipecat/blob/main/README.md
 *   -> https://raw.githubusercontent.com/pipecat-ai/pipecat/main/README.md
 */
export function normalizeMarkdownUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  if (url.hostname !== "github.com") {
    return rawUrl;
  }

  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
  if (!match) {
    return rawUrl;
  }

  const [, owner, repo, ref, path] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
}
