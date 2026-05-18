import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import type { Exercise } from '@/engine/models';

interface VariantPickerSheetProps {
  readonly open: boolean;
  readonly currentExerciseId: string;
  readonly alternatives: readonly Exercise[];
  readonly expanded: boolean;
  readonly onToggleExpand: () => void;
  readonly onPick: (newExerciseId: string) => void;
  readonly onClose: () => void;
  readonly title?: string;
}

export function VariantPickerSheet({
  open,
  currentExerciseId,
  alternatives,
  expanded,
  onToggleExpand,
  onPick,
  onClose,
  title = 'Changer de variante',
}: VariantPickerSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs text-anthracite-300">
          {expanded
            ? 'Tous les exos ciblant le(s) même(s) muscle(s).'
            : 'Variantes proches (même mouvement).'}
        </span>
        <button
          type="button"
          onClick={onToggleExpand}
          data-testid="btn-toggle-expand"
          className="rounded-lg border border-anthracite-700 px-2 py-1 text-xs text-anthracite-300 hover:text-white"
        >
          {expanded ? 'Voir seulement les variantes' : 'Voir tous les exos ciblant ce muscle'}
        </button>
      </div>
      {alternatives.length === 0 ? (
        <p
          className="text-sm text-anthracite-300"
          data-testid="variant-picker-empty"
        >
          {expanded
            ? 'Aucun remplaçant ne correspond à ton équipement.'
            : 'Aucune variante alternative dispo avec ton équipement.'}
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
