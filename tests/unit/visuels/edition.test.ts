/**
 * Édition des poses (atelier) : ce qu'il écrit se relit à l'identique, et
 * changer le mode d'un membre (angles ou cible) ne le fait pas bouger.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { transform } from 'esbuild';
import { describe, expect, it } from 'vitest';

import { brasEnAngles, brasEnCible, decrirePose, egal, fichierPose, fichierRegistre, jambeEnAngles, jambeEnCible } from '@/visuels/edition';
import type { Cote } from '@/visuels/edition';
import { V } from '@/visuels/maths';
import { POSES } from '@/visuels/poses';
import { REPOS } from '@/visuels/poses/repos';
import type { PoseExercice } from '@/visuels/scene';
import * as squelette from '@/visuels/squelette';
import { pose, resoudre } from '@/visuels/squelette';
import type { Pose } from '@/visuels/squelette';

const POSES_CLES: readonly Pose[] = [REPOS, ...Object.values(POSES).flatMap((p) => p.cles)];
const ecart = (a: Pose, b: Pose, nom: string): number => V.len(V.sub(resoudre(a)[nom]!.o, resoudre(b)[nom]!.o));

/** Exécute un fichier de pose écrit par l'atelier, comme le ferait le bundler. */
async function relire(source: string): Promise<PoseExercice> {
  const { code } = await transform(source, { loader: 'ts', format: 'cjs' });
  const module = { exports: {} as Record<string, unknown> };
  const exiger = (chemin: string): unknown => {
    if (chemin === '../squelette') return squelette;
    throw new Error(`import inattendu : ${chemin}`);
  };
  new Function('require', 'module', 'exports', code)(exiger, module, module.exports);
  return Object.values(module.exports)[0] as PoseExercice;
}

describe('visuels — édition : description d\'une pose', () => {
  it('décrire puis reconstruire une pose redonne la même pose', () => {
    for (const k of POSES_CLES) expect(egal(pose(decrirePose(k)), k)).toBe(true);
  });

  it('la pose neutre se décrit par rien', () => {
    expect(decrirePose(pose({}))).toEqual({});
  });

  it('deux bras en miroir se décrivent une fois ; deux bras différents, chacun', () => {
    expect(Object.keys(decrirePose(pose({ bras: { coude: 40 } })))).toEqual(['bras']);
    const asym = pose({ brasG: { coude: 40 }, brasD: { coude: 10 } });
    expect(Object.keys(decrirePose(asym)).sort()).toEqual(['brasD', 'brasG']);
    expect(egal(pose(decrirePose(asym)), asym)).toBe(true);
  });
});

describe('visuels — édition : fichiers écrits', () => {
  it('chaque pose du registre, écrite puis relue, est identique', async () => {
    for (const p of Object.values(POSES)) {
      const relue = await relire(fichierPose(p, 'Essai'));
      expect(egal(relue, p), p.id).toBe(true);
    }
  });

  it('le fichier écrit est lisible : pas de ligne trop longue, une pose clé par appel', () => {
    const texte = fichierPose(POSES.squat_bb_high!, 'Squat');
    for (const ligne of texte.split('\n')) expect(ligne.length, ligne).toBeLessThanOrEqual(110);
    expect(texte.match(/pose\(/g)).toHaveLength(2);
  });

  it('le registre du dépôt est celui que l\'atelier écrirait', () => {
    const fichier = readFileSync(path.resolve(__dirname, '../../../src/visuels/poses/index.ts'), 'utf8');
    expect(fichier.replace(/\r\n/g, '\n')).toBe(fichierRegistre(Object.keys(POSES)));
  });
});

describe('visuels — édition : angles ou cible', () => {
  const coudesPlies = pose({ bras: { epaule: { flex: 35, abd: 20, rot: 15 }, coude: 70, pronation: 30 }, jambe: { hanche: { flex: 40, abd: 10, rot: 5 }, genou: 60, cheville: 10 } });

  it('un bras passé en cible ne bouge pas', () => {
    for (const k of [coudesPlies, ...POSES_CLES]) {
      for (const c of ['G', 'D'] as Cote[]) {
        const apres = { ...k, ['bras' + c]: brasEnCible(k, c, 'thorax') } as Pose;
        expect(ecart(k, apres, 'poignet' + c)).toBeLessThan(0.01);
        expect(ecart(k, apres, 'coude' + c)).toBeLessThan(0.01);
      }
    }
  });

  it('un bras passé en angles ne bouge pas, tant que ses angles restent dans les limites', () => {
    // Au squat, la prise de la barre demande une rotation d'épaule au-delà de la
    // limite (90°) : en angles, elle y est ramenée, et le bras bouge.
    const dansLesLimites = [coudesPlies, REPOS, ...POSES.db_lateral_raise!.cles];
    for (const k of dansLesLimites) {
      for (const c of ['G', 'D'] as Cote[]) {
        const apres = { ...k, ['bras' + c]: brasEnAngles(k, c) } as Pose;
        expect(ecart(k, apres, 'poignet' + c)).toBeLessThan(0.01);
        expect(ecart(k, apres, 'coude' + c)).toBeLessThan(0.01);
      }
    }
  });

  it('les angles d\'un bras survivent à un aller-retour par la cible', () => {
    const c: Cote = 'G', allee = { ...coudesPlies, brasG: brasEnCible(coudesPlies, c, 'thorax') };
    const retour = brasEnAngles(allee, c);
    expect(retour.coude).toBeCloseTo(70, 3);
    expect(retour.epaule.flex).toBeCloseTo(35, 3);
    expect(retour.epaule.abd).toBeCloseTo(20, 3);
  });

  it('une jambe passée en cible ou en angles ne bouge pas', () => {
    for (const k of [coudesPlies, ...POSES_CLES]) {
      for (const c of ['G', 'D'] as Cote[]) {
        for (const jambe of [jambeEnCible(k, c), jambeEnAngles(k, c)]) {
          const apres = { ...k, ['jambe' + c]: jambe } as Pose;
          expect(ecart(k, apres, 'cheville' + c)).toBeLessThan(0.05);
          expect(ecart(k, apres, 'genou' + c)).toBeLessThan(0.05);
        }
      }
    }
  });
});
