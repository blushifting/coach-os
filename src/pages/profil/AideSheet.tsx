/**
 * Sheet d'aide (Conv #6c).
 *
 * Sections :
 *  1. Prise en main : relance de la démo Alex + mini-guides (première séance,
 *     après-séance, cycle 4+1).
 *  2. Glossaire : entrées de `HELP_GLOSSARY` listées dans `GLOSSARY_ORDER`.
 *  3. Questions fréquentes : comportements contre-intuitifs du modèle.
 *  4. Sources scientifiques : références du moteur de prescription.
 */

import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { HELP_GLOSSARY, type HelpTopic } from '@/lib/help-glossary';
import { enterDemoMode } from '@/lib/demo';
import { resetDemoDismissals } from '@/components/DemoMode';

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
    id: 'first-session',
    title: 'Première séance',
    body:
      "Pas de séance de test : à ta première séance, Kotsh pré-remplit des " +
      "charges raisonnables selon ton poids — tu ajustes si besoin. Il apprend " +
      "ton Plafond directement sur tes premières séries, sans phase de " +
      "calibration séparée.",
  },
  {
    id: 'feedback',
    title: 'Après chaque séance',
    body:
      "En fin de séance, Kotsh récapitule tes séries et recalcule ton Plafond. " +
      "Tes charges suivantes en découlent : une série facile (Réserve élevée) " +
      "fait monter la charge, une série où tu cales tôt la fait baisser. " +
      "Rien à régler à la main.",
  },
  {
    id: 'cycle',
    title: 'Comprendre le cycle 4+1',
    body:
      'Un cycle = 4 semaines de montée progressive + 1 semaine de récupération. ' +
      'À la fin du cycle, Kotsh te propose un bilan : muscles qui ont progressé, ' +
      "ceux qui ont plafonné, et te suggère de continuer ou d'ajuster tes " +
      'objectifs.',
  },
];

interface FaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

/**
 * Conv #21 — FAQ qui explique les comportements contre-intuitifs du modèle.
 * Chaque entrée référence implicitement une source listée dans `SOURCES`.
 * Volontairement court : ne pas re-rédiger un cours, juste lever les
 * "pourquoi l'app fait-elle ça ?" qui reviennent à l'usage.
 */
