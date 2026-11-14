/**
 * Silhouette — découpage de l'étape 6 (dump 2.4) et toucher au plus proche.
 * Coordonnées dans le repère d'une vue (0-100 × 0-196), côté droit de l'image.
 */

import { describe, expect, it } from 'vitest';

import { TAP_MARGIN, muscleAtPointOnSide } from '@/components/AnatomicalSilhouette';

describe('silhouette — zones de l\'étape 6', () => {
  it('de face, l\'avant de l\'épaule est aux antérieurs et le bord extérieur aux latéraux', () => {
    expect(muscleAtPointOnSide('face', 67, 39)).toBe('deltos_anterieurs');
    expect(muscleAtPointOnSide('face', 78, 46)).toBe('deltos_lateraux');
  });

  it('de face, la pente du cou reste aux trapèzes', () => {
    expect(muscleAtPointOnSide('face', 55, 32)).toBe('trapezes_hauts');
  });

  it('de dos, l\'épaule reste entière aux postérieurs', () => {
    expect(muscleAtPointOnSide('back', 74, 40)).toBe('deltos_posterieurs');
    expect(muscleAtPointOnSide('back', 81, 47)).toBe('deltos_posterieurs');
  });

  it('l\'intérieur de la cuisse est aux adducteurs, de face comme de dos', () => {
    expect(muscleAtPointOnSide('face', 56, 115)).toBe('adducteurs');
    expect(muscleAtPointOnSide('back', 54, 125)).toBe('adducteurs');
  });

  it('le quadriceps garde la goutte au-dessus du genou', () => {
    expect(muscleAtPointOnSide('face', 59, 140)).toBe('quadriceps');
  });
});

describe('silhouette — toucher au plus proche', () => {
  it('un toucher juste à côté d\'un muscle le choisit', () => {
    // Entre les deux cuisses, à moins d'une marge de l'adducteur droit.
    expect(muscleAtPointOnSide('face', 51.5, 124)).toBe('adducteurs');
  });

  it('un toucher sur une zone neutre ne choisit rien', () => {
    expect(muscleAtPointOnSide('face', 50, 10)).toBeNull(); // tête
  });

  it('un toucher trop loin de tout muscle ne choisit rien', () => {
    expect(muscleAtPointOnSide('face', 95, 140)).toBeNull();
    expect(TAP_MARGIN).toBeGreaterThan(0);
  });
});
