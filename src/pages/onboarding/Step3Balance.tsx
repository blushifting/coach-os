/**
 * Étape 3 de l'onboarding : dialogue récapitulatif R1-R4.
 *
 * - On affiche la liste des SUGGERE issus de `applyBalanceRules` (fonction pure
 *   de `engine/balance.ts`), pré-cochés.
 * - L'utilisateur peut décocher → bascule en NON_COUVERT à la finalisation.
 * - Une phrase d'explication par règle (R1/R2/R3/R4) accompagne chaque ligne.
 *
 * Si la liste est vide, on affiche un message "Tout est déjà équilibré" et
 * l'utilisateur peut passer à l'étape suivante sans rien faire.
 */

import { useMemo } from 'react';
import type { MuscleGoal } from '@/engine/models';
import { Card } from '@/components/Card';
import { cn } from '@/lib/cn';
import { explainSuggestion, muscleLabel } from '@/lib/balance-reasons';
import {
  computeBalanceSuggestions,
  type OnboardingDraft,
} from '@/lib/onboarding-state';

interface Step3Props {
  readonly draft: OnboardingDraft;
  readonly onChange: (patch: Partial<OnboardingDraft>) => void;
  readonly stepLabel?: string;
}

const RULE_BADGES: Record<string, string> = {
  R1: 'Push / Pull',
  R2: 'Quadriceps ↔ Ischios',
  R3: 'Gainage',
  R4: 'Posture épaules',
};

export function Step3Balance({ draft, onChange, stepLabel }: Step3Props) {
  const suggestions: MuscleGoal[] = useMemo(
    () => computeBalanceSuggestions(draft.priorities),
    [draft.priorities],
  );

  function toggleSuggestion(muscle: string) {
    const next = new Set(draft.acceptedSuggestions);
    if (next.has(muscle)) next.delete(muscle);
    else next.add(muscle);
    onChange({ acceptedSuggestions: next });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          {stepLabel ?? 'Étape 3 · Équilibre'}
        </span>
        <h1 className="font-display text-3xl leading-tight tracking-wide text-white">
          Équilibre musculaire
        </h1>
      </header>
      <p className="text-sm text-anthracite-300">
        D'après tes priorités, on te suggère d'ajouter ces muscles en maintien
        (volume minimum) pour éviter les déséquilibres. Décoche ceux que tu ne
        veux pas travailler.
      </p>

      {suggestions.length === 0 ? (
        <Card>
          <p className="text-sm text-white">
            Aucune suggestion. Ta sélection est déjà équilibrée selon les règles
            R1-R4.
          </p>
        </Card>
      ) : (
        <Card>
          <ul className="flex flex-col gap-2" data-testid="suggestions-list">
            {suggestions.map((sg) => {
              const reason = explainSuggestion(sg.muscle, draft.priorities);
              const checked = draft.acceptedSuggestions.has(sg.muscle);
              return (
                <li
                  key={sg.muscle}
                  data-testid={`suggestion-${sg.muscle}`}
                  className={cn(
                    'rounded-xl border p-3 transition',
                    checked
                      ? 'border-sang-700 bg-sang-900/20'
                      : 'border-anthracite-700 bg-anthracite-900',
                  )}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSuggestion(sg.muscle)}
                      data-testid={`suggestion-checkbox-${sg.muscle}`}
                      className="mt-0.5 h-5 w-5 cursor-pointer accent-sang-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {muscleLabel(sg.muscle)}
                        </span>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                            'border-anthracite-600 bg-anthracite-800 text-anthracite-300',
                          )}
                        >
                          {RULE_BADGES[reason.rule] ?? reason.rule}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-anthracite-300">
                        {reason.text}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
