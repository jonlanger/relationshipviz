/**
 * Company-name helpers shared by the pipeline and the app.
 */

const SUFFIX =
  /[,\s]+(Inc\.?|Incorporated|Corporation|Corp\.?|Company|Companies|Co\.?|plc|PLC|Ltd\.?|Limited|Holdings?|Group|N\.V\.|S\.A\.|SE|AG|L\.P\.|LP|Trust|& Co\.?)$/i;

/**
 * Short display name from a legal or index name:
 * "Coca-Cola Company (The)" → "Coca-Cola", "Block, Inc." → "Block",
 * "American Airlines Group" → "American Airlines", "Hartford (The)" → "Hartford".
 */
export function shortNameOf(name: string): string {
  let s = name.trim().replace(/\s*\(The\)$/i, '').replace(/^The\s+/i, '');
  // Strip stacked suffixes ("Holdings, Inc."), but never down to nothing.
  for (let i = 0; i < 4; i++) {
    const next = s.replace(SUFFIX, '').trim();
    if (!next || next === s) break;
    s = next;
  }
  return s.replace(/[,\s]+$/, '');
}

/** Lowercased, punctuation-free form for fuzzy name matching (fund holdings, search). */
export function normalizeName(name: string): string {
  let s = name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ');
  for (let i = 0; i < 3; i++) {
    s = s
      .replace(/\b(inc|incorporated|corporation|corp|company|companies|co|plc|ltd|limited|holdings?|group|nv|sa|se|ag|lp|the|class [a-c]|cl [a-c]|com|common|stock|shs|new)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return s;
}
