import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Concept } from '@/components/Concept';
import { TrendArrow } from '@/components/icons';
import type { Catalog } from '@/engine/catalog';
import { displayExerciseName, kgUnitLabel } from '@/lib/catalog-filter';
import { useGymBrand } from '@/store/selectors';
import { GymBrand } from '@/engine/models';
import { cn } from '@/lib/cn';
import { MOTION } from '@/lib/motion';
import { useCountUp } from '@/hooks/useMotion';
import { sessionDisplayName } from '@/lib/session-label';
import { muscleLabel, volumeScale } from '@/lib/progress';
import { formatSets, markLabel, VolumeBar, VOLUME_TEXT } from '@/components/VolumeBar';
import type {
  PlafondChange,
  SessionMuscleVolume,
  SessionSummaryData,
} from '@/lib/session-runner';

interface SessionSummaryProps {
  readonly label: string;
  /** Bloc G (Conv #32) — nom custom de la séance, s'il y en a un. */
  readonly customName?: string | null;
  readonly data: SessionSummaryData;
  readonly catalog: Catalog | null;
  /**
   * Chantier B — la séance a été enregistrée en semaine de récupération EFFECTIVE
   * (semaine 5 + déload accepté). Aucune mesure de plafond n'est faite : on
   * l'explique au lieu du message « aucune série assez intense ».
   */
  readonly deloadActive?: boolean;
  readonly onClose: () => void;
}

/**
 * Conv #66 — chorégraphie du bilan.
 *
 * Le bilan est un écran de LECTURE : on s'autorise ~1,3 s de mouvement total, là
 * où la séance reste sous `MOTION.action` (on y consulte l'app entre deux séries).
 *
 * Les cartes arrivent en cascade. À l'intérieur de la carte volume, les lignes ne
 * rejouent PAS de cascade d'apparition : un mouvement dans un mouvement se lit
 * mal. C'est le remplissage décalé des barres qui porte la cascade.
 */
const cardDelayMs = (index: number): number => index * MOTION.staggerCard;

/**
 * Instant où la première barre démarre. La carte volume (index 2) apparaît à
 * `cardDelayMs(2)` et son `reveal-up` dure 420 ms, mais sa courbe est très rapide
 * au début : à 420 ms l'essentiel du fondu est joué, la barre peut partir.
 */
const BAR_BASE_DELAY_MS = cardDelayMs(2) + 260;

/**
 * Écran "État C" — bilan post-séance (cf. 08 §199).
 * Volume du jour, comparaison à la semaine dernière (même `label`), PR.
 */
