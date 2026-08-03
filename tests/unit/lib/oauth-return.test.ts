/**
 * Chantier F — lecture du retour OAuth (`lib/oauth-return.ts`).
 *
 * Ce que ces tests protègent : l'URL de retour de Google est la racine de
 * l'app, qui redirige aussitôt, et une redirection de React Router jette la
 * query string. Le retour doit donc être lu et mis à l'abri avant le premier
 * rendu — sinon la connexion réussit côté Google sans jamais ouvrir de session
 * dans l'app, et un refus d'allowlist ne s'affiche nulle part.
 */

import { describe, expect, it } from 'vitest';
import { readOAuthReturn } from '@/lib/oauth-return';

describe('readOAuthReturn', () => {
  it("lit le code d'autorisation dans la query", () => {
    expect(readOAuthReturn('?code=abc123', '')).toEqual({
      code: 'abc123',
      error: null,
    });
  });

  it("lit le refus d'allowlist tel que Supabase le renvoie", () => {
    expect(
      readOAuthReturn(
        '?error=server_error&error_code=unexpected_failure&error_description=Database%20error%20saving%20new%20user',
        '',
      ),
    ).toEqual({
      code: null,
      error: {
        error: 'server_error',
        code: 'unexpected_failure',
        description: 'Database error saving new user',
      },
    });
  });

  it('lit aussi une erreur déposée dans le fragment', () => {
    const found = readOAuthReturn('', '#error=access_denied&error_description=denied');
    expect(found.error?.error).toBe('access_denied');
    expect(found.code).toBeNull();
  });

  it('ignore une URL ordinaire', () => {
    expect(readOAuthReturn('', '')).toEqual({ code: null, error: null });
    expect(readOAuthReturn('?cycle=2', '')).toEqual({ code: null, error: null });
  });

  it("l'erreur prime sur le code : on n'échange jamais après un refus", () => {
    const found = readOAuthReturn('?code=abc&error=access_denied', '');
    expect(found.code).toBeNull();
    expect(found.error?.error).toBe('access_denied');
  });
});
