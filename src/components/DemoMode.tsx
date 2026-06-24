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

type BannerSide = 'top' | 'bottom';

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
   * Conv #15 vague 3 — force la position du bandeau ('top' ou 'bottom').
   * Sans ça, défaut = 'bottom' (auto-positionnement Conv #14d retiré car
   * il sautait visuellement entre étapes — Azur préfère une position
   * stable).
   */
  bannerSide?: BannerSide;
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
    title: "Le programme d'Alex",
    body:
      "Alex est mardi de la semaine 4 de son 2ᵉ cycle (les cycles font 5 semaines : 4 d'entraînement + 1 de déload). Hier il a fait la séance A (Upper), aujourd'hui c'est la séance B (Lower). Le calendrier ci-dessous montre les semaines du cycle en cours, avec les séances faites en vert, prévues en bleu et le repos en grisé.",
    pointTo: '[data-testid="condensed-calendar"]',
    bannerSide: 'top',
  },
  {
    id: 'seance',
    route: '/seance/runner',
    title: 'Sa séance du jour',
    body:
      "Voici l'interface séance. Les valeurs pré-remplies (reps, charge) sont des objectifs à viser — si en réalité tu fais plus ou moins, modifie les chiffres avant de cocher. Kotsh ajuste ensuite tes objectifs en fonction de tes retours.",
    pointTo: '[data-testid="set-row-0"]',
    highlight: {
      selector: '[data-testid="set-row-0"]',
      className: 'animate-row-flash',
      durationMs: 700,
    },
  },
  // Conv #15-9 — étape dédiée à la Réserve (notion clé, mal comprise au 1er
  // contact). Pointe directement sur la cellule "réserve" de la 1re série.
  {
    id: 'effort',
    route: '/seance/runner',
    title: 'La Réserve, le cœur du système',
    body:
      "À la fin de chaque série, note combien de reps tu aurais encore pu faire : c'est ta Réserve. Repère : 4+ = encore très facile. 2 = dur, tu aurais pu en faire 2 de plus. Échec = tu ne peux plus. Kotsh s'en sert pour ajuster automatiquement tes charges à la séance suivante — c'est ce qui rend le programme autorégulé.",
    pointTo: '[data-testid="input-rpe-0"]',
  },
  {
    id: 'progres-force',
    route: '/progres',
    title: 'Ses plafonds qui montent',
    body:
      "Voici la progression d'Alex sur ses gros exercices. Les étoiles ★ marquent les records personnels (plafond battu d'au moins 2 kg). Les plateaux ou petits creux ponctuels correspondent à une semaine plus dure (peu de reps en réserve, fatigue accumulée) ; les semaines de déload réduisent volontairement les charges pour récupérer, sans qu'elles n'apparaissent comme du recul.",
    pointTo: '[data-testid="force-view"]',
    clickOnEnter: '[data-testid="tab-force"]',
  },
  {
    id: 'cycle-bilan',
    route: '/cycle-bilan',
    title: 'Le bilan de cycle',
    body:
      "À la fin du cycle, Kotsh résume tes progrès muscle par muscle et te suggère comment programmer ton cycle suivant : continuer pareil, ajuster les objectifs, ou déloader.",
    pointTo: '[data-testid="cycle-bilan-page"]',
  },
  // Conv #15-3 — étape 'profil' retirée : le profil est déjà fixé par
  // l'utilisateur avant de lancer la démo, donc le panneau "Alex : 30 ans,
  // 75 kg…" sème la confusion. On enchaîne direct du bilan vers la sortie.
  {
    id: 'done',
    route: '/programme',
    title: 'À toi de jouer',
    body:
      "Tu as vu la boucle complète. Quitte la démo pour revenir à ton profil et reprendre ton entraînement — le reste des fonctionnalités viendra naturellement.",
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
        <p className="mt-3 text-justify text-sm leading-relaxed text-anthracite-200 hyphens-auto">
          {snap.persona.summary}
        </p>
        <p className="mt-3 text-justify text-xs leading-relaxed text-anthracite-300 hyphens-auto">
          Tu peux quitter à tout moment via le bouton{' '}
          <span className="text-sang-400">Quitter la démo</span> en haut à
          droite. Tes vraies données ne sont jamais modifiées.
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

function ExitDemoButton({ onExit }: { onExit: () => void }) {
  return (
    <button
      type="button"
      data-testid="btn-exit-demo"
      onClick={onExit}
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

interface TargetMeasure {
  /** x du centre du target. */
  readonly cx: number;
  /** y du centre du target. */
  readonly cy: number;
  /** Côté où placer le bandeau pour ne pas masquer le target. */
  readonly side: BannerSide;
}

/**
 * Mesure la position d'un élément ciblé par sélecteur CSS. Réobserve sur
 * resize / scroll / mutation pour suivre les routes async.
 */
function useTargetMeasure(targetSelector: string | undefined): TargetMeasure | null {
  const [m, setM] = useState<TargetMeasure | null>(null);

  useEffect(() => {
    if (targetSelector === undefined) {
      setM(null);
      return;
    }
    function refresh() {
      const el = document.querySelector(targetSelector!);
      if (el === null) {
        setM(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Si la moitié basse de la viewport → bandeau en haut, pour ne pas
      // masquer le target.
      const side: BannerSide = cy > window.innerHeight / 2 ? 'top' : 'bottom';
      setM({ cx, cy, side });
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

  return m;
}

function PointerArrow({ measure, side }: { measure: TargetMeasure; side: BannerSide }) {
  // Conv #15-8 / #15 vague 3 — flèche orientée selon le côté EFFECTIF du
  // bandeau (passé par le parent, plus calculé depuis measure.side car
  // on a maintenant une position fixe par step).
  const isBottomBanner = side === 'bottom';
  // Distance entre l'extrémité de la flèche et le bord du bandeau.
  const BANNER_OFFSET = 152; // hauteur bandeau approx + marge
  const baseStyle: React.CSSProperties = {
    left: measure.cx - 14,
    width: 28,
    height: 36,
  };
  const style: React.CSSProperties = isBottomBanner
    ? { ...baseStyle, bottom: BANNER_OFFSET }
    : { ...baseStyle, top: BANNER_OFFSET };
  // 2 paths SVG : un avec flèche vers le haut (bandeau en bas), un vers le
  // bas (bandeau en haut).
  const arrowPath = isBottomBanner
    ? 'M14 0 L14 28 M14 28 L6 20 M14 28 L22 20'
    : 'M14 36 L14 8 M14 8 L6 16 M14 8 L22 16';
  return (
    <svg
      aria-hidden="true"
      data-testid="demo-pointer-arrow"
      className="pointer-events-none fixed z-[53]"
      style={style}
      viewBox="0 0 28 36"
      fill="none"
    >
      <path
        d={arrowPath}
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
  const measure = useTargetMeasure(step.pointTo);
  if (hidden) return null;
  const isLast = index === total - 1;
  // Conv #15 vague 3 — position fixe par step (défaut 'bottom'). L'auto-
  // positionnement de Conv #14d était trop instable visuellement (le
  // bandeau sautait entre les étapes). Azur préfère une position stable :
  // 'top' uniquement sur l'étape 1 (programme), 'bottom' partout ailleurs.
  const side: BannerSide = step.bannerSide ?? 'bottom';
  const bannerPositionStyle: React.CSSProperties =
    side === 'bottom'
      ? { bottom: 'max(env(safe-area-inset-bottom), 4.25rem)' }
      : { top: 'max(env(safe-area-inset-top), 3.5rem)' };
  return (
    <>
      {measure !== null && <PointerArrow measure={measure} side={side} />}
      <div
        data-testid={`demo-tour-step-${step.id}`}
        data-banner-side={side}
        className="pointer-events-auto fixed left-3 right-3 z-[54] mx-auto max-w-md"
        style={bannerPositionStyle}
      >
        <Card
          className="relative flex flex-col gap-2 border-2 border-sang-600 shadow-glow-sang-lg ring-2 ring-sang-600/20"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-sang-400">
              Étape {index + 1} / {total}
            </span>
          </div>
          <h3 className="font-display text-base leading-snug text-white">
            {step.title}
          </h3>
          <p className="text-justify text-xs leading-relaxed text-anthracite-200 hyphens-auto">
            {step.body}
          </p>
          <div className="mt-1 flex gap-2">
            <Button
              variant="secondary"
              onClick={onPrev}
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
                Quitter la démo
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
    // Conv #15-3 — depuis l'étape 1, "Précédent" rouvre la welcome overlay
    // (alors qu'auparavant le bouton était simplement disabled). Permet de
    // revoir l'intro persona à tout moment.
    setStepIndex((i) => {
      if (i === 0) {
        setWelcomeOpen(true);
        return 0;
      }
      return i - 1;
    });
  }, []);
  // Bloc S (Conv #45) — sortie de démo UNIQUE : on restaure l'état réel ET on
  // ramène au planning. Sans la nav, quitter depuis une route comme
  // `/cycle-bilan` laissait l'utilisateur bloqué sur cette page après la sortie.
  // Utilisée par le bouton « Quitter » (top-right) ET le dernier step du tour.
  const exitToProgramme = useCallback(() => {
    exitDemoMode();
    navigate('/programme');
  }, [navigate]);

  const total = TOUR_STEPS.length;

  if (!active) return null;

  return (
    <>
      {welcomeOpen && <WelcomeOverlay onStart={closeWelcome} />}
      <ExitDemoButton onExit={exitToProgramme} />
      {!welcomeOpen && currentStep !== null && (
        <GuidedTourBanner
          step={currentStep}
          index={stepIndex}
          total={total}
          onNext={next}
          onPrev={prev}
          onFinish={exitToProgramme}
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
