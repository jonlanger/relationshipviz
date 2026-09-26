import { FundsFileSchema, type FundsFile } from './funds';
import { DatasetSchema, type Dataset } from './schema';

export async function loadDataset(url = `${import.meta.env.BASE_URL}data/dataset.json`): Promise<Dataset> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load dataset (${res.status})`);
  const json: unknown = await res.json();
  const parsed = DatasetSchema.safeParse(json);
  if (!parsed.success) {
    console.error(parsed.error.issues);
    throw new Error(`Dataset failed validation: ${parsed.error.issues[0]?.message ?? 'unknown error'}`);
  }
  return parsed.data;
}

/** Fund holdings live in their own file so pages that don't need them don't pay for them. */
export async function loadFunds(url = `${import.meta.env.BASE_URL}data/funds.json`): Promise<FundsFile> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load funds (${res.status})`);
  const parsed = FundsFileSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error(`Funds failed validation: ${parsed.error.issues[0]?.message ?? 'unknown error'}`);
  return parsed.data;
}
