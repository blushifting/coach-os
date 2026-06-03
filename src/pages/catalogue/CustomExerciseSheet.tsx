/**
 * Conv #21b — Formulaire de création d'un exo custom par l'utilisateur.
 *
 * Sheet plein écran (sur mobile). L'user remplit un brouillon partiel
 * (`CustomExerciseDraft`), on valide, on détecte d'éventuels doublons, et
 * on persiste via `useEngine.addCustomExercise`.
 *
 * Choix UI pour ce premier jet :
 *  - Muscles via chips cyclables 0 / 0.5 / 1.0 (touché secondaire / primaire).
 *    Tap répété sur le même muscle cycle entre les états.
 *  - Silhouette interactive prévue Conv #23 (refonte visuels catalogue) — pour
 *    cette V1 on reste sur des chips listées pour minimiser le risque de
 *    mauvais tap.
 *  - Équipement : input texte libre comma-separated (l'user tape les ids
 *    qu'il reconnaît du catalog, ou laisse vide pour bw pur). Pas de picker
 *    multi-select pour V1.
 *  - Détection doublon : avant de persister, on cherche un match
 *    `exact-name` (bloquant) ou `similar-profile` (warning confirmable).
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { MUSCLES, SYNERGISTES_SANS_QUOTA } from '@/engine/models';
import { useEngine } from '@/hooks/useEngine';
import { cn } from '@/lib/cn';
import {
  buildExerciseDict,
  CHARGE_OPTIONS,
  EMPTY_DRAFT,
  findDuplicate,
  PATTERN_OPTIONS,
  validateDraft,
  type CustomExerciseDraft,
  type DuplicateMatch,
} from '@/lib/custom-exercise';
import { muscleLabel } from '@/lib/progress';
import { useCoachOsStore } from '@/store';

interface CustomExerciseSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Optionnel : callback appelé après création réussie (avec l'id généré). */
  readonly onCreated?: (exerciseId: string) => void;
}

const COEF_LABELS: Record<string, string> = {
  '0': '—',
  '0.5': 'secondaire',
  '1': 'principal',
};
const COEF_CYCLE: Record<number, number> = { 0: 0.5, 0.5: 1, 1: 0 };

/** Liste des muscles affichés dans le picker (15 cibles + deltos antérieurs). */
const PICKER_MUSCLES: readonly string[] = [...MUSCLES, ...SYNERGISTES_SANS_QUOTA];

