/**
 * Query sanitization for YouTube search.
 * Trims, strips URLs, does not rewrite intent or invent related queries.
 */

import { sanitizeSearchText, isVerifiedSearchTerm } from './autocomplete';

export function normalizeQuery(query: string): string {
  return sanitizeSearchText(query);
}

export function isValidQuery(query: string): boolean {
  return isVerifiedSearchTerm(query);
}

export function sanitizeQuery(query: string): string {
  return sanitizeSearchText(query).slice(0, 200);
}

/** Never invent related queries — only the sanitized user query. */
export function generateSemanticVariations(query: string): string[] {
  const q = normalizeQuery(query);
  return q ? [q] : [];
}
