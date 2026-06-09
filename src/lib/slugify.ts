/**
 * URL-safe slug generator.
 * PURE — no framework deps, no DB.
 */

/**
 * Converts a raw string to a URL-safe slug:
 * lowercase, spaces → dashes, strips non-alphanumeric except dashes.
 */
export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')          // spaces to dashes
    .replace(/[^a-z0-9-]/g, '')   // strip non-alphanumeric except dashes
    .replace(/-+/g, '-')           // collapse consecutive dashes
    .replace(/^-|-$/g, '')         // trim leading/trailing dashes
}
