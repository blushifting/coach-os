/**
 * Mode démo Coach OS — visite guidée linéaire (Conv #13d/e, refonte de #13c).
 *
 * Le tuto est désormais un parcours **scénarisé en 6 étapes** orchestré par
 * `<GuidedTour>` : pas de checklist, pas de bulles éparpillées par route.
 * Une narration unique en bas d'écran + bouton "Suivant" qui navigue
 * automatiquement vers la route de l'étape suivante.
 *
 * Composants exportés :
 * - `<DemoModeProvider>` monté dans AppShell, ne rend rien hors démo.
 * - `<WelcomeOverlay>` modal d'introduction (1× par session démo).
 * - `<ExitDemoButton>` pill rouge fixe top-right, sortie en 1 clic.
 * - `<GuidedTour>` bandeau narratif fixe en bas + bulle/flèche optionnelle
 *   sur l'élément central de la page.
 *
 * Pendant la démo, `userState` + `history` + `currentSessionPlan` +
 * `lastCycleReview` viennent du snapshot (cf. `lib/demo.ts`). Aucune
 * écriture DB Dexie.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { Card } from './Card';
import { useDemoMode, useDemoSnapshot } from '@/store/selectors';
import { exitDemoMode } from '@/lib/demo';

// =============================================================================
// Script du tour — 6 étapes
// =============================================================================

interface TourStep {
  id: string;
  /** Route à atteindre. Le tour y navigue automatiquement. */
  route: string;
  /** Titre court de l'étape (titre du bandeau). */
  title: string;
  /** 1-3 phrases. Évite le jargon — explique avec les mots de l'utilisateur. */
  body: string;
  /**
   * Sélecteur CSS de l'élément central à pointer (optionnel). Le bandeau
   * affichera une flèche pointant vers cet élément. Si l'élément n'existe
   * pas (timing route), la flèche est cachée silencieusement.
   */
  pointTo?: string;
  /**
   * Si défini, déclenche une animation visuelle ciblée à l'arrivée sur la
   * route — pour V1, juste une class CSS posée 600 ms sur l'élément.
   */
  highlight?: { selector: string; className: string; durationMs: number };
  /**
   * Si défini, simule un clic sur l'élément à l'entrée de l'étape — utilisé
   * pour basculer sur un sous-onglet (ex: `tab-force` dans /progres) qui est
   * un état local de page non exposé en route.
   */
  clickOnEnter?: string;
}

const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'programme',
    route: '/programme',
    title: 'Le programme d\'Alex',
    body:
      "Alex est mardi de la semaine 4. Hier (lundi), il a fait son Upper A. Aujourd'hui : Lower A. Le calendrier montre toutes les séances déjà jouées sur 8 semaines.",
    pointTo: '[data-testid="condensed-calendar"]',
  },
  {
    id: 'seance',
    route: '/seance/runner',
    title: 'Sa séance du jour',
    body:
      "Voici l'interface séance. Pour chaque série tu coches dès que tu l'as faite, puis tu indiques ton effort perçu (sur 10). Kotsh apprend ton plafond à chaque saisie — pas besoin de calibration préalable.",
    pointTo: '[data-testid="set-row-0"]',
    highlight: {
      selector: '[data-testid="set-row-0"]',
      className: 'animate-row-flash',
      durationMs: 700,
    },
  },
  {
    id: 'progres-force',
    route: '/progres',
    title: 'Ses plafonds qui montent',
    body:
      "Au bout de 8 semaines, voici la progression d'Alex sur ses gros exercices. Le squat est passé de 120 à 127 kg. Les points hauts = records personnels.",
    pointTo: '[data-testid="force-view"]',
    clickOnEnter: '[data-testid="tab-force"]',
  },
  {
    id: 'cycle-bilan',
    route: '/cycle-bilan',
    title: 'Le bilan de cycle',
    body:
      "À la fin du cycle, Kotsh résume tes progrès muscle par muscle et te suggère la suite : continuer pareil, ajuster les objectifs, ou déloader. Ici : continuer.",
    pointTo: '[data-testid="cycle-bilan-page"]',
  },
  {
    id: 'profil',
    route: '/profil',
    title: 'Son profil',
    body:
      "Alex : 30 ans, 75 kg, intermédiaire. 6 muscles prioritaires en force (pectoraux, quadriceps, dos…), bras et épaules en hypertrophie. Tu fixeras le tien à la fin de la démo.",
    pointTo: '[data-testid="profil-identity-summary"]',
  },
  {
    id: 'done',
    route: '/programme',
    title: 'À toi de jouer',
    body:
      "Tu as vu la boucle complète. Quitte la démo pour revenir à ton profil et démarrer ta vraie 1re séance — l'app apprend en marchant, pas besoin de tout connaître pour commencer.",
  },
];