const FAQ: readonly FaqItem[] = [
  {
    id: 'prio-2-sur-3',
    question:
      "Pourquoi mon muscle prioritaire n'apparaît que 2 fois sur 3 séances ?",
    answer:
      "Schoenfeld 2019 (méta-analyse fréquence) montre que 2 séances/semaine " +
      "est optimal pour l'hypertrophie : passer à 3× même volume total ne donne " +
      "pas plus de gain et coûte plus en récupération. Kotsh divise ton volume " +
      "cible par les ~5 séries/séance optimales par muscle pour calculer la " +
      "fréquence. Pour un muscle à 10 séries/sem, ça donne 2 séances. Tu peux " +
      "dépasser en ajoutant un exercice en séance.",
  },
  {
    id: 'pec-haut-bas',
    question: 'Pourquoi pas de découpage pec haut / pec bas ?',
    answer:
      "Les études EMG 2010-2020 (Trebs, Lauver, Schick) montrent un continuum " +
      "d'angles plutôt qu'une dichotomie : le sternal du grand pectoral domine à " +
      "tous les angles, l'inclinaison modifie la contribution claviculaire mais pas " +
      "fondamentalement le muscle ciblé. Les apps de référence (Hevy, Strong, " +
      "RP Hypertrophy) traitent le pectoral comme un seul muscle. Pour cibler le haut, " +
      "filtre les variantes inclinées dans l'onglet Exercices.",
  },
  {
    id: 'deltoides',
    question: 'Pourquoi 2 deltoïdes seulement (latéral + postérieur) ?',
    answer:
      "Le deltoïde a 3 chefs : antérieur, latéral, postérieur. Kotsh ne suit que " +
      "les latéraux et postérieurs — pas les antérieurs. Raison : les antérieurs " +
      "sont saturés en continu par tout exo de pectoraux (développé couché, dips, " +
      "pompes…) et de presse verticale. En ajouter un quota séparé créerait du " +
      "sur-volume systémique. À l'inverse, les postérieurs sont sous-développés " +
      "chez quasi tous les pratiquants — Kotsh les ajoute automatiquement en " +
      "Maintien dès que tu travailles pectoraux, deltos latéraux ou triceps " +
      "(règle R4, Cools 2014 — prévention du conflit sous-acromial, la blessure " +
      "d'épaule la plus fréquente en muscu).",
  },
  {
    id: 'rpe-min-6',
    question: "Pourquoi le curseur de Réserve plafonne à « 4+ » ?",
    answer:
      "Au-delà de 4 reps en réserve, une série est trop facile pour apprendre " +
      "ton Plafond. La formule d'Epley n'est fiable que pour les séries intenses (≤ 15 reps équivalentes) ; " +
      "en deçà, Kotsh ne peut pas extrapoler ton Plafond sans erreur. " +
      "« 4+ » est donc la Réserve maximum « informative » pour la calibration — " +
      "au-delà, monte la charge.",
  },
  {
    id: 'semaine5-deload',
    question: 'Pourquoi la semaine 5 du cycle est en récupération ?',
    answer:
      "Modèle supercompensation / gestion de la fatigue (Israetel 2017, modèle " +
      "MEV/MAV/MRV). Sur 4 semaines de montée progressive en intensité, " +
      "la fatigue résiduelle s'accumule et finit par masquer les gains. Une semaine " +
      "à ~50 % du volume habituel laisse la récupération rattraper, et tu repars " +
      "frais pour le cycle suivant — souvent avec un Plafond plus haut.",
  },
  {
    id: 'plafond-baisse',
    question: "Mon Plafond a baissé après une mauvaise séance, c'est normal ?",
    answer:
      "L'algo utilise une moyenne mobile pondérée (EMA) : il intègre les nouvelles " +
      "mesures sans tout écraser, mais une vraie mauvaise journée laisse une trace " +
      "temporaire. La courbe Force, elle, trace ton Plafond séance après séance : " +
      "elle peut donc redescendre ponctuellement, mais les étoiles records qui la " +
      "jalonnent ne reculent jamais. C'est volontaire : la prescription doit coller " +
      "à ta forme du moment, ton record historique, lui, reste acquis.",
  },
];

interface SourceItem {
  readonly id: string;
  readonly cite: string;
  readonly topic: string;
}

/**
 * Conv #21 — Sources scientifiques principales. Pas un index exhaustif : on
 * liste les références centrales du modèle (RPE, volume, fréquence, e1RM,
 * récupération). Toutes citées en commentaires dans `engine/` pour qui veut
 * tracer une décision algorithmique à sa source.
 */
