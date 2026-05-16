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
    body:
      "Charge max estimée pour 1 répétition sur un exo donné — aussi appelée 1RM ou e1RM dans le jargon muscu. " +
      "Calculée automatiquement par l'app à partir de tes meilleures séries (formule d'Epley étendue) : " +
      "pas besoin de tester un vrai 1RM à chaque fois, c'est plus sûr et tout aussi précis. " +
      "Le plafond se met à jour à chaque séance et sert à calculer tes charges de travail.",
  },
  rpe: {
    title: 'Effort',
    body:
      "Note l'intensité ressentie en fin de série, sur une échelle de 6 à 10. " +
      "Effort 8/10 = il te restait 2 reps en réserve. Effort 10/10 = échec total (impossible de faire une rep de plus). " +
      "C'est ce que les coachs appellent RPE (Rate of Perceived Exertion). " +
      "Kotsh s'en sert pour ajuster automatiquement tes charges : si l'effort est plus bas que prévu, on monte ; s'il est plus haut, on baisse.",
  },
  cycle: {
    title: 'Cycle',
    body: "Bloc de 4 semaines de progression + 1 semaine allégée (déload). Au bout de chaque cycle, l'app te propose un bilan.",
  },
  deload: {
    title: 'Déload (semaine allégée)',
    body:
      "Dernière semaine de chaque cycle : moitié moins de séries et effort plafonné à 6/10. " +
      "Sert à faire redescendre la fatigue accumulée sans perdre les gains. " +
      "C'est volontairement facile — l'objectif est de récupérer pour repartir frais au cycle suivant.",
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
