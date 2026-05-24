import type { EquipmentOverride } from '@/engine/models';
import { getDb, type EquipmentOverrideRow } from '../schema';

export async function upsertOverride(
  exercise_id: string,
  override: EquipmentOverride,
): Promise<void> {
  await getDb().equipmentOverrides.put({
    exercise_id,
    inc_kg: override.inc_kg,
    min_load_kg: override.min_load_kg,
    max_load_kg: override.max_load_kg,
    pdc_only: override.pdc_only,
  });
}

export async function deleteOverride(exercise_id: string): Promise<void> {
  await getDb().equipmentOverrides.delete(exercise_id);
}

export async function listAllOverrides(): Promise<EquipmentOverrideRow[]> {
  return getDb().equipmentOverrides.toArray();
}

/** Recharge tous les overrides en Record (forme attendue par UserState). */
export async function loadOverridesAsRecord(): Promise<Record<string, EquipmentOverride>> {
  const rows = await listAllOverrides();
  const out: Record<string, EquipmentOverride> = {};
  for (const r of rows) {
    out[r.exercise_id] = {
      inc_kg: r.inc_kg,
      min_load_kg: r.min_load_kg,
      max_load_kg: r.max_load_kg,
      // Conv #20 — rétrocompat : DB pré-Conv-#20 sans `pdc_only` → null.
      pdc_only: r.pdc_only ?? null,
    };
  }
  return out;
}
