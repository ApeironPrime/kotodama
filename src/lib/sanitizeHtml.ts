import DOMPurify from 'dompurify'

/** Learning content needs text formatting and ruby, never scripts, media or inline styles. */
export function sanitizeHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS: [
      'ruby',
      'rt',
      'rp',
      'p',
      'br',
      'span',
      'div',
      'b',
      'strong',
      'i',
      'em',
      'u',
      's',
      'sub',
      'sup',
      'ul',
      'ol',
      'li',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    ALLOWED_ATTR: ['lang', 'colspan', 'rowspan'],
  })
}
