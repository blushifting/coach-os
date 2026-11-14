import { getDb, type CycleRow } from '../schema';

export async function upsertCycle(row: CycleRow): Promise<void> {
  await getDb().cycles.put(row);
}

export async function listAllCycles(): Promise<CycleRow[]> {
  return getDb().cycles.orderBy('cycle_index').toArray();
}

export async function setCycleEnd(cycle_index: number, end_date: string): Promise<void> {
  const existing = await getDb().cycles.get(cycle_index);
  if (existing === undefined) {
    throw new Error(`Cycle introuvable : ${cycle_index}`);
  }
  await getDb().cycles.put({ ...existing, end_date });
}