const SOURCES: readonly SourceItem[] = [
  {
    id: 'schoenfeld-2019',
    cite: 'Schoenfeld et al. (2019). Resistance training frequency. Sports Med.',
    topic:
      'Fréquence 2× / sem optimale pour l\'hypertrophie à volume égal.',
  },
  {
    id: 'helms-2018',
    cite:
      'Helms et al. (2018). RPE-based prescription. J. Strength Cond. Res.',
    topic: 'Auto-régulation par RPE et reps en réserve (RIR).',
  },
  {
    id: 'zourdos-2016',
    cite: 'Zourdos et al. (2016). RIR-based RPE scale. J. Strength Cond. Res.',
    topic: 'Échelle RPE 6-10 calibrée par reps en réserve.',
  },
  {
    id: 'israetel-2017',
    cite: 'Israetel, Hoffmann, Smith (2017). Scientific Principles of Hypertrophy.',
    topic: 'Volume MEV/MAV/MRV, cycles 4+1, récupération.',
  },
  {
    id: 'epley-1985',
    cite: 'Epley (1985). Poundage chart for max prediction.',
    topic: 'Formule e1RM = charge × (1 + reps/30).',
  },
  {
    id: 'lesuer-1997',
    cite: 'LeSuer et al. (1997). Accuracy of prediction equations.',
    topic: 'Validation Epley vs autres formules (squat, développé couché, soulevé de terre).',
  },
  {
    id: 'wood-2002',
    cite: 'Wood, Maddalozzo, Harter (2002). Estimating 1RM.',
    topic: 'Extension Epley aux reps > 10 et au RPE perçu.',
  },
  {
    id: 'macdougall-1995',
    cite: 'MacDougall et al. (1995). Muscle protein synthesis time course.',
    topic: 'Récupération musculaire ~48h post-effort.',
  },
  {
    id: 'damas-2016',
    cite: 'Damas et al. (2016). Resistance training-induced changes in MPS.',
    topic: 'Synthèse protéique et fréquence d\'entraînement.',
  },
  {
    id: 'trebs-2010',
    cite: 'Trebs, Brandenburg, Pitney (2010). EMG bench press at varying angles.',
    topic: 'Pectoraux : continuum d\'angles (claviculaire vs sternal).',
  },
];

const GLOSSARY_ORDER: readonly HelpTopic[] = [
  'plafond',
  'reserve',
  'echec',
  'cycle',
  'deload',
  'poly',
  'iso',
  'etire',
  'volumeHebdo',
  'volumeTotalCycle',
  'vminmax',
  'hypertrophie',
  'adherence',
  'vsSem1',
  'prDuJour',
];

export function AideSheet({ open, onClose }: AideSheetProps) {
  async function startDemo() {
    resetDemoDismissals();
    onClose();
    await enterDemoMode();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Aide & glossaire">
      <div className="max-h-[75dvh] overflow-y-auto pr-1">
        <div className="flex flex-col gap-5">
          <section data-testid="aide-tutos">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-anthracite-300">
              Prise en main
            </h4>
            <div className="flex flex-col gap-2">
              <Card data-testid="aide-tuto-demo">
                <p className="text-sm leading-relaxed text-anthracite-200">
                  Un exemple&nbsp;: une séance et un bilan déjà remplis.
                </p>
                <div className="mt-3">
                  <Button
                    variant="primary"
                    onClick={() => void startDemo()}
                    data-testid="btn-relaunch-demo"
                  >
                    Voir la démo
                  </Button>
                </div>
              </Card>
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

          <section data-testid="aide-faq">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-anthracite-300">
              Questions fréquentes
            </h4>
            <div className="flex flex-col gap-2">
              {FAQ.map((q) => (
                <details
                  key={q.id}
                  data-testid={`aide-faq-${q.id}`}
                  className="group rounded-xl border border-anthracite-700 bg-anthracite-900"
                >
                  <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-white">
                    <span className="mr-2 text-anthracite-300 group-open:hidden">▸</span>
                    <span className="mr-2 hidden text-anthracite-300 group-open:inline">
                      ▾
                    </span>
                    {q.question}
                  </summary>
                  <p className="px-3 pb-3 text-sm leading-relaxed text-anthracite-300">
                    {q.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <section data-testid="aide-sources">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-anthracite-300">
              Sources scientifiques
            </h4>
            <Card>
              <ul className="flex flex-col gap-2 text-sm">
                {SOURCES.map((s) => (
                  <li
                    key={s.id}
                    data-testid={`aide-source-${s.id}`}
                    className="border-l-2 border-anthracite-700 pl-3"
                  >
                    <div className="font-medium text-anthracite-100">
                      {s.cite}
                    </div>
                    <div className="text-xs leading-relaxed text-anthracite-400">
                      {s.topic}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </div>
      </div>
    </Sheet>
  );
}