export function CustomExerciseSheet({
  open,
  onClose,
  onCreated,
}: CustomExerciseSheetProps) {
  const engine = useEngine();
  const catalog = useCoachOsStore((s) => s.catalog);
  const [draft, setDraft] = useState<CustomExerciseDraft>(EMPTY_DRAFT);
  const [equipText, setEquipText] = useState('');
  const [confirmDuplicate, setConfirmDuplicate] =
    useState<DuplicateMatch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Sync brouillon `equip` avec l'input texte (comma-separated).
  function commitEquipText(v: string) {
    setEquipText(v);
    const parts = v
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    setDraft((d) => ({ ...d, equip: parts }));
  }

  function resetForm() {
    setDraft(EMPTY_DRAFT);
    setEquipText('');
    setConfirmDuplicate(null);
    setSubmitting(false);
    setServerError(null);
  }

  function close() {
    resetForm();
    onClose();
  }

  const errors = useMemo(() => validateDraft(draft), [draft]);
  const errorsByField = useMemo(() => {
    const out: Record<string, string> = {};
    for (const e of errors) out[e.field] = e.message;
    return out;
  }, [errors]);
  const isValid = errors.length === 0;

  async function trySubmit() {
    if (!isValid || catalog === null) return;
    setServerError(null);
    const dup = findDuplicate(draft, catalog.all());
    if (dup !== null && confirmDuplicate?.exercise.id !== dup.exercise.id) {
      // Première détection — on demande confirmation à l'user.
      setConfirmDuplicate(dup);
      return;
    }
    // Bloquant si exact-name même après "confirm" (on refuse l'ajout, l'user
    // doit changer le nom).
    if (dup !== null && dup.kind === 'exact-name') {
      setServerError(
        `Un exercice nommé "${dup.exercise.nom_fr}" existe déjà — change le nom.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const existingIds = new Set(catalog.all().map((e) => e.id));
      const dict = buildExerciseDict(draft, existingIds);
      await engine.addCustomExercise(dict);
      onCreated?.(dict.id);
      close();
    } catch (e) {
      setServerError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function cycleMuscle(muscle: string) {
    setDraft((d) => {
      const cur = d.muscles[muscle] ?? 0;
      const nxt = COEF_CYCLE[cur as 0 | 0.5 | 1] ?? 0;
      const next = { ...d.muscles };
      if (nxt === 0) delete next[muscle];
      else next[muscle] = nxt;
      return { ...d, muscles: next };
    });
  }

  if (!open) return null;

  return (
    <Sheet open={open} onClose={close} title="Créer un exercice custom">
      <div className="max-h-[80dvh] overflow-y-auto pr-1">
        <div className="flex flex-col gap-4">
          <Field label="Nom de l'exo *" error={errorsByField['nom_fr']}>
            <input
              data-testid="custom-name"
              type="text"
              placeholder="ex: Curl marteau avec rotation"
              value={draft.nom_fr}
              onChange={(e) =>
                setDraft((d) => ({ ...d, nom_fr: e.target.value }))
              }
              className="w-full rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
            />
          </Field>

          <Field label="Type de charge *" error={errorsByField['charge']}>
            <select
              data-testid="custom-charge"
              value={draft.charge}
              onChange={(e) =>
                setDraft((d) => ({ ...d, charge: e.target.value }))
              }
              className="w-full rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
            >
              {CHARGE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Pattern de mouvement *" error={errorsByField['pattern']}>
            <select
              data-testid="custom-pattern"
              value={draft.pattern}
              onChange={(e) =>
                setDraft((d) => ({ ...d, pattern: e.target.value }))
              }
              className="w-full rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
            >
              {PATTERN_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Catégorie">
            <div className="flex gap-2">
              {(['compound', 'isolation'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  data-testid={`custom-type-${t}`}
                  onClick={() => setDraft((d) => ({ ...d, type: t }))}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm transition',
                    draft.type === t
                      ? 'border-sang-700 bg-sang-900/30 text-white'
                      : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300',
                  )}
                >
                  {t === 'compound' ? 'Polyarticulaire' : 'Isolation'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Unilatéral (1 côté à la fois)">
            <button
              type="button"
              data-testid="custom-uni"
              onClick={() => setDraft((d) => ({ ...d, uni: !d.uni }))}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm transition',
                draft.uni
                  ? 'border-sang-700 bg-sang-900/30 text-white'
                  : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300',
              )}
            >
              {draft.uni ? '✓ Unilatéral' : 'Bilatéral'}
            </button>
          </Field>

          <Field
            label="Muscles travaillés *"
            error={errorsByField['muscles']}
            help="Tape un muscle pour cycler : — / secondaire (0.5) / principal (1.0)."
          >
            <div className="flex flex-wrap gap-1.5">
              {PICKER_MUSCLES.map((m) => {
                const coef = draft.muscles[m] ?? 0;
                const variant =
                  coef >= 0.99 ? 'primary' : coef >= 0.4 ? 'secondary' : 'off';
                return (
                  <button
                    key={m}
                    type="button"
                    data-testid={`custom-muscle-${m}`}
                    data-coef={coef}
                    onClick={() => cycleMuscle(m)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition',
                      variant === 'primary'
                        ? 'border-sang-500 bg-sang-700 text-white'
                        : variant === 'secondary'
                          ? 'border-sang-900 bg-sang-900/40 text-sang-200'
                          : 'border-anthracite-700 bg-anthracite-900 text-anthracite-300',
                    )}
                  >
                    {muscleLabel(m)}
                    {variant !== 'off' ? (
                      <span className="ml-1 text-[10px] opacity-70">
                        ({COEF_LABELS[String(coef)] ?? coef})
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field
            label="Équipement requis"
            help="Liste séparée par virgules. Ex : bb_oly, rack, bench_flat. Laisse vide pour bodyweight pur."
          >
            <input
              data-testid="custom-equip"
              type="text"
              placeholder="db, bench_flat"
              value={equipText}
              onChange={(e) => commitEquipText(e.target.value)}
              className="w-full rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
            />
          </Field>

          <Field label="Note (optionnel)">
            <textarea
              data-testid="custom-note"
              rows={2}
              placeholder="Tempo, points de vigilance, variation perso…"
              value={draft.note}
              onChange={(e) =>
                setDraft((d) => ({ ...d, note: e.target.value }))
              }
              className="w-full rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2 text-sm text-white outline-none focus:border-sang-700/60"
            />
          </Field>

          {confirmDuplicate !== null ? (
            <div
              data-testid="custom-dup-warning"
              className="rounded-lg border border-amber-700/60 bg-amber-900/20 p-3 text-sm text-amber-200"
            >
              <p className="font-semibold">
                Ressemble à : {confirmDuplicate.exercise.nom_fr}
              </p>
              <p className="mt-1 text-xs text-amber-300/80">
                {confirmDuplicate.kind === 'exact-name'
                  ? 'Le nom est déjà pris. Change le nom pour pouvoir créer.'
                  : 'Même pattern + charge + muscles primaires. Si tu as une vraie variation (tempo, pause, prise), continue. Sinon utilise l\'exo existant.'}
              </p>
            </div>
          ) : null}

          {serverError !== null ? (
            <p
              data-testid="custom-error"
              className="text-sm text-sang-400"
            >
              {serverError}
            </p>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={close} fullWidth>
              Annuler
            </Button>
            <Button
              variant="primary"
              fullWidth
              data-testid="custom-submit"
              onClick={() => void trySubmit()}
              disabled={submitting || !isValid}
            >
              {confirmDuplicate !== null &&
              confirmDuplicate.kind === 'similar-profile'
                ? 'Créer quand même'
                : 'Créer cet exo'}
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function Field({
  label,
  error,
  help,
  children,
}: {
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-anthracite-300">
        {label}
      </span>
      {children}
      {help !== undefined && error === undefined ? (
        <span className="text-[11px] leading-snug text-anthracite-400">
          {help}
        </span>
      ) : null}
      {error !== undefined ? (
        <span className="text-[11px] leading-snug text-sang-400">{error}</span>
      ) : null}
    </div>
  );
}
