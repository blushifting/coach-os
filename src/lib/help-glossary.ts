export type HelpTopic =
  | 'plafond'
  | 'rpe'
  | 'cycle'
  | 'deload'
  | 'poly'
  | 'iso'
  | 'etire'
  | 'volumeHebdo'
  | 'volumeTotalCycle'
  | 'vminmax'
  | 'amplitude'
  | 'hypertrophie'
  | 'vsSem1'
  | 'prDuJour'
  | 'deltoides'
  | 'adherence';

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
      "Note l'intensité ressentie en fin de série, sur une échelle de 6 à 10 " +
      "(en dessous de 6 c'est trop facile pour stimuler du muscle). " +
      "Repères : 6 = il restait 4 reps en réserve, 7 = 3 reps, 8 = 2 reps, " +
      "9 = 1 rep, 10 = échec total (impossible d'en faire une de plus). " +
      "C'est ce que les coachs appellent RPE (Rate of Perceived Exertion). " +
      "Kotsh s'en sert pour ajuster automatiquement la charge à la séance " +
      "suivante : effort plus bas que la cible → on monte ; plus haut → on " +
      "baisse. Plus tu es honnête dans la note, mieux Kotsh calibre.",
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
  volumeTotalCycle: {
    title: 'Volume total du cycle',
    body:
      "Somme du tonnage soulevé sur l'ensemble du cycle (5 semaines), tous exos et toutes séries confondus. " +
      "Calculé comme charge × reps cumulées. Mesure brute de la « quantité » de travail produite sur le cycle. " +
      "Sert surtout à comparer un cycle à l'autre — il monte mécaniquement quand tu progresses en charge ou en assiduité, " +
      "et baisse les cycles avec semaine sautée. À ne pas confondre avec le « volume hebdo » (séries/sem/muscle).",
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
    body: 'Augmenter la taille du muscle. Reps 6-15, Effort 7-9, volume élevé. À ne pas confondre avec le « volume hebdo » qui est juste le nombre de séries/sem.',
  },
  vsSem1: {
    title: 'vs sem1',
    body: "Comparaison de la charge actuelle avec celle de la semaine 1 du cycle en cours. Mesure la progression nette intra-cycle, avant déload.",
  },
  prDuJour: {
    title: 'Record du jour',
    body: "Record personnel de la séance : meilleure performance (charge × reps × effort) atteinte aujourd'hui sur un exercice, comparée à toutes les séances précédentes. Représenté par une étoile sur les courbes de force.",
  },
  adherence: {
    title: 'Adhérence',
    body:
      "Pourcentage de séances effectivement faites sur les séances planifiées du cycle (5 semaines). " +
      "100 % = tu as fait toutes les séances prévues. 60 % = tu en as raté 4 sur 10. " +
      "Plus l'adhérence est haute, plus les ajustements de Kotsh (charges, volume, déload) reflètent ta réalité — " +
      "et plus tu progresses. C'est l'indicateur le plus simple pour suivre ta régularité.",
  },
  deltoides: {
    title: 'Pourquoi 2 deltoïdes seulement (lat + post) ?',
    body:
      "Le deltoïde a 3 chefs : antérieur, latéral, postérieur. Côté cible, " +
      "Kotsh ne suit que latéraux et postérieurs — pas les antérieurs. " +
      "Raison : les antérieurs sont saturés en continu par tout exo de " +
      "pectoraux (développé couché, dips, pompes…) et de presse verticale. " +
      "En ajouter un quota séparé créerait du sur-volume systémique. " +
      "À l'inverse, les postérieurs sont sous-développés chez quasi tous " +
      "les pratiquants — Kotsh les ajoute automatiquement en Maintien dès " +
      "que tu travailles pectoraux, deltos latéraux ou triceps (règle " +
      "scientifique R4, Cools 2014 — prévention du conflit sous-acromial, " +
      "blessure d'épaule la plus fréquente en muscu).",
  },
};
