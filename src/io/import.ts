/**
 * Import d'un fichier d'export Coach OS — remplace l'intégralité de la DB.
 *
 * Validation Zod stricte au niveau structurel + version. En cas d'échec,
 * la DB n'est pas touchée (validation avant transaction).
 */

import { getDb } from '@/db';
import { exportSchema, type ExportPayload } from './schema';

export class ImportValidationError extends Error {
  constructor(
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
    this.name = 'ImportValidationError';
  }
}

export function parseExportPayload(raw: unknown): ExportPayload {
  const result = exportSchema.safeParse(raw);
  if (!result.success) {
    throw new ImportValidationError(
      'Fichier d\'import Coach OS invalide.',
      result.error.issues,
    );
  }
  // Zod a validé la structure ; on cast vers le type métier riche
  // (les blobs internes sont en `passthrough` côté Zod mais conservent
  // leur forme métier au runtime — cf. ExportPayload dans schema.ts).
  return result.data as unknown as ExportPayload;
}

export function parseExportJson(json: string): ExportPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new ImportValidationError(`JSON malformé : ${(e as Error).message}`);
  }
  return parseExportPayload(raw);
}

/**
 * Remplace tout le contenu de la DB par le payload importé.
 * Une seule transaction multi-tables — atomique.
 */
export async function importPayload(payload: ExportPayload): Promise<void> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  await db.transaction(
    'rw',
    [
      db.userState,
      db.sessions,
      db.feedbacks,
      db.e1rmSnapshots,
      db.cycles,
      db.equipmentOverrides,
      db.userAddedExercises,
    ],
    async () => {
      await Promise.all([
        db.userState.clear(),
        db.sessions.clear(),
        db.feedbacks.clear(),
        db.e1rmSnapshots.clear(),
        db.cycles.clear(),
        db.equipmentOverrides.clear(),
        db.userAddedExercises.clear(),
      ]);

      const { data } = payload;
      if (data.userState !== null) {
        await db.userState.put({ id: 1, state: data.userState, updated_at: nowIso });
      }
      if (data.sessions.length > 0) {
        await db.sessions.bulkAdd(data.sessions.map(({ id: _id, ...rest }) => rest));
      }
      if (data.feedbacks.length > 0) {
        await db.feedbacks.bulkAdd(data.feedbacks.map(({ id: _id, ...rest }) => rest));
      }
      if (data.e1rmSnapshots.length > 0) {
        await db.e1rmSnapshots.bulkAdd(
          data.e1rmSnapshots.map(({ id: _id, ...rest }) => rest),
        );
      }
      if (data.cycles.length > 0) {
        await db.cycles.bulkPut(data.cycles);
      }
      if (data.equipmentOverrides.length > 0) {
        await db.equipmentOverrides.bulkPut(data.equipmentOverrides);
      }
      if (data.userAddedExercises.length > 0) {
        await db.userAddedExercises.bulkPut(data.userAddedExercises);
      }
    },
  );
}

export async function importFromJsonString(json: string): Promise<void> {
  const payload = parseExportJson(json);
  await importPayload(payload);
}
