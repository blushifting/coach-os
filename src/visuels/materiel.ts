/**
 * Matériel : chaque pièce (barre, haltère, câble…) est décrite en volumes
 * simples, dans le repère de la partie du corps qui la porte. Dessiné comme le
 * corps, en teintes neutres.
 *
 * Pour ajouter une pièce (étape V-4 du chantier) : un nouveau `type` dans
 * `Piece`, et sa description en cylindres et pavés dans `volumesMateriel`.
 * Aucun autre fichier du moteur n'est à toucher.
 */

import { M, V } from './maths';
import type { Vec3 } from './maths';
import type { Reperes } from './squelette';

export type TonMateriel = 'metal' | 'fonte' | 'moyeu';

/** Un point dans le repère d'une partie du corps (ou de `monde`) : [repère, [x, y, z]]. */
type Ancrage = readonly [repere: string, point: Vec3];

/** Une pièce de matériel. */
export type Piece =
  /** Barre chargée, le long de l'axe gauche-droite du repère ; `centre` = son milieu. */
  | { readonly type: 'barre'; readonly repere: string; readonly centre: Vec3 }
  /** Haltère tenu dans une main (repère `poignetG` ou `poignetD`), poignée d'avant en arrière. */
  | { readonly type: 'haltere'; readonly repere: string; readonly centre: Vec3 }
  /** Câble tendu entre deux points qui peuvent bouger l'un par rapport à l'autre (poulie → poignée). */
  | { readonly type: 'cable'; readonly de: Ancrage; readonly a: Ancrage };

export type Volume =
  | { readonly forme: 'cylindre'; readonly p0: Vec3; readonly p1: Vec3; readonly r: number; readonly ton: TonMateriel }
  | { readonly forme: 'pave'; readonly centre: Vec3; readonly dx: Vec3; readonly dy: Vec3; readonly dz: Vec3; readonly ton: TonMateriel };

/** Les volumes du matériel d'un exercice, placés dans l'espace pour cette pose. */
export function volumesMateriel(materiel: readonly Piece[], F: Reperes): Volume[] {
  const out: Volume[] = [];
  const dans = (repere: string): ((v: Vec3) => Vec3) => {
    const rep = F[repere];
    if (rep === undefined) throw new Error(`Repère inconnu pour le matériel : ${repere}`);
    return (v) => V.add(rep.o, M.vec(rep.R, v));
  };
  for (const m of materiel) {
    if (m.type === 'cable') {
      out.push({ forme: 'cylindre', p0: dans(m.de[0])(m.de[1]), p1: dans(m.a[0])(m.a[1]), r: 0.4, ton: 'metal' });
      continue;
    }
    const P = dans(m.repere);
    const cylindre = (a: Vec3, b: Vec3, r: number, ton: TonMateriel): void => {
      out.push({ forme: 'cylindre', p0: P(a), p1: P(b), r, ton });
    };
    const [cx, cy, cz] = m.centre;
    switch (m.type) {
      case 'barre':
        // Raccourcie par rapport à une vraie barre (2,20 m), pour que le
        // mannequin reste grand dans la case.
        cylindre([cx - 58, cy, cz], [cx + 58, cy, cz], 1.4, 'metal');
        for (const s of [1, -1]) {
          cylindre([cx + s * 60, cy, cz], [cx + s * 64.5, cy, cz], 22, 'fonte');
          cylindre([cx + s * 59.4, cy, cz], [cx + s * 65.1, cy, cz], 6, 'moyeu');
          cylindre([cx + s * 64.5, cy, cz], [cx + s * 68, cy, cz], 16, 'fonte');
          cylindre([cx + s * 58, cy, cz], [cx + s * 80, cy, cz], 2.3, 'metal');
        }
        break;
      case 'haltere':
        cylindre([cx, cy, cz - 5.5], [cx, cy, cz + 5.5], 1.2, 'metal');
        cylindre([cx, cy, cz + 5.5], [cx, cy, cz + 10], 5.2, 'fonte');
        cylindre([cx, cy, cz - 10], [cx, cy, cz - 5.5], 5.2, 'fonte');
        break;
    }
  }
  return out;
}

/** Points extrêmes d'un volume, avec leur rayon : sert au cadrage. */
export function etendue(v: Volume): { p: Vec3; r: number }[] {
  if (v.forme === 'cylindre') return [{ p: v.p0, r: v.r }, { p: v.p1, r: v.r }];
  return [{ p: v.centre, r: V.len(v.dx) + V.len(v.dy) + V.len(v.dz) }];
}
