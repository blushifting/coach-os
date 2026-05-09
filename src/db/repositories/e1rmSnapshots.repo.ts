import { getDb, type E1rmSnapshotRow } from '../schema';

export interface E1rmSnapshotInput {
  date: string;
  exercise_id: string;
  e1rm: number;
  cycle_index: number;
  week_in_cycle: number;
}

export async function insertE1rmSnapshots(rows: E1rmSnapshotInput[]): Promise<void> {
  if (rows.length === 0) return;
  await getDb().e1rmSnapshots.bulkAdd(rows.map((r) => ({ ...r })));
}

export async function listSnapshotsForExercise(exercise_id: string): Promise<E1rmSnapshotRow[]> {
  return getDb().e1rmSnapshots.where('exercise_id').equals(exercise_id).sortBy('date');
}

export async function listAllSnapshots(): Promise<E1rmSnapshotRow[]> {
  return getDb().e1rmSnapshots.orderBy('date').toArray();
}