export function SessionSummary({
  label,
  customName,
  data,
  catalog,
  deloadActive = false,
  onClose,
}: SessionSummaryProps) {
  const brand = useGymBrand() ?? undefined;
  return (
    <div className="flex flex-col gap-3" data-testid="session-summary">
      <Card
        className="motion-safe:animate-reveal-up"
        style={{ animationDelay: `${cardDelayMs(0)}ms` }}
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-anthracite-300">
            Bilan — {sessionDisplayName({ custom_name: customName, label })}
          </span>
          <span className="text-lg font-semibold text-white">
            Séance bouclée.
          </span>
        </div>
      </Card>

      <Card
        className="flex items-baseline gap-3 motion-safe:animate-reveal-up"
        style={{ animationDelay: `${cardDelayMs(1)}ms` }}
        data-testid="summary-sets"
      >
        <span className="font-display text-2xl font-semibold text-white tabular-nums">
          {data.setsCount}
        </span>
        <span className="text-sm text-anthracite-200">
          série{data.setsCount > 1 ? 's' : ''}
        </span>
        <span className="ml-auto text-sm tabular-nums text-anthracite-300">
          {data.exerciseCount} exercice{data.exerciseCount > 1 ? 's' : ''}
        </span>
      </Card>

      {data.muscleVolume.length > 0 && (
        <Card
          className="flex flex-col gap-2.5 motion-safe:animate-reveal-up"
          style={{ animationDelay: `${cardDelayMs(2)}ms` }}
          data-testid="summary-muscle-volume"
        >
          <h3 className="text-sm font-semibold text-white">
            Volume par muscle · cette semaine
          </h3>
          {data.muscleVolume.map((m, i) => (
            <MuscleVolumeRow
              key={m.muscle}
              data={m}
              scale={volumeScale(data.muscleVolume.map((v) => v.weekTotal))}
              delayMs={BAR_BASE_DELAY_MS + i * MOTION.stagger}
            />
          ))}
        </Card>
      )}

      <Card
        data-testid="summary-plafonds"
        className="flex flex-col gap-2 motion-safe:animate-reveal-up"
        style={{ animationDelay: `${cardDelayMs(3)}ms` }}
      >
        <h3 className="text-sm font-semibold text-white">
          Évolution des <Concept topic="plafond">Plafonds</Concept>
        </h3>
        {data.plafondChanges.length === 0 ? (
          <p className="text-xs text-anthracite-300">
            {deloadActive
              ? 'Semaine de récupération : tu lèves plus léger, donc rien à mesurer ici. Tes Plafonds sont conservés tels quels.'
              : 'Aucune série assez intense cette séance pour mettre à jour tes Plafonds.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {deloadActive && <RecoveryNote />}
            {data.plafondChanges.map((c) => (
              <PlafondRow
                key={c.exerciseId}
                change={c}
                name={nameOf(catalog, c.exerciseId, brand)}
                chargeLabel={chargeLabelOf(catalog, c.exerciseId)}
              />
            ))}
          </ul>
        )}
      </Card>

      <div
        className="flex flex-col gap-2 motion-safe:animate-reveal-up"
        style={{ animationDelay: `${cardDelayMs(4)}ms` }}
      >
        <Link to="/programme">
          <Button variant="primary" fullWidth onClick={onClose} data-testid="btn-back-programme">
            Retour au programme
          </Button>
        </Link>
      </div>
    </div>
  );
}

/**
 * A-3 (#73) — en récupération, le bilan affiche les Plafonds même quand ils ne
 * bougent pas (Δ 0). Sans un mot d'explication, une liste de Δ 0 se lit comme une
 * stagnation ; c'est au contraire le comportement voulu.
 */
function RecoveryNote() {
  return (
    <li className="text-xs text-anthracite-300">
      {'Semaine de récupération : une séance allégée ne fait jamais reculer ' +
        'un Plafond. Il ne bouge que si tu le bats.'}
    </li>
  );
}

/**
 * Formate une valeur INTERMÉDIAIRE de compteur avec la précision de sa cible.
 * Sans ça, un compteur qui monte vers 3 afficherait « 0,8 » puis « 1,9 » puis
 * « 3 » : la décimale apparaît et disparaît en cours de route.
 */
function formatSetsLike(v: number, target: number): string {
  return Number.isInteger(target) ? String(Math.round(v)) : v.toFixed(1).replace('.', ',');
}

/**
 * #13 (E-3), dump 2.4 étape 3 (n° 8) — ligne « volume d'un muscle » : apport de
 * la séance (+X), total de la semaine avec son repère, et la barre commune. Tous
 * les muscles travaillés ont leur barre, avec ou sans objectif.
 */
function MuscleVolumeRow({
  data,
  scale,
  delayMs,
}: {
  data: SessionMuscleVolume;
  scale: number;
  delayMs: number;
}) {
  const shownSets = useCountUp(data.sessionSets, MOTION.fill, delayMs);
  const mark = markLabel(data.intention, data.mark);

  return (
    <div className="flex flex-col gap-1" data-testid={`summary-muscle-${data.muscle}`}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-anthracite-200">
          {muscleLabel(data.muscle)}
          <span className="ml-1 text-emerald-400 tabular-nums">
            +{formatSetsLike(shownSets, data.sessionSets)}
          </span>
        </span>
        <span className={cn('shrink-0 tabular-nums', VOLUME_TEXT[data.status])}>
          {formatSets(data.weekTotal)}
          <span className="text-anthracite-400">
            {' '}
            {mark === null ? 'séries' : `séries · ${mark}`}
          </span>
        </span>
      </div>
      <VolumeBar
        sets={data.weekTotal}
        mark={data.mark}
        status={data.status}
        scale={scale}
        gained={data.sessionSets}
        delayMs={delayMs}
        testId={`summary-bar-${data.muscle}`}
      />
    </div>
  );
}

function nameOf(catalog: Catalog | null, exerciseId: string, brand?: GymBrand): string {
  if (catalog === null) return exerciseId;
  try {
    return displayExerciseName(catalog.get(exerciseId), brand);
  } catch {
    return exerciseId;
  }
}

function chargeLabelOf(catalog: Catalog | null, exerciseId: string): string {
  if (catalog === null) return 'kg';
  try {
    return kgUnitLabel(catalog.get(exerciseId).charge);
  } catch {
    return 'kg';
  }
}

/**
 * Conv #21 — Ligne d'évolution plafond pour un exo. Quatre rendus :
 *   - première calibration : "X kg · 1re mesure" (vert — on a un repère)
 *   - hausse : "X → Y kg (+Δ) ↑" (vert : progression)
 *   - stable : "X → Y kg →" (orange : plateau, on signale sans alarmer)
 *   - baisse : "X → Y kg (−Δ) ↓" (rouge : régression)
 *
 * Conv #24 (D11) — passage au code couleur feu tricolore (vert/orange/rouge),
 * aligné sur le bilan de cycle, et doublé d'une flèche de tendance pour ne pas
 * reposer sur la seule couleur (accessibilité). Avant, une hausse s'affichait
 * en sang (rouge) — contre-intuitif pour une bonne nouvelle.
 */
function PlafondRow({
  change,
  name,
  chargeLabel,
}: {
  change: PlafondChange;
  name: string;
  chargeLabel: string;
}) {
  const { exerciseId, oldE, newE, deltaKg } = change;
  const isFirst = oldE === null;
  const isUp = deltaKg !== null && deltaKg > 0.05;
  const isDown = deltaKg !== null && deltaKg < -0.05;
  const trend: 'up' | 'down' | 'flat' = isUp ? 'up' : isDown ? 'down' : 'flat';
  const toneClass = isUp
    ? 'text-emerald-400'
    : isDown
      ? 'text-red-400'
      : 'text-amber-400';

  return (
    <li
      data-testid={`plafond-${exerciseId}`}
      data-direction={isFirst ? 'first' : trend}
      className="flex items-baseline justify-between gap-2 text-sm"
    >
      <span className="min-w-0 flex-1 truncate text-white">{name}</span>
      {isFirst ? (
        <span className="shrink-0 tabular-nums text-emerald-400">
          {newE.toFixed(1)} {chargeLabel} · 1re mesure
        </span>
      ) : (
        <span className={cn('flex shrink-0 items-baseline gap-1 tabular-nums', toneClass)}>
          <TrendArrow trend={trend} className="self-center text-[0.9em]" />
          {oldE!.toFixed(1)} → {newE.toFixed(1)} {chargeLabel}
          {deltaKg !== null && Math.abs(deltaKg) >= 0.05 ? (
            <span className="text-xs">
              ({deltaKg > 0 ? '+' : ''}
              {deltaKg.toFixed(1)})
            </span>
          ) : null}
        </span>
      )}
    </li>
  );
}
