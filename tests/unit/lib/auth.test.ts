/**
 * Chantier F-1 — interception du refus d'allowlist (`lib/auth.ts`).
 * Chantier F-2 — décision de réconciliation et restauration.
 *
 * Le trigger `check_email_allowed` lève `EMAIL_NOT_ALLOWED` sur `auth.users`,
 * mais l'utilisateur, lui, revient sur une URL portant une erreur OAuth
 * générique et illisible. Comme c'est le SEUL trigger posé sur cette table,
 * une erreur serveur à l'inscription ne peut vouloir dire que ça.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  decideReconciliation,
  interpretOAuthError,
  NOT_ALLOWED_MESSAGE,
  restoreFromCloud,
} from '@/lib/auth';
import { useAuthStore } from '@/store/auth';

describe('interpretOAuthError', () => {
  it('reconnaît le message brut du trigger', () => {
    expect(
      interpretOAuthError({
        error: 'server_error',
        code: '',
        description: 'EMAIL_NOT_ALLOWED',
      }),
    ).toBe(NOT_ALLOWED_MESSAGE);
  });

  it('reconnaît la forme masquée par Supabase Auth', () => {
    expect(
      interpretOAuthError({
        error: 'server_error',
        code: 'unexpected_failure',
        description: 'Database error saving new user',
      }),
    ).toBe(NOT_ALLOWED_MESSAGE);
  });

  it('traite un refus côté Google comme une simple annulation', () => {
    expect(
      interpretOAuthError({
        error: 'access_denied',
        code: '',
        description: 'The user denied the request',
      }),
    ).toBe('Connexion annulée.');
  });

  it('retombe sur un message générique pour le reste', () => {
    const message = interpretOAuthError({
      error: 'invalid_request',
      code: '',
      description: 'bad redirect uri',
    });
    expect(message).not.toBe(NOT_ALLOWED_MESSAGE);
    expect(message).toContain('connexion');
  });
});

describe('decideReconciliation', () => {
  const base = { previousUserId: null, userId: 'u-1' };

  it('cas A — appareil avec données, cloud vide : envoi immédiat', () => {
    expect(
      decideReconciliation({ ...base, localHasData: true, cloudHasSnapshot: false }),
    ).toBe('push');
  });

  it('cas B — appareil vierge, cloud plein : on demande', () => {
    expect(
      decideReconciliation({ ...base, localHasData: false, cloudHasSnapshot: true }),
    ).toBe('ask');
  });

  it('cas C — les deux ont des données : on demande', () => {
    expect(
      decideReconciliation({ ...base, localHasData: true, cloudHasSnapshot: true }),
    ).toBe('ask');
  });

  it('appareil vierge sur cloud vide : surtout ne rien envoyer', () => {
    expect(
      decideReconciliation({ ...base, localHasData: false, cloudHasSnapshot: false }),
    ).toBe('nothing');
  });

  it('cas D — un autre compte se connecte sur un appareil déjà rempli : on demande', () => {
    expect(
      decideReconciliation({
        localHasData: true,
        cloudHasSnapshot: false,
        previousUserId: 'u-azur',
        userId: 'u-ami',
      }),
    ).toBe('ask');
  });

  it('même compte revenu après un effacement du marqueur : rien à demander', () => {
    expect(
      decideReconciliation({
        localHasData: true,
        cloudHasSnapshot: false,
        previousUserId: 'u-1',
        userId: 'u-1',
      }),
    ).toBe('push');
  });

  it('appareil vidé puis relié à un autre compte : rien à sauver, rien à demander', () => {
    expect(
      decideReconciliation({
        localHasData: false,
        cloudHasSnapshot: false,
        previousUserId: 'u-azur',
        userId: 'u-ami',
      }),
    ).toBe('nothing');
  });
});

describe('restoreFromCloud', () => {
  afterEach(() => {
    useAuthStore.setState({ userId: null, busy: false, error: null });
  });

  it('refuse sans compte lié, sans jeter', async () => {
    useAuthStore.setState({ userId: null });
    const result = await restoreFromCloud();
    expect(result.ok).toBe(false);
  });

  it('échoue proprement quand la couche cloud est inerte, et relâche busy', async () => {
    useAuthStore.setState({ userId: 'u-1' });
    const result = await restoreFromCloud({ snapshotId: 3 });
    expect(result.ok).toBe(false);
    expect(useAuthStore.getState().busy).toBe(false);
    expect(useAuthStore.getState().error).not.toBeNull();
  });
});
