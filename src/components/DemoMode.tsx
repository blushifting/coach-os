/**
 * Mode démo Coach OS — tous les composants UI dans un seul fichier (Conv #13c).
 *
 * Monté en haut niveau dans `AppShell`. Quand `demoMode === true` (cf.
 * `lib/demo.ts`), affiche :
 *   - `<WelcomeOverlay>` : modal plein écran présentant Alex (1re fois).
 *   - `<ExitDemoButton>` : pill rouge fixe top-right, sortie en 1 clic.
 *   - `<HintBubble>` : bulle contextuelle (1 par route, dismissible par id).
 *   - `<DiscoveryChecklist>` : liste flottante 8 étapes, repliable, persiste
 *     les cases cochées dans `localStorage` (scope démo).
 *
 * Tous regroupés ici parce qu'aucune partie n'est réutilisée hors démo, et
 * un fichier court reste plus lisible que 5 fichiers de 30 lignes.
 *
 * **Pas de réécriture des selectors / hooks de l'app** : on swap au niveau
 * du store (cf. `enterDemoMode`), donc l'UI principale lit naturellement les
 * données d'Alex sans modification.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from './Button';
import { Card } from './Card';
import { useDemoMode, useDemoSnapshot } from '@/store/selectors';
import { exitDemoMode } from '@/lib/demo';

// =============================================================================
// Mapping route → hint contextuel (1 par page max)
// =============================================================================

interface RouteHint {
  /** Stable, sert de clé LS pour le dismiss. */
  id: string;
  /** Prefix de route — match avec `startsWith`. */
  matchPath: string;
  title: string;
  body: string;
}

const ROUTE_HINTS: readonly RouteHint[] = [
  {
    id: 'programme',
    matchPath: '/programme',
    title: 'Le programme d\'Alex',
    body:
      "Alex est en semaine 4 du 2ᵉ cycle. Le calendrier montre ses 7 semaines déjà jouées — y compris la semaine de déload (volume réduit) en S5. Tape une séance pour voir le détail.",
  },
  {
    id: 'seance',
    matchPath: '/seance',
    title: 'Une séance d\'Upper/Lower',
    body:
      "Voici la séance courante d'Alex. Les charges sont calées sur son plafond appris (e1RM), pas sur un %1RM figé. Tu verras le banner 'Plafond appris' sur les exos déjà calibrés.",
  },
  {
    id: 'progres',
    matchPath: '/progres',
    title: 'La progression d\'Alex',
    body:
      "Trois onglets : Volume hebdomadaire par muscle, courbes de Force par exo (+2 PR identifiés), et un bilan de cycle. Le déload S5 est visible comme creux normal — pas un plateau.",
  },
  {
    id: 'catalogue',
    matchPath: '/catalogue',
    title: "Le catalogue d'exos",
    body:
      "Les exos qu'Alex a déjà travaillés affichent leur plafond appris. Filtre 'Plafond mesuré' pour voir lesquels. Les swaps durables (front squat / tractions libres / DM haltères) apparaissent dans son programme.",
  },
  {
    id: 'profil',
    matchPath: '/profil',
    title: "Le profil d'Alex",
    body:
      "Alex : 30 ans, 75 kg, intermédiaire, 4 séances/sem. Force prioritaire sur le bas + dos + pec, hypertrophie sur les bras et épaules. Tu peux quitter la démo depuis Aide.",
  },
];

function useCurrentHint(): RouteHint | null {
  const { pathname } = useLocation();
  return useMemo(() => {
    for (const h of ROUTE_HINTS) {
      if (pathname === h.matchPath || pathname.startsWith(h.matchPath + '/')) {
        return h;
      }
    }
    return null;
  }, [pathname]);
}

// =============================================================================
// Discovery checklist (8 étapes)
// =============================================================================

interface ChecklistItem {
  id: string;
  label: string;
  /** Route à visiter pour valider l'étape. */
  matchPath: string;
}

const CHECKLIST: readonly ChecklistItem[] = [
  { id: 'open-programme', label: "Ouvrir l'onglet Programme", matchPath: '/programme' },
  { id: 'open-seance', label: 'Inspecter une séance', matchPath: '/seance' },
  { id: 'open-progres', label: 'Voir les courbes de Force', matchPath: '/progres' },
  { id: 'open-catalogue', label: 'Explorer le catalogue', matchPath: '/catalogue' },
  { id: 'open-profil', label: 'Consulter le profil', matchPath: '/profil' },
  { id: 'open-cycle-bilan', label: 'Lire le bilan de cycle', matchPath: '/cycle-bilan' },
  { id: 'see-watermark', label: 'Repérer le filigrane Kotsh', matchPath: '/' },
  { id: 'exit', label: 'Quitter la démo quand prêt', matchPath: '__exit__' },
];

const LS_CHECKLIST = 'coach-os.demo-checklist';
const LS_HINT_DISMISSED = 'coach-os.demo-hint-dismissed';
const LS_WELCOME_SEEN = 'coach-os.demo-welcome-seen';

function readLsSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writeLsSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // ignore (mode privé, etc.)
  }
}

// =============================================================================
// Welcome overlay
// =============================================================================

