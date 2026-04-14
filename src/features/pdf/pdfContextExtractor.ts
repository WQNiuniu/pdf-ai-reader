export function buildPageContext(
  pageTexts: string[],
  currentPage: number,
  windowSize = 1,
  maxChars = 6000
): string {
  if (!pageTexts.length) return "";
  const start = Math.max(1, currentPage - windowSize);
  const end = Math.min(pageTexts.length, currentPage + windowSize);
  const parts: string[] = [];
  for (let page = start; page <= end; page += 1) {
    const text = pageTexts[page - 1] || "";
    if (!text.trim()) continue;
    parts.push(`[Page ${page}]\n${text.trim()}`);
  }
  return parts.join("\n\n").slice(0, maxChars);
}
