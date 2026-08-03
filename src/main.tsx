import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { captureOAuthReturn } from '@/lib/oauth-return';
import { router } from './router';
import './index.css';

// Chantier F — AVANT le rendu, sans exception. L'URL de retour de Google est
// la racine de l'app, qui redirige aussitôt, et une redirection de React
// Router jette la query string : le code d'autorisation (ou le refus
// d'allowlist) doit être mis à l'abri avant que quoi que ce soit ne navigue.
captureOAuthReturn();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root introuvable');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
