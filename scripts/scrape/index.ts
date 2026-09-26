/**
 * Full pipeline: npm run scrape
 *   SEC_USER_AGENT="RelationshipViz you@example.com" npm run scrape
 * Pass --no-edgar to skip 10-K mining. Without SEC_USER_AGENT, SEC data comes only from the cache
 * and data/bulk/ (manual downloads); nothing is requested from SEC.
 */
import { scrapeSp500 } from './sp500';
import { buildUniverse } from './universe';
import { scrapeEdgar } from './edgar';
import { merge } from './merge';
import { scrapeFunds } from './funds';
import { scrapeProfiles } from './profiles';
import { scrapeFinancials } from './financials';

const args = new Set(process.argv.slice(2));
await scrapeSp500();
await buildUniverse();
await scrapeProfiles();
await scrapeFinancials();
if (!args.has('--no-edgar')) await scrapeEdgar();
await scrapeFunds();
merge();
