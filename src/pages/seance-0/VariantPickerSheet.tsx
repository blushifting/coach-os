import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import type { Exercise } from '@/engine/models';

interface VariantPickerSheetProps {
  readonly open: boolean;
  readonly currentExerciseId: string;
  readonly alternatives: readonly Exercise[];
  readonly onPick: (newExerciseId: string) => void;
  readonly onClose: () => void;
}

export function VariantPickerSheet({
  open,
  currentExerciseId,
  alternatives,
  onPick,
  onClose,
}: VariantPickerSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Changer de variante">
      {alternatives.length === 0 ? (
        <p
          className="text-sm text-anthracite-300"
          data-testid="variant-picker-empty"
        >
          Aucune variante alternative dispo avec ton équipement.
        </p>
      ) : (
        <ul className="max-h-[60vh] overflow-y-auto" data-testid="variant-picker-list">
          {alternatives.map((alt) => (
            <li key={alt.id} className="mb-2 last:mb-0">
              <button
                type="button"
                onClick={() => onPick(alt.id)}
                disabled={alt.id === currentExerciseId}
                data-testid={`variant-option-${alt.id}`}
                className="w-full rounded-xl border border-anthracite-700 bg-anthracite-800 px-4 py-3 text-left transition hover:border-sang-700 active:scale-[0.99] disabled:opacity-50"
              >
                <div className="font-medium text-white">{alt.nom_fr}</div>
                <div className="mt-0.5 text-xs text-anthracite-300">
                  {alt.equip.length > 0 ? alt.equip.join(', ') : 'Poids du corps'}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Button variant="secondary" fullWidth onClick={onClose}>
          Annuler
        </Button>
      </div>
    </Sheet>
  );
}
