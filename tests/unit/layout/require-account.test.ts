/**
 * Chantier F — garde d'accès (`layout/RequireAccount.tsx`).
 *
 * C'est le bout de logique le plus dangereux de l'app : trop laxiste, il ouvre
 * l'app à n'importe qui ; trop strict, il enferme quelqu'un dehors avec ses
 * propres données sur son propre téléphone. D'où ces tests.
 */

import { describe, expect, it } from 'vitest';
import { decideAccess } from '@/layout/RequireAccount';

const base = {
  cloudConfigured: true,
  ready: true,
  signedIn: false,
  deviceLinked: false,
};

describe('decideAccess', () => {
  it("sans couche cloud, la garde est inerte (dev, Vitest, e2e)", () => {
    expect(
      decideAccess({ ...base, cloudConfigured: false, ready: false }),
    ).toBe('allow');
  });

  it("attend la résolution de la session avant de conclure quoi que ce soit", () => {
    expect(decideAccess({ ...base, ready: false })).toBe('wait');
    // Même connecté : tant que ce n'est pas résolu, on ne sait rien.
    expect(decideAccess({ ...base, ready: false, signedIn: true })).toBe('wait');
  });

  it('session ouverte : on passe', () => {
    expect(decideAccess({ ...base, signedIn: true })).toBe('allow');
  });

  it("sans session et sans compte jamais lié : écran de connexion", () => {
    expect(decideAccess(base)).toBe('signin');
  });

  it("appareil déjà lié à un compte : on passe malgré la session perdue", () => {
    // Jeton expiré en pleine séance sans réseau. La déconnexion et la
    // suppression de compte effacent ce marqueur, donc un appareil rendu ou
    // prêté retombe bien sur le cas précédent.
    expect(decideAccess({ ...base, deviceLinked: true })).toBe('allow');
  });
});
