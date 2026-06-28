/**
 * Widgets dashboard Programme (Conv #5a, refonte visuelle #14a-2).
 *
 * Quatre tuiles côte à côte, chacune avec un support visuel distinct pour
 * casser la monotonie d'une grille 2×2 de chiffres identiques :
 *  - Série de semaines    → flamme stylisée + compteur.
 *  - Cette semaine        → ProgressRing avec done/total au centre.
 *  - Cycle (séances)      → ProgressRing avec % au centre.
 *  - Prochain bilan       → barre horizontale temporelle (jours).
 *
 * Les `data-testid` historiques sont conservés à l'identique.
 */

import { Card } from '@/components/Card';
import { HelpButton } from '@/components/HelpButton';
import { ProgressRing } from '@/components/ProgressRing';
import { cn } from '@/lib/cn';
import type {
  CycleProgress,
  CycleTimeProgress,
  WeekSessions,
} from '@/lib/dashboard';

interface WidgetsProps {
  readonly streak: number;
  readonly cycleProgress: CycleProgress;
  readonly weekSessions: WeekSessions;
  readonly nextBilanDate: string | null;
  readonly cycleTime: CycleTimeProgress | null;
}

export function Widgets({
  streak,
  cycleProgress,
  weekSessions,
  nextBilanDate,
  cycleTime,
}: WidgetsProps) {
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="programme-widgets">
      <StreakWidget streak={streak} />
      <WeekSessionsWidget sessions={weekSessions} />
      <CyclePctWidget cycle={cycleProgress} />
      <NextBilanWidget date={nextBilanDate} time={cycleTime} />
    </div>
  );
}

// =============================================================================
// Streak — flamme stylisée + compteur
// =============================================================================

function StreakWidget({ streak }: { readonly streak: number }) {
  const active = streak > 0;
  // Conv #18 — "Série" renommé "Régularité" pour éviter la confusion avec
  // une série d'exercice (set). Le sublabel "semaine(s) d'affilée" rend
  // explicite l'unité du compteur.
  return (
    <WidgetShell testId="widget-streak" label="Régularité">
      <div className="flex flex-1 items-center gap-3">
        <Flame active={active} />
        <div className="flex flex-col leading-none">
          <span className="font-display text-3xl font-bold tabular-nums text-white">
            {active ? streak : '—'}
          </span>
          <span className="mt-1 text-[11px] text-anthracite-300">
            {active
              ? streak === 1
                ? "semaine d'affilée"
                : "semaines d'affilée"
              : 'à démarrer'}
          </span>
        </div>
      </div>
    </WidgetShell>
  );
}

/**
 * Flamme SVG stylisée. Active = remplie sang avec dégradé + lueur ; inactive
 * = silhouette anthracite sans halo. Forme simplifiée (path à 1 courbe)
 * pour rester lisible à 32 px.
 */
function Flame({ active }: { readonly active: boolean }) {
  return (
    <svg
      viewBox="0 0 32 40"
      className="h-10 w-8 shrink-0"
      role="img"
      aria-hidden="true"
      style={
        active
          ? { filter: 'drop-shadow(0 0 6px rgba(204,74,89,0.55))' }
          : undefined
      }
    >
      <defs>
        <linearGradient id="flame-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#7a1a25" />
          <stop offset="55%" stopColor="#cc4a59" />
          <stop offset="100%" stopColor="#f8c25d" />
        </linearGradient>
      </defs>
      {/* Silhouette principale — flamme avec base large et pointe légèrement
          inclinée. Construit avec une seule courbe + retour. */}
      <path
        d="M16 3
           C 19 9 24 12 24 19
           C 24 26 20 31 16 31
           C 12 31 8 26 8 19
           C 8 14 12 11 13 7
           C 13 9 14 11 16 12
           Z"
        fill={active ? 'url(#flame-grad)' : 'rgba(154,160,170,0.28)'}
      />
      {/* Cœur intérieur — gouttelette plus claire visible seulement en actif. */}
      {active && (
        <path
          d="M16 14
             C 17.5 17 20 19 20 22.5
             C 20 26 18 28.5 16 28.5
             C 14 28.5 12 26 12 22.5
             C 12 19.5 14 18 15 16
             Z"
          fill="#ffe7c2"
          opacity="0.85"
        />
      )}
    </svg>
  );
}

