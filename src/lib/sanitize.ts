/**
 * Thin wrapper around sanitize-html with a strict allowlist.
 *
 * Only the inline tags actually used in the QHogar mockup scale labels are
 * permitted: <b>, <strong>, <em>, <i>, <br>.
 * NO attributes allowed on any tag (prevents onerror, onclick, href, etc.).
 * All other tags are stripped but their text content is preserved (sanitize-html
 * default: disallowedTagsMode = 'discard').
 *
 * sanitize-html is CJS — import via require() syntax works in both Next.js
 * (which uses webpack/swc) and Vitest (node environment).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = ['b', 'strong', 'em', 'i', 'br']

export function sanitize(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {}, // no attributes on any tag
    disallowedTagsMode: 'discard', // strip tag, keep inner text
  })
}