const LS_WELCOME_SEEN = 'coach-os.demo-welcome-seen';

// =============================================================================
// Welcome overlay
// =============================================================================

function WelcomeOverlay({ onStart }: { onStart: () => void }) {
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
          Visite guidée
        </span>
        <h2 className="mt-1 font-display text-2xl leading-tight text-white">
          {snap.persona.label}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-anthracite-200">
          {snap.persona.summary}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-anthracite-300">
          Tu peux quitter à tout moment via le bouton{' '}
          <span className="text-sang-400">Quitter la démo</span> en haut à
          droite — tes vraies données ne sont jamais modifiées.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="primary"
            fullWidth
            onClick={onStart}
            data-testid="btn-demo-start"
          >
            Commencer la visite
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Exit demo button (top-right)
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
// Détection de sheet/dialog ouverte
// =============================================================================

/**
 * Observe le DOM pour détecter si un `<div role="dialog">` est monté ailleurs
 * que notre propre overlay welcome — auquel cas on masque le bandeau narratif
 * pour ne pas chevaucher (sheets de détail séance, Aide, etc.).
 */
function useDialogOverlaying(): boolean {
  const [hasDialog, setHasDialog] = useState(false);
  useEffect(() => {
    function refresh() {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      // Ignore notre overlay welcome (déjà géré par l'état welcomeOpen)
      let count = 0;
      dialogs.forEach((el) => {
        if (el.getAttribute('data-testid') !== 'demo-welcome-overlay') count++;
      });
      setHasDialog(count > 0);
    }
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return hasDialog;
}

// =============================================================================
// Bandeau narratif + flèche pointeur
// =============================================================================

function PointerArrow({ targetSelector }: { targetSelector: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function refresh() {
      const el = document.querySelector(targetSelector);
      if (el === null) {
        setPos(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top });
    }
    refresh();
    const ro = new ResizeObserver(refresh);
    ro.observe(document.body);
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    // Retry court pour les routes qui montent leurs éléments en async.
    const t = window.setTimeout(refresh, 200);
    const t2 = window.setTimeout(refresh, 600);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [targetSelector]);

  if (pos === null) return null;
  // Flèche SVG verticale pointant vers le haut (target), placée juste
  // au-dessus du bandeau (qui occupe les ~140 px du bas).
  const arrowBottomPx = 152; // hauteur bandeau approx + marge
  return (
    <svg
      aria-hidden="true"
      data-testid="demo-pointer-arrow"
      className="pointer-events-none fixed z-[53]"
      style={{
        left: pos.x - 14,
        bottom: arrowBottomPx,
        width: 28,
        height: 36,
      }}
      viewBox="0 0 28 36"
      fill="none"
    >
      <path
        d="M14 0 L14 28 M14 28 L6 20 M14 28 L22 20"
        stroke="#e11d48"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-[0_0_6px_rgba(225,29,72,0.6)]"
      />
    </svg>
  );
}

function GuidedTourBanner({
  step,
  index,
  total,
  onNext,
  onPrev,
  onFinish,
}: {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onFinish: () => void;
}) {
  const hidden = useDialogOverlaying();
  if (hidden) return null;
  const isLast = index === total - 1;
  return (
    <>
      {step.pointTo !== undefined && <PointerArrow targetSelector={step.pointTo} />}
      <div
        data-testid={`demo-tour-step-${step.id}`}
        className="pointer-events-auto fixed left-3 right-3 z-[54] mx-auto max-w-md"
        style={{ bottom: 'max(env(safe-area-inset-bottom), 4.25rem)' }}
      >
        <Card
          className="relative flex flex-col gap-2 border-2 border-sang-600 shadow-glow-sang-lg ring-2 ring-sang-600/20"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
              <span className="inline-block rounded-full bg-sang-600 px-1.5 text-white">
                ⓘ
              </span>{' '}
              Étape {index + 1} / {total}
            </span>
          </div>
          <h3 className="font-display text-base leading-snug text-white">
            {step.title}
          </h3>
          <p className="text-xs leading-relaxed text-anthracite-200">
            {step.body}
          </p>
          <div className="mt-1 flex gap-2">
            <Button
              variant="secondary"
              onClick={onPrev}
              disabled={index === 0}
              data-testid="btn-tour-prev"
            >
              Précédent
            </Button>
            {isLast ? (
              <Button
                variant="primary"
                fullWidth
                onClick={onFinish}
                data-testid="btn-tour-finish"
              >
                Démarrer ma vraie 1re séance
              </Button>
            ) : (
              <Button
                variant="primary"
                fullWidth
                onClick={onNext}
                data-testid="btn-tour-next"
              >
                Suivant
              </Button>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

// =============================================================================
// Provider master
// =============================================================================

export function DemoModeProvider() {
  const active = useDemoMode();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Ouvre la welcome overlay 1× par session démo (LS). Et reset l'index à 0
  // à chaque entrée dans la démo (pas de reprise mi-parcours).
  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      setWelcomeOpen(false);
      return;
    }
    setStepIndex(0);
    const seen = (() => {
      try {
        return localStorage.getItem(LS_WELCOME_SEEN) === '1';
      } catch {
        return false;
      }
    })();
    setWelcomeOpen(!seen);
  }, [active]);

  const currentStep = TOUR_STEPS[stepIndex] ?? null;

  // Synchronise la route active avec le step courant : si on bascule d'étape,
  // on navigue vers la nouvelle route. On évite la nav si on y est déjà.
  useEffect(() => {
    if (!active || welcomeOpen || currentStep === null) return;
    if (pathname !== currentStep.route) {
      navigate(currentStep.route);
    }
  }, [active, welcomeOpen, currentStep, pathname, navigate]);

  // Déclenche la highlight ponctuelle (si l'étape en a une).
  useEffect(() => {
    if (!active || welcomeOpen || currentStep === null) return;
    const hl = currentStep.highlight;
    if (hl === undefined) return;
    // Attend que l'élément cible soit monté.
    const t1 = window.setTimeout(() => {
      const el = document.querySelector(hl.selector);
      if (el === null) return;
      el.classList.add(hl.className);
      window.setTimeout(() => el.classList.remove(hl.className), hl.durationMs);
    }, 300);
    return () => window.clearTimeout(t1);
  }, [active, welcomeOpen, currentStep]);

  // Click programmatique à l'entrée (pour basculer sur un sous-onglet).
  useEffect(() => {
    if (!active || welcomeOpen || currentStep === null) return;
    const sel = currentStep.clickOnEnter;
    if (sel === undefined) return;
    // 2 tentatives — le composant cible peut monter en async.
    const tryClick = () => {
      const el = document.querySelector(sel);
      if (el instanceof HTMLElement) {
        el.click();
        return true;
      }
      return false;
    };
    const t1 = window.setTimeout(() => {
      if (!tryClick()) {
        window.setTimeout(tryClick, 350);
      }
    }, 120);
    return () => window.clearTimeout(t1);
  }, [active, welcomeOpen, currentStep]);

  const closeWelcome = useCallback(() => {
    try {
      localStorage.setItem(LS_WELCOME_SEEN, '1');
    } catch {
      /* ignore */
    }
    setWelcomeOpen(false);
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
  }, []);
  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);
  const finish = useCallback(() => {
    exitDemoMode();
    navigate('/programme');
  }, [navigate]);

  const total = TOUR_STEPS.length;

  if (!active) return null;

  return (
    <>
      {welcomeOpen && <WelcomeOverlay onStart={closeWelcome} />}
      <ExitDemoButton />
      {!welcomeOpen && currentStep !== null && (
        <GuidedTourBanner
          step={currentStep}
          index={stepIndex}
          total={total}
          onNext={next}
          onPrev={prev}
          onFinish={finish}
        />
      )}
    </>
  );
}

/**
 * Reset des dismissals LS — utilisé par les entry points (WelcomeBanner,
 * Profil > Aide) pour que la démo redémarre "comme la 1re fois" même si
 * l'utilisateur avait déjà vu la welcome overlay.
 */
export function resetDemoDismissals(): void {
  try {
    localStorage.removeItem(LS_WELCOME_SEEN);
  } catch {
    /* ignore */
  }
}

// Export utile aux tests : nombre d'étapes du tour.
export const TOUR_TOTAL_STEPS = TOUR_STEPS.length;

// Réexport implicite — utile pour tests si on veut le step ids.
export const TOUR_STEP_IDS = TOUR_STEPS.map((s) => s.id);
