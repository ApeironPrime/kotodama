/**
 * Converts legacy explanation markup into readable text without rendering HTML.
 * Explanation content has historically been stored as HTML strings; rendering
 * those strings as React children exposes the tags to learners.
 */
export function explanationToPlainText(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/<\s*br\s*\/?>/giu, '\n')
    .replace(/<\s*li\b[^>]*>/giu, '• ')
    .replace(/<\s*\/(?:p|div|li|ul|ol|blockquote|h[1-6]|tr)\s*>/giu, '\n')
    .replace(/<\s*(?:p|div|ul|ol|blockquote|h[1-6])\b[^>]*>/giu, '')
    .replace(/<[^>]*>/gu, '')
    .replace(/&nbsp;|&#160;|&#xA0;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&apos;|&#39;/giu, "'")
    .replace(/&#(\d+);/gu, (entity, decimal: string) => decodeCodePoint(entity, Number(decimal)))
    .replace(/&#x([\da-f]+);/giu, (entity, hex: string) => decodeCodePoint(entity, Number.parseInt(hex, 16)))
    .replace(/[ \t]*\n[ \t]*/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

function decodeCodePoint(original: string, codePoint: number): string {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return original
  try {
    return String.fromCodePoint(codePoint)
  } catch {
    return original
  }
}
