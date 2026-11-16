/**
 * Couleurs et réglages du rendu, arrêtés à l'étape V-1 du chantier (document
 * `recherche/15_visuels_exercices.md`). Azur a laissé Claude trancher, avec
 * deux consignes : que les muscles travaillés se voient bien, et qu'on puisse
 * s'écarter un peu de la palette de l'app si la lisibilité y gagne.
 *
 * Le corps reste dans les gris anthracite de l'app, un peu éclaircis pour se
 * détacher du fond ; les muscles travaillés restent dans la famille « sang »
 * (rouge = volume), le principal plus vif que dans la silhouette du catalogue.
 */

import type { Couleur } from './maillage';

const hex = (h: string): Couleur => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export const STYLE = {
  /** Fond de la case : celui des cartes de l'app (anthracite-900). */
  fond: hex('#14161a'),
  /** Disque de sol, à peine plus clair que le fond. */
  sol: hex('#1e2126'),
  /** Le corps, là où aucun muscle ne passe (tête, mains, pieds, articulations). */
  corps: hex('#4b5059'),
  cheveux: hex('#2b2f35'),
  /** Muscle au repos : un cran plus clair que le corps, pour se lire en relief. */
  muscle: hex('#5a606a'),
  /** Muscle travaillé, coefficient 1 dans le catalogue. */
  principal: hex('#c62f41'),
  /** Muscle travaillé, coefficient 0,5 : le même rouge, à mi-chemin du gris. */
  secondaire: hex('#8c4350'),
  metal: hex('#8a909b'),
  fonte: hex('#2b2f35'),
  moyeu: hex('#3d424a'),
  /** Cadres des bancs, poulies et machines : en retrait du corps, sans se fondre dans le fond. */
  cadre: hex('#363b43'),
  /** Coussins (sellerie noire). */
  coussin: hex('#24272c'),
  /** Force de l'éclairage : 0 = à plat, 1 = très contrasté. */
  relief: 0.7,
  /** Assombrissement des surfaces qui fuient le regard : creuse le sillon entre deux muscles. */
  bord: 0.4,
  /** Épaisseur du trait autour des pièces, en fraction du côté de l'image. */
  trait: 0.0018,
  /** Durée d'un aller-retour du mouvement, en millisecondes. */
  periode: 2800,
} as const;

/** Couleur d'un muscle d'après son coefficient dans le catalogue (1, 0,5, ou absent). */
export function tonMuscle(coefficient: number | undefined): Couleur {
  if (coefficient === undefined || coefficient <= 0) return STYLE.muscle;
  return coefficient >= 1 ? STYLE.principal : STYLE.secondaire;
}
