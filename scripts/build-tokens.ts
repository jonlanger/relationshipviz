/**
 * Emits src/design-system/tokens.css from the TypeScript token source of truth.
 * Run: npm run tokens
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toCssVariables } from '../src/design-system/tokens/css';

const out = resolve(import.meta.dirname, '../src/design-system/tokens.css');
writeFileSync(out, toCssVariables());
console.log(`✓ wrote ${out}`);
