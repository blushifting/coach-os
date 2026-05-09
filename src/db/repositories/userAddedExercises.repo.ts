import type { ExerciseDict } from '@/engine/models';
import { getDb, type UserAddedExerciseRow } from '../schema';

export async function addUserExercise(dict: ExerciseDict): Promise<void> {
  await getDb().userAddedExercises.put({
    exercise_id: dict.id,
    exercise_dict: dict,
    added_at: new Date().toISOString(),
  });
}

export async function deleteUserExercise(exercise_id: string): Promise<void> {
  await getDb().userAddedExercises.delete(exercise_id);
}

export async function listUserExercises(): Promise<UserAddedExerciseRow[]> {
  return getDb().userAddedExercises.toArray();
}
