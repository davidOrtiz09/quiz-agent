export interface MarkdownFetcher {
  fetch(url: string): Promise<string>;
}