function WelcomeOverlay({ onClose }: { onClose: () => void }) {
  const snap = useDemoSnapshot();
  if (snap === null) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenue dans la démo"
      data-testid="demo-welcome-overlay"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-6 backdrop-blur-md"
    >
      <div className="w-full max-w-md rounded-2xl border border-sang-700 bg-anthracite-900 p-6 shadow-2xl">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          Tuto démo
        </span>
        <h2 className="mt-1 font-display text-2xl leading-tight text-white">
          {snap.persona.label}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-anthracite-200">
          {snap.persona.summary}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-anthracite-300">
          Navigue librement dans l'app. Tes vraies données sont en pause — rien
          n'est modifié. Clique <span className="text-sang-400">Quitter la démo</span>{' '}
          en haut à droite quand tu veux retourner à ton profil.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="primary"
            fullWidth
            onClick={onClose}
            data-testid="btn-demo-start"
          >
            Démarrer la visite
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Exit demo button (fixé top-right)
// =============================================================================

function ExitDemoButton() {
  return (
    <button
      type="button"
      data-testid="btn-exit-demo"
      onClick={() => exitDemoMode()}
      className="fixed right-3 z-[55] rounded-full bg-sang-600 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white shadow-lg hover:bg-sang-500"
      style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}
    >
      Quitter la démo
    </button>
  );
}

// =============================================================================
// Hint bubble (1 par route, dismissible)
// =============================================================================

function HintBubble({
  hint,
  dismissed,
  onDismiss,
}: {
  hint: RouteHint;
  dismissed: boolean;
  onDismiss: () => void;
}) {
  if (dismissed) return null;
  return (
    <div
      data-testid={`demo-hint-${hint.id}`}
      className="pointer-events-auto fixed left-3 right-3 z-[54] mx-auto max-w-md"
      style={{ bottom: 'max(env(safe-area-inset-bottom), 5.5rem)' }}
    >
      <Card accent className="relative flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="Masquer la bulle"
          data-testid={`btn-dismiss-hint-${hint.id}`}
          onClick={onDismiss}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-anthracite-300 hover:text-white"
        >
          ×
        </button>
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
          Astuce
        </span>
        <h3 className="pr-6 font-display text-base leading-snug text-white">
          {hint.title}
        </h3>
        <p className="text-xs leading-relaxed text-anthracite-300">{hint.body}</p>
      </Card>
    </div>
  );
}

// =============================================================================
// Discovery checklist (8 étapes, repliable)
// =============================================================================

function DiscoveryChecklist({
  done,
  collapsed,
  onToggleCollapsed,
}: {
  done: Set<string>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const total = CHECKLIST.length;
  const doneCount = done.size;
  return (
    <div
      data-testid="demo-checklist"
      className="fixed right-3 z-[53] w-64"
      style={{ top: 'max(env(safe-area-inset-top), 3.25rem)' }}
    >
      <Card padded={false}>
        <button
          type="button"
          data-testid="btn-toggle-checklist"
          onClick={onToggleCollapsed}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-anthracite-300">
            Découverte ({doneCount}/{total})
          </span>
          <span className="text-sm text-anthracite-300">
            {collapsed ? '▾' : '▴'}
          </span>
        </button>
        {!collapsed && (
          <ul className="border-t border-anthracite-700 px-3 py-2 text-xs text-anthracite-200">
            {CHECKLIST.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-2 py-1"
                data-testid={`checklist-${it.id}`}
              >
                <span
                  className={
                    done.has(it.id)
                      ? 'inline-block h-3 w-3 rounded-sm bg-sang-500'
                      : 'inline-block h-3 w-3 rounded-sm border border-anthracite-500'
                  }
                />
                <span
                  className={done.has(it.id) ? 'line-through opacity-60' : ''}
                >
                  {it.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// =============================================================================
// Provider master
// =============================================================================

export function DemoModeProvider() {
  const active = useDemoMode();
  const { pathname } = useLocation();
  const currentHint = useCurrentHint();

  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  // Ouvre la welcome overlay une fois par session démo (LS-scoped).
  useEffect(() => {
    if (!active) return;
    const seen = localStorage.getItem(LS_WELCOME_SEEN) === '1';
    setWelcomeOpen(!seen);
    setHintDismissed(readLsSet(LS_HINT_DISMISSED));
    setDone(readLsSet(LS_CHECKLIST));
  }, [active]);

  // À chaque changement de route en démo, marque l'étape correspondante.
  useEffect(() => {
    if (!active) return;
    setDone((prev) => {
      let next: Set<string> | null = null;
      for (const it of CHECKLIST) {
        if (it.matchPath === '__exit__') continue;
        if (
          (pathname === it.matchPath ||
            pathname.startsWith(it.matchPath + '/')) &&
          !prev.has(it.id)
        ) {
          next ??= new Set(prev);
          next.add(it.id);
        }
      }
      if (next === null) return prev;
      writeLsSet(LS_CHECKLIST, next);
      return next;
    });
  }, [pathname, active]);

  if (!active) return null;

  function closeWelcome() {
    try {
      localStorage.setItem(LS_WELCOME_SEEN, '1');
    } catch {
      /* ignore */
    }
    setWelcomeOpen(false);
  }

  function dismissHint(id: string) {
    setHintDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeLsSet(LS_HINT_DISMISSED, next);
      return next;
    });
  }

  return (
    <>
      {welcomeOpen && <WelcomeOverlay onClose={closeWelcome} />}
      <ExitDemoButton />
      <DiscoveryChecklist
        done={done}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />
      {currentHint !== null && !welcomeOpen && (
        <HintBubble
          hint={currentHint}
          dismissed={hintDismissed.has(currentHint.id)}
          onDismiss={() => dismissHint(currentHint.id)}
        />
      )}
    </>
  );
}

/**
 * Helpers exposés pour tests / scripts. Le reset des dismiss permet de
 * re-déclencher la démo "comme la 1re fois" depuis Profil > Aide.
 */
export function resetDemoDismissals(): void {
  try {
    localStorage.removeItem(LS_WELCOME_SEEN);
    localStorage.removeItem(LS_HINT_DISMISSED);
    localStorage.removeItem(LS_CHECKLIST);
  } catch {
    /* ignore */
  }
}
