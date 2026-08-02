/**
 * Chantier F-1 — test de non-régression RLS (doc 12 §1.1).
 *
 * La clé publiable est dans le bundle JS, lisible par tous : **RLS est le seul
 * modèle de sécurité**. Oublier `enable row level security` une seule fois rend
 * une table entièrement lisible par quiconque possède cette clé. Ce script le
 * vérifie depuis l'extérieur, avec exactement les moyens d'un attaquant : la
 * clé publique, et rien d'autre.
 *
 * Trois assertions :
 *   1. `snapshots` — lecture anonyme : 0 ligne (policy réservée à `authenticated`).
 *   2. `allowed_emails` — lecture anonyme : 0 ligne (aucune policy du tout).
 *   3. `snapshots` — écriture anonyme : refusée.
 *
 * Une lecture qui renverrait des lignes signifierait RLS désactivée = fuite de
 * toutes les données de tous les utilisateurs.
 *
 * Usage : `npm run check:rls` (lit `.env.local`, ou les variables d'env).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(path.join(root, '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    /* pas de .env.local : on se rabat sur l'environnement */
  }
  return out;
}

const fileEnv = loadEnvLocal();
const url = process.env.VITE_SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL ?? '';
const key =
  process.env.VITE_SUPABASE_ANON_KEY ?? fileEnv.VITE_SUPABASE_ANON_KEY ?? '';

if (url === '' || key === '') {
  console.error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants (.env.local ou environnement).',
  );
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
let failures = 0;

function report(ok: boolean, label: string, detail: string): void {
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${label} — ${detail}`);
  if (!ok) failures += 1;
}

async function checkAnonRead(table: string): Promise<void> {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, {
    headers,
  });
  const body = await res.text();
  if (res.status === 200) {
    let rows: unknown = null;
    try {
      rows = JSON.parse(body);
    } catch {
      /* réponse inattendue */
    }
    const count = Array.isArray(rows) ? rows.length : -1;
    report(
      count === 0,
      `lecture anonyme de \`${table}\``,
      count === 0
        ? '0 ligne renvoyée (RLS active)'
        : `${count} ligne(s) renvoyée(s) — RLS DÉSACTIVÉE OU POLICY TROP LARGE`,
    );
    return;
  }
  // 401/403/404 conviennent aussi : rien n'est exposé.
  report(
    res.status === 401 || res.status === 403 || res.status === 404,
    `lecture anonyme de \`${table}\``,
    `HTTP ${res.status} — accès refusé`,
  );
}

async function checkAnonWrite(): Promise<void> {
  const res = await fetch(`${url}/rest/v1/snapshots`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: '00000000-0000-0000-0000-000000000000',
      payload: { probe: true },
      app_version: 'check-rls',
    }),
  });
  report(
    res.status !== 201 && res.status !== 200,
    'écriture anonyme dans `snapshots`',
    `HTTP ${res.status} — refusée`,
  );
}

await checkAnonRead('snapshots');
await checkAnonRead('allowed_emails');
await checkAnonWrite();

if (failures > 0) {
  console.error(`\n${failures} vérification(s) RLS en échec.`);
  process.exit(1);
}
console.log('\nRLS conforme.');