// =============================================================================
// Cette semaine — ProgressRing done/total
// =============================================================================

function WeekSessionsWidget({ sessions }: { readonly sessions: WeekSessions }) {
  const hasPlan = sessions.planned > 0;
  return (
    <WidgetShell testId="widget-week-sessions" label="Cette semaine">
      <div className="flex flex-1 items-center gap-3">
        <ProgressRing
          value={sessions.done}
          total={hasPlan ? sessions.planned : 1}
          size={52}
          strokeWidth={5}
        />
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-3xl font-bold tabular-nums text-white">
              {sessions.done}
            </span>
            {hasPlan && (
              <span className="text-sm text-anthracite-300 tabular-nums">
                / {sessions.planned}
              </span>
            )}
          </div>
          <span className="mt-1 text-[11px] text-anthracite-300">séances</span>
        </div>
      </div>
    </WidgetShell>
  );
}

// =============================================================================
// Cycle — ProgressRing % au centre
// =============================================================================

function CyclePctWidget({ cycle }: { readonly cycle: CycleProgress }) {
  const pctSafe = Math.max(0, Math.min(100, cycle.pct));
  return (
    <WidgetShell
      testId="widget-cycle-pct"
      label="Cycle"
      helpTopic="cycle"
    >
      <div className="flex flex-1 items-center gap-3">
        <div className="relative inline-flex items-center justify-center">
          <ProgressRing
            value={pctSafe}
            total={100}
            size={52}
            strokeWidth={5}
          />
          {/* Conv #17 — à 100 %, on masque le label "%" : l'anneau vert
              d'accomplissement parle de lui-même et serait sinon écrasé. */}
          {pctSafe < 100 && (
            <span className="absolute font-display text-[11px] font-semibold leading-none tabular-nums text-white">
              {pctSafe}%
            </span>
          )}
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-semibold text-white tabular-nums">
            {cycle.planned > 0 ? `${cycle.done}/${cycle.planned}` : '—'}
          </span>
          <span className="mt-1 text-[11px] text-anthracite-300">
            {cycle.planned > 0 ? 'séances faites' : 'aucun cycle en cours'}
          </span>
        </div>
      </div>
    </WidgetShell>
  );
}

// =============================================================================
// Prochain bilan — barre horizontale temporelle
// =============================================================================

function NextBilanWidget({
  date,
  time,
}: {
  readonly date: string | null;
  readonly time: CycleTimeProgress | null;
}) {
  const hasCycle = date !== null && time !== null;
  const pct = hasCycle ? Math.max(0, Math.min(100, time.pct)) : 0;
  const daysLeftLabel = (() => {
    if (!hasCycle) return 'cycle non démarré';
    if (time.daysLeft === 0) return "aujourd'hui";
    if (time.daysLeft === 1) return 'dans 1 jour';
    return `dans ${time.daysLeft} jours`;
  })();
  return (
    <WidgetShell testId="widget-next-bilan" label="Prochain bilan">
      <div className="flex flex-1 flex-col justify-center gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-2xl font-bold tabular-nums leading-none text-white">
            {hasCycle ? formatShortDate(date) : '—'}
          </span>
          <span className="text-[11px] tabular-nums text-anthracite-300">
            {daysLeftLabel}
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-anthracite-700">
          <div
            className={cn(
              'h-full bg-gradient-to-r from-sang-700 to-sang-500 transition-[width] duration-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </WidgetShell>
  );
}

// =============================================================================
// Shell commun (Card + header label/help)
// =============================================================================

interface WidgetShellProps {
  readonly testId: string;
  readonly label: string;
  readonly helpTopic?: import('@/lib/help-glossary').HelpTopic;
  readonly children: React.ReactNode;
}

function WidgetShell({ testId, label, helpTopic, children }: WidgetShellProps) {
  return (
    <Card className="flex min-h-[96px] flex-col gap-2" data-testid={testId}>
      <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-anthracite-300">
        {label}
        {helpTopic && <HelpButton topic={helpTopic} label={`Aide : ${label}`} />}
      </span>
      {children}
    </Card>
  );
}

function formatShortDate(iso: string): string {
  // YYYY-MM-DD → "07/06"
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
