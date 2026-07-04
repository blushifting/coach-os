export type HelpTopic =
  | 'plafond'
  | 'reserve'
  | 'cycle'
  | 'deload'
  | 'poly'
  | 'iso'
  | 'etire'
  | 'volumeHebdo'
  | 'volumeTotalCycle'
  | 'vminmax'
  | 'hypertrophie'
  | 'vsSem1'
  | 'prDuJour'
  | 'adherence'
  | 'echec';

export interface HelpEntry {
  readonly title: string;
  readonly body: string;
}

export const HELP_GLOSSARY: Readonly<Record<HelpTopic, HelpEntry>> = {
  plafond: {
    title: 'Plafond',
    body:
      "Charge max estimée pour 1 répétition sur un exo donné — aussi appelée 1RM ou e1RM dans le jargon muscu. " +
      "Calculée automatiquement par Kotsh à partir de tes meilleures séries (formule d'Epley étendue) : " +
      "pas besoin de tester un vrai 1RM à chaque fois, c'est plus sûr et tout aussi précis. " +
      "Sur les exos au poids du corps (tractions, dips…), le plafond inclut ton poids de corps, pas juste la charge ajoutée. " +
      "Le plafond se met à jour à chaque séance et sert à calculer tes charges de travail.",
  },
  reserve: {
    title: 'Réserve',
    body:
      "Le nombre de reps que tu aurais encore pu faire avant l'échec. " +
      "2 en réserve, c'est t'arrêter 2 reps avant de bloquer. " +
      "L'échelle : 4+ = encore facile, 3 = confortable, " +
      "2 = dur mais gérable, 1 = à la limite, " +
      "échec = plus aucune rep possible. " +
      "Kotsh s'en sert pour ajuster ta charge à la séance suivante : " +
      "plus tu es honnête, mieux il calibre. " +
      "(Aussi appelé RIR ou RPE dans la littérature.)",
  },
  cycle: {
    title: 'Cycle',
    body: "Bloc de 4 semaines de progression + 1 semaine où Kotsh peut te proposer une récupération. Au bout de chaque cycle, tu fais le bilan.",
  },
  deload: {
    title: 'Récupération (semaine allégée)',
    body:
      "En fin de cycle, si tu as bien suivi tes séances, Kotsh te propose une semaine allégée : moitié moins de séries et au moins 4 reps en réserve (rien de poussé). " +
      "Sert à faire redescendre la fatigue accumulée sans perdre les gains. " +
      "C'est volontairement facile — l'objectif est de récupérer pour repartir frais au cycle suivant. " +
      "(Aussi appelée « déload » dans le jargon muscu.)",
  },
  poly: {
    title: 'Polyarticulaire',
    body: 'Mobilise plusieurs articulations à la fois. Squat, développé couché, rowing… Les exercices les plus rentables pour gagner en force.',
  },
  iso: {
    title: 'Isolation',
    body: 'Mobilise une seule articulation. Curl biceps, leg extension, élévation latérale. Pour cibler un muscle précis, utile en hypertrophie.',
  },
  etire: {
    title: 'Étiré (lengthened bias)',
    body: 'Variante où le muscle est travaillé en position allongée — meilleure stimulation hypertrophique. Ex : curl incliné pour le biceps, extension triceps au-dessus de la tête.',
  },
  volumeHebdo: {
    title: 'Volume hebdo',
    body: 'Nombre de séries par muscle par semaine. La variable la plus puissante pour grossir : seuil critique autour de 10 séries/sem/muscle (Schoenfeld 2017).',
  },
  volumeTotalCycle: {
    title: 'Volume total du cycle',
    body:
      "Somme du tonnage soulevé sur l'ensemble du cycle (5 semaines), tous exos et toutes séries confondus. " +
      "Calculé comme charge × reps cumulées. Mesure brute de la « quantité » de travail produite sur le cycle. " +
      "Sert surtout à comparer un cycle à l'autre — il monte mécaniquement quand tu progresses en charge ou en assiduité, " +
      "et redescend sur les cycles où tu as sauté des séances. À ne pas confondre avec le « volume hebdo » (séries/sem/muscle).",
  },
  vminmax: {
    title: 'Volume minimal / maximal',
    body: 'Intervalle de séries par semaine. Le minimum (V_min) est le seuil en dessous duquel tu stagnes ; le maximum (V_max), celui au-dessus duquel la fatigue annule les gains. Kotsh les ajuste à chaque bilan de cycle.',
  },
  hypertrophie: {
    title: 'Hypertrophie',
    body: 'Croissance de la taille du muscle. À ne pas confondre avec le « volume hebdo » (juste le nombre de séries par semaine).',
  },
  vsSem1: {
    title: 'Progression intra-cycle',
    body: "Comparaison de la charge actuelle avec celle de la semaine 1 du cycle en cours. Mesure la progression nette sur le cycle, avant la semaine de récupération.",
  },
  prDuJour: {
    title: 'Record personnel',
    body: "Meilleure performance jamais atteinte sur un exercice (combinaison de la charge, des reps et de la Réserve). Une étoile la marque sur les courbes de force à chaque fois que tu bats ta marque précédente.",
  },
  adherence: {
    title: 'Assiduité',
    body:
      "Pourcentage de séances effectivement faites sur les séances planifiées du cycle (5 semaines). " +
      "Plus ton assiduité est haute, plus les ajustements de Kotsh (charges, volume, récupération) reflètent ta réalité — " +
      "et plus tu progresses. C'est l'indicateur le plus simple pour suivre ta régularité.",
  },
  echec: {
    title: 'Échec',
    body:
      "Le point où tu ne peux plus faire une seule rep de plus, même en forçant — la barre ne monte plus. " +
      "C'est l'intensité maximale d'une série : 0 rep en réserve. " +
      "En calibration, c'est ce qui permet de mesurer ton vrai Plafond.",
  },
};
