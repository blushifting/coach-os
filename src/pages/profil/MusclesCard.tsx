/**
 * Carte « Tes muscles » du Profil (maquette
 * `Kotsh/maquettes/etape7_seance_profil.html`, piste C).
 *
 * Un panneau d'information, rien n'y est cliquable hormis « Modifier » : une
 * petite silhouette aux couleurs de l'onboarding (or = développer, orange
 * sombre = entretenir), et à côté les deux listes. Pas de couleur de volume :
 * ce n'est pas la même information.
 */

import { AnatomicalSilhouette, type SilhouetteStatus } from '@/components/AnatomicalSilhouette';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { muscleLabel } from '@/lib/progress';

interface MusclesCardProps {
  /** Muscles à développer, dans l'ordre du rang. */
  readonly develop: readonly string[];
  readonly maintain: ReadonlySet<string>;
  readonly onEdit: () => void;
  readonly editDisabled: boolean;
}

export function MusclesCard({ develop, maintain, onEdit, editDisabled }: MusclesCardProps) {
  // Même correspondance que l'onboarding (palette `objective`).
  const highlights: Record<string, SilhouetteStatus> = {};
  for (const m of maintain) highlights[m] = 'ok';
  for (const m of develop) highlights[m] = 'highlight';
  const maintainList = [...maintain].filter((m) => !develop.includes(m));

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Tes muscles</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          disabled={editDisabled}
          data-testid="profil-edit-priorities-programme"
        >
          Modifier
        </Button>
      </div>
      <div className="flex items-center gap-3" data-testid="profil-goals-summary">
        <AnatomicalSilhouette
          highlights={highlights}
          palette="objective"
          view="both"
          className="h-36 w-auto shrink-0"
          testId="profil-muscles-silhouette"
        />
        <div className="flex min-w-0 flex-col gap-2">
          <Group label="À développer" dot="bg-amber-400">
            {develop.length === 0 ? (
              <span className="text-anthracite-400">Aucun</span>
            ) : (
              <ol className="flex flex-col gap-0.5">
                {develop.map((m, i) => (
                  <li key={m} data-testid={`profil-goal-summary-${m}`} className="text-white">
                    <span className="mr-1.5 font-semibold tabular-nums text-amber-400">
                      {i + 1}
                    </span>
                    {muscleLabel(m)}
                  </li>
                ))}
              </ol>
            )}
          </Group>
          {maintainList.length > 0 && (
            <Group label="À entretenir" dot="bg-amber-700">
              <p className="text-anthracite-200" data-testid="profil-suggested-summary">
                {maintainList.map(muscleLabel).join(', ')}
              </p>
            </Group>
          )}
        </div>
      </div>
    </Card>
  );
}

function Group({
  label,
  dot,
  children,
}: {
  readonly label: string;
  readonly dot: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 text-[13px] leading-snug">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-anthracite-300">
        <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      {children}
    </div>
  );
}
