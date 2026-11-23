/**
 * Anime un exercice dans une toile : boucle d'images, rotation au doigt,
 * respect du réglage « moins d'animations ». Utilisé par la fiche d'exercice
 * (`ExerciseAnimation`) et par l'atelier.
 */

import { cadrer, camera } from './camera';
import type { Cadre } from './camera';
import { construireCorps } from './corps';
import type { Corps } from './corps';
import { Maillage } from './maillage';
import { REPOS } from './poses/repos';
import { creerRendu } from './rendu';
import type { Rendu } from './rendu';
import { avancement, construireScene, mesurerSujet, periodeDe } from './scene';
import type { PoseExercice } from './scene';
import { STYLE } from './style';

// Deux corps au plus (mains ouvertes, mains fermées), construits à la demande.
const corpsPrets = new Map<boolean, Corps>();
export function corpsPour(mainFermee: boolean): Corps {
  let c = corpsPrets.get(mainFermee);
  if (c === undefined) {
    c = construireCorps(1, mainFermee, REPOS);
    corpsPrets.set(mainFermee, c);
  }
  return c;
}

export interface Vue {
  /** Angle autour du mannequin, en degrés (0 = de face). */
  readonly tour: number;
  readonly hauteur: number;
  /** Avancement du mouvement : 0 = départ, 1 = arrivée. */
  readonly t: number;
}

/** Dessine une image d'un sujet. `mesh` est un maillage de travail, réutilisé d'une image à l'autre. */
export function dessinerImage(
  rendu: Rendu,
  mesh: Maillage,
  corps: Corps,
  cadre: Cadre,
  sujet: PoseExercice,
  coefficients: Readonly<Record<string, number>>,
  vue: Vue,
): void {
  const finSol = construireScene(mesh, corps, sujet, vue.t, coefficients);
  const cam = camera(vue.tour, vue.hauteur);
  const { centre, demi } = cadrer(cadre, cam, vue.hauteur);
  rendu.dessiner(mesh, finSol, cam, {
    centre, demi,
    fond: STYLE.fond, trait: STYLE.fond,
    relief: STYLE.relief, bord: STYLE.bord,
    epaisseurTrait: STYLE.trait * 2 * demi,
  });
}

/** Ramène un angle entre −180° et 180°. */
export const angleNormal = (a: number): number => ((((a + 180) % 360) + 360) % 360) - 180;

export interface Animation {
  arreter(): void;
}

/**
 * Lance l'animation d'un exercice dans une toile. Rend `null` si WebGL n'est
 * pas disponible (l'appelant se replie sur la photo).
 *
 * - Le mouvement tourne en boucle ; si le téléphone demande moins
 *   d'animations, on montre une image fixe, à l'arrivée du mouvement.
 * - Glisser le doigt de gauche à droite fait tourner la caméra autour du
 *   mannequin (un seul degré de liberté ; la hauteur du regard ne change pas).
 */
export function animer(
  toile: HTMLCanvasElement,
  sujet: PoseExercice,
  coefficients: Readonly<Record<string, number>>,
): Animation | null {
  const rendu = creerRendu(toile);
  if (rendu === null) return null;
  const corps = corpsPour(sujet.mainFermee), cadre = mesurerSujet(corps, sujet), mesh = new Maillage();
  const fixe = sujet.cles.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tour = sujet.camera.tour, phase = 0, avant = performance.now(), aRedessiner = true, demande = 0, arrete = false;

  const image = (maintenant: number): void => {
    if (arrete) return;
    if (!fixe) phase = (phase + (maintenant - avant) / periodeDe(sujet)) % 1;
    avant = maintenant;
    if (!fixe || aRedessiner) {
      dessinerImage(rendu, mesh, corps, cadre, sujet, coefficients, { tour, hauteur: sujet.camera.hauteur, t: fixe ? 1 : avancement(phase, sujet.effort) });
      aRedessiner = false;
    }
    demande = requestAnimationFrame(image);
  };
  demande = requestAnimationFrame(image);

  let prise: { x: number; tour: number } | null = null;
  const debut = (e: PointerEvent): void => {
    prise = { x: e.clientX, tour };
    toile.setPointerCapture(e.pointerId);
  };
  const glisse = (e: PointerEvent): void => {
    if (prise === null) return;
    tour = angleNormal(prise.tour - (e.clientX - prise.x) * 0.9);
    aRedessiner = true;
  };
  const fin = (): void => {
    prise = null;
  };
  toile.addEventListener('pointerdown', debut);
  toile.addEventListener('pointermove', glisse);
  toile.addEventListener('pointerup', fin);
  toile.addEventListener('pointercancel', fin);

  return {
    arreter() {
      arrete = true;
      cancelAnimationFrame(demande);
      toile.removeEventListener('pointerdown', debut);
      toile.removeEventListener('pointermove', glisse);
      toile.removeEventListener('pointerup', fin);
      toile.removeEventListener('pointercancel', fin);
      rendu.liberer();
    },
  };
}
