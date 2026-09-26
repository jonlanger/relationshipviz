import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatasetSchema } from '../schema';
import { co, dataset, rel } from './fixtures';

describe('DatasetSchema', () => {
  it('accepts a valid dataset', () => {
    expect(DatasetSchema.safeParse(dataset([co('A'), co('B')], [rel('A', 'B')])).success).toBe(true);
  });

  it('rejects relationships pointing at unknown companies', () => {
    const r = DatasetSchema.safeParse(dataset([co('A')], [rel('A', 'Z')]));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/unknown target Z/);
  });

  it('rejects duplicate company ids and self-loops', () => {
    expect(DatasetSchema.safeParse(dataset([co('A'), co('A')], [])).success).toBe(false);
    expect(DatasetSchema.safeParse(dataset([co('A')], [rel('A', 'A')])).success).toBe(false);
  });

  it('validates the published dataset', () => {
    const json = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/dataset.json'), 'utf8'));
    const r = DatasetSchema.safeParse(json);
    expect(r.success).toBe(true);
    expect(r.data!.companies.length).toBeGreaterThan(100);
  });
});
