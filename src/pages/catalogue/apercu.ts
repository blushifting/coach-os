import { photosFor } from '@/data/exercise-photos';
import { poseValidee } from '@/visuels/poses';

/** Un exercice a-t-il un aperçu du mouvement (animation ou photos) ? Sinon, pas de bouton « œil ». */
export function apercuDisponible(exerciseId: string): boolean {
  return poseValidee(exerciseId) !== null || photosFor(exerciseId) !== null;
}
