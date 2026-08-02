/**
 * Chantier F-1 — interception du refus d'allowlist (`lib/auth.ts`).
 *
 * Le trigger `check_email_allowed` lève `EMAIL_NOT_ALLOWED` sur `auth.users`,
 * mais l'utilisateur, lui, revient sur une URL portant une erreur OAuth
 * générique et illisible. Comme c'est le SEUL trigger posé sur cette table,
 * une erreur serveur à l'inscription ne peut vouloir dire que ça.
 */

import { describe, expect, it } from 'vitest';
import { interpretOAuthError, NOT_ALLOWED_MESSAGE } from '@/lib/auth';

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
