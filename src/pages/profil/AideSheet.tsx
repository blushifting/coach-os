/**
 * Sheet d'aide (Conv #6c).
 *
 * Trois sections :
 *  1. Tutos de prise en main : 4 mini-guides texte (onboarding revisité, 1re séance,
 *     fonctionnement du cycle, gestion des plafonds).
 *  2. Glossaire complet : 13 entrées de `HELP_GLOSSARY` (cf. `lib/help-glossary.ts`).
 *  3. À propos : version + lien recherche.
 */

import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { HELP_GLOSSARY, type HelpTopic } from '@/lib/help-glossary';

interface AideSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

interface Tutorial {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

const TUTORIALS: readonly Tutorial[] = [
  {
    id: 'onboarding',
    title: 'Configurer son profil',
    body:
      "Au premier lancement, l'app te demande ton sexe, âge, poids, niveau, " +
      "fréquence d'entraînement et l'équipement dispo. Tu choisis ensuite tes muscles " +
      'prioritaires (5 conseillés) et leur objectif (force, hypertrophie, endurance ou ' +
      "maintien). L'app suggère automatiquement des muscles d'équilibre (push/pull, " +
      'gainage, antagonistes) pour limiter les déséquilibres. Tu termines en choisissant ' +
      'un programme guidé ou en mode custom.',
  },
  {
    id: 'first-session',
    title: 'Première séance (calibration)',
    body:
      "La séance 0 te demande de tester 1 ou 2 séries proches de l'échec sur chaque " +
      "exercice clé. Tu rentres le poids, le nombre de reps et ton effort perçu (sur 10 — " +
      "c'est ce qu'on appelle aussi RPE dans le jargon muscu). L'app en déduit ton plafond " +
      "(charge max pour 1 rep) pour chaque exo via la formule d'Epley étendue, et calibre " +
      "tes charges de travail pour le reste du cycle.",
  },
  {
    id: 'feedback',
    title: 'Donner du feedback à la fin de chaque séance',
    body:
      "Pour chaque série, tu indiques combien de reps tu as faites et ton effort perçu " +
      "(sur 10). L'app ajuste automatiquement le plafond, repère les plateaux, et adapte les " +
      "charges de la séance suivante. Pas besoin de tenir un journal séparé.",
  },
  {
    id: 'cycle',
    title: 'Comprendre le cycle 4+1',
    body:
      'Un cycle = 4 semaines de montée progressive + 1 semaine allégée (déload). ' +
      "À la fin du cycle, l'app te propose un bilan : muscles qui ont progressé, " +
      "ceux qui ont plafonné, et te suggère soit de continuer, ajuster les objectifs, " +
      'tourner les emphases, ou changer de programme.',
  },
];

const GLOSSARY_ORDER: readonly HelpTopic[] = [
  'plafond',
  'rpe',
  'cycle',
  'deload',
  'poly',
  'iso',
  'etire',
  'volumeHebdo',
  'vminmax',
  'amplitude',
  'hypertrophie',
  'vsSem1',
  'prDuJour',
];

export function AideSheet({ open, onClose }: AideSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Aide & glossaire">
      <div className="max-h-[75dvh] overflow-y-auto pr-1">
        <div className="flex flex-col gap-5">
          <section data-testid="aide-tutos">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-anthracite-300">
              Prise en main
            </h4>
            <div className="flex flex-col gap-2">
              {TUTORIALS.map((t) => (
                <details
                  key={t.id}
                  data-testid={`aide-tuto-${t.id}`}
                  className="group rounded-xl border border-anthracite-700 bg-anthracite-900"
                >
                  <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-white">
                    <span className="mr-2 text-anthracite-300 group-open:hidden">▸</span>
                    <span className="mr-2 hidden text-anthracite-300 group-open:inline">
                      ▾
                    </span>
                    {t.title}
                  </summary>
                  <p className="px-3 pb-3 text-sm leading-relaxed text-anthracite-300">
                    {t.body}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <section data-testid="aide-glossaire">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-anthracite-300">
              Glossaire
            </h4>
            <div className="flex flex-col gap-2">
              {GLOSSARY_ORDER.map((topic) => {
                const entry = HELP_GLOSSARY[topic];
                return (
                  <Card key={topic} padded={false}>
                    <div
                      data-testid={`aide-glossaire-${topic}`}
                      className="px-3 py-2.5"
                    >
                      <div className="text-sm font-medium text-white">
                        {entry.title}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-anthracite-300">
                        {entry.body}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </Sheet>
  );
}
