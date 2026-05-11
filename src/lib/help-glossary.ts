export type HelpTopic =
  | 'plafond'
  | 'rpe'
  | 'cycle'
  | 'deload'
  | 'poly'
  | 'iso'
  | 'etire'
  | 'volumeHebdo'
  | 'vminmax'
  | 'amplitude'
  | 'hypertrophie'
  | 'vsSem1'
  | 'prDuJour';

export interface HelpEntry {
  readonly title: string;
  readonly body: string;
}

export const HELP_GLOSSARY: Readonly<Record<HelpTopic, HelpEntry>> = {
  plafond: {
    title: 'Plafond',
    body: "Charge max estimée pour 1 répétition (e1RM). Calculée par la formule d'Epley étendue à partir de tes meilleures séries — pas besoin de tester un vrai 1RM, c'est plus sûr et tout aussi précis.",
  },
  rpe: {
    title: 'RPE',
    body: "Rate of Perceived Exertion. Échelle 6 à 10 d'effort perçu en fin de série. RPE 8 = il te restait 2 reps en réserve. RPE 10 = échec total.",
  },
  cycle: {
    title: 'Cycle',
    body: "Bloc de 4 semaines de progression + 1 semaine allégée (déload). Au bout de chaque cycle, l'app te propose un bilan.",
  },
  deload: {
    title: 'Déload',
    body: 'Semaine à volume divisé par 2 et RPE plafonné à 6. Sert à faire redescendre la fatigue accumulée sans perdre les gains.',
  },
  poly: {
    title: 'Polyarticulaire',
    body: 'Mobilise plusieurs articulations à la fois. Squat, bench press, rowing, etc. Ce sont les exos rendement-massif pour la force.',
  },
  iso: {
    title: 'Isolation',
    body: 'Mobilise une seule articulation. Curl biceps, leg extension, élévation latérale. Pour cibler un muscle précis, utile en hypertrophie.',
  },
  etire: {
    title: 'Étiré (lengthened bias)',
    body: 'Variante où le muscle est travaillé en position allongée — meilleure stimulation hypertrophique. Ex : curl incliné pour le biceps, triceps overhead.',
  },
  volumeHebdo: {
    title: 'Volume hebdo',
    body: 'Nombre de séries par muscle par semaine. La variable la plus puissante pour grossir : Schoenfeld 2017 trouve un seuil critique vers 10 séries/sem/muscle.',
  },
  vminmax: {
    title: 'V_min / V_max',
    body: 'Bornes du volume hebdo apprises par feedback. V_min = volume minimal pour progresser. V_max = avant que la fatigue ne mange les gains. Réajustés à chaque cycle.',
  },
  amplitude: {
    title: 'Amplitude complète',
    body: "Mouvement parcouru sur toute son étendue. Plus efficace pour l'hypertrophie qu'un travail partiel, sauf cas spécifiques (étiré profond).",
  },
  hypertrophie: {
    title: 'Hypertrophie',
    body: 'Augmenter la taille du muscle. Reps 6-15, RPE 7-9, volume élevé. À ne pas confondre avec le « volume hebdo » qui est juste le nombre de séries/sem.',
  },
  vsSem1: {
    title: 'vs sem1',
    body: "Comparaison de la charge actuelle avec celle de la semaine 1 du cycle en cours. Mesure la progression nette intra-cycle, avant déload.",
  },
  prDuJour: {
    title: 'PR du jour',
    body: "Record personnel de la séance : meilleure performance (charge × reps × RPE) atteinte aujourd'hui sur un exercice, comparée à toutes les séances précédentes.",
  },
};
