/**
 * Synonymes / aliases FR + EN par id d'exercice (Conv #10d).
 *
 * Origine : Azur cherchait des exos sous un nom usuel (ex. "DC", "bench
 * press", "shrugs", "SDT") sans les trouver. Ce mapping enrichit le champ
 * `synonymes` des entrées de `exercises.json` (volontairement vide à la
 * source pour ne pas dupliquer entre src/ et prototype/data/). Il est
 * mergé au chargement par `loadExercises()`.
 *
 * Convention :
 *  - Inclure abréviations FR usuelles (DC, SDT, RDL, OHP, GHR, …).
 *  - Inclure noms anglais courants quand l'exo est connu sous ce nom.
 *  - Pas de redondance avec `nom_fr` (la recherche fuzzy match déjà dessus) :
 *    on ne réécrit pas "Squat" pour `squat_bb_high`, on ajoute "back squat".
 *  - Tout en minuscule (la comparaison est case-insensitive de toute façon).
 *
 * Marques machines salles FR (Conv #23, item O) : Technogym (Selection
 * 700/900, Pure Strength), Hammer Strength (Iso-Lateral), Matrix
 * (Aura, Versa, Magnum), Life Fitness, Cybex, Nautilus. Présentes
 * notamment dans Fitness Park (HS + Technogym), Basic-Fit (Life Fitness
 * + Technogym), Magic Form (Matrix), Keepcool / L'Orange Bleue /
 * L'Appart Fitness (Technogym), CMG (Technogym + Cybex). On intègre les
 * noms marketing courts que l'user voit étiquetés sur la machine
 * (« iso-lateral row », « selection chest press », « aura chest press »,
 * « versa pulldown », « vertical traction », « glute drive »…), sans
 * le préfixe marque (déjà capté par le fuzzy si tapé en plus).
 *
 * Côté parité Python : ce mapping vit côté TS car la recherche fuzzy est
 * UI-only. Le prototype peut être miroité plus tard (`prototype/data/`)
 * s'il devient consommateur de la recherche.
 */

export const EXERCISE_SYNONYMES: Readonly<Record<string, readonly string[]>> = {
  // Pectoraux
  bench_bb: ['DC', 'bench press', 'bench', 'développé barre'],
  bench_bb_incl30: ['DC incliné', 'incline bench', 'incliné barre', 'développé incliné'],
  bench_bb_incl45: ['DC très incliné', 'incline 45'],
  bench_bb_decl: ['DC décliné', 'decline bench'],
  bench_bb_close: ['DC serré', 'close grip bench', 'CGBP'],
  smith_bench: ['DC smith', 'bench smith', 'smith bench press', 'smith chest press'],
  bench_db: ['DC haltères', 'développé couché haltères', 'db bench'],
  bench_db_incl30: ['DC incliné haltères', 'incline db bench', 'incliné haltères'],
  bench_db_decl: ['DC décliné haltères', 'decline db bench'],
  chest_press_machine: [
    'développé pectoraux machine', 'chest press', 'machine bench',
    'iso-lateral chest press', 'iso-lateral horizontal bench press',
    'iso-lateral bench press', 'selection chest press',
    'aura chest press', 'versa chest press', 'magnum chest press',
    'plate loaded chest press',
  ],
  chest_press_incl_machine: [
    'développé incliné machine', 'incline chest press',
    'iso-lateral incline chest press', 'iso-lateral incline press',
    'super incline press', 'selection incline chest press',
    'aura incline chest press', 'versa incline chest press',
  ],
  dips_chest: ['dips pectoraux', 'chest dips'],
  pushup: ['pompes', 'push-up', 'push up'],
  pushup_loaded: ['pompes lestées', 'weighted pushup'],
  db_fly_flat: ['écarté', 'écarté plat', 'fly', 'dumbbell fly'],
  db_fly_incl: ['écarté incliné', 'incline fly'],
  pec_deck: [
    'butterfly', 'papillon', 'pec fly', 'machine pectorale',
    'pec fly machine', 'chest fly machine', 'selection pec deck',
    'pectoral machine',
  ],
  cable_crossover_high: ['crossover', 'crossover haut', 'high cable fly', 'vis-à-vis haut'],
  cable_crossover_mid: ['crossover milieu', 'mid cable fly', 'vis-à-vis milieu'],
  cable_crossover_low: ['crossover bas', 'low cable fly', 'vis-à-vis bas'],

  // Dos largeur
  pullup: ['traction', 'pull-up', 'pull up', 'tractions pronation'],
  pullup_neutral: ['traction neutre', 'pull-up neutral grip'],
  chinup: ['chin-up', 'chin up', 'traction supination'],
  pullup_assisted: ['traction assistée', 'assisted pullup', 'machine traction assistée'],
  lat_pulldown: [
    'tirage poulie haute', 'lat pulldown', 'pulldown',
    'vertical traction', 'iso-lateral front lat pulldown',
    'iso-lateral pulldown', 'selection pulldown', 'lat machine',
    'aura pulldown', 'versa pulldown', 'magnum pulldown',
    'tirage nuque', 'tirage devant',
  ],
  lat_pulldown_neutral: [
    'tirage neutre', 'pulldown neutral', 'close grip pulldown',
    'tirage prise neutre serrée',
  ],
  lat_pulldown_supin: [
    'tirage supination', 'pulldown supinated', 'reverse grip pulldown',
    'tirage prise inversée',
  ],
  lat_pulldown_wide: [
    'tirage prise large', 'wide pulldown', 'wide grip lat pulldown',
  ],
  db_pullover: ['pullover', 'pullover haltère'],
  cable_pullover: [
    'pullover poulie', 'cable pullover', 'standing rope pullover',
    'straight arm pullover',
  ],
  straight_arm_pulldown: [
    'straight arm pulldown', 'pulldown bras tendus',
    'tirage bras tendus poulie haute',
  ],

  // Dos épaisseur
  bb_row: ['rowing barre', 'rowing', 'barbell row', 'rowing penché', 'bent over row'],
  t_bar_row: ['t-bar', 'tbar', 'landmine row', 't bar row'],
  db_row: ['rowing haltère', 'rowing un bras', 'one-arm row', 'one arm row'],
  chest_supported_db_row: [
    'rowing torse appuyé', 'chest supported row',
    'two-dumbbell row', 'bent over two-dumbbell row',
  ],
  seated_row_machine: [
    'rowing machine', 'tirage assis machine', 'machine row',
    'iso-lateral low row', 'iso-lateral high row', 'iso-lateral row',
    'low row', 'high row', 'selection row', 'D.Y. row', 'dy row',
    'aura seated row', 'versa seated row', 'magnum row',
    'rowing horizontal machine',
  ],
  cable_row: [
    'tirage horizontal', 'rowing poulie', 'cable row',
    'tirage poulie basse', 'seated cable row', 'rowing assis poulie',
  ],
  cable_row_neutral: ['cable row neutre', 'tirage horizontal neutre', 'narrow grip cable row'],
  cable_row_wide: ['cable row large', 'tirage horizontal large', 'wide grip cable row'],
  inverted_row: ['rowing inversé', 'rowing australien', 'australian pullup'],

  // Trapèzes
  bb_shrug: ['shrugs', 'shrugs barre', 'haussements épaules', 'barbell shrug'],
  db_shrug: ['shrugs haltères', 'db shrugs', 'dumbbell shrug'],
  cable_shrug: ['shrugs poulie', 'cable shrug'],
  machine_shrug: [
    'shrugs machine', 'shrugs smith', 'smith shrug',
    'machine shrug', 'selection shrug',
  ],
  upright_row_db: ['rowing menton', 'tirage menton haltères', 'upright row'],
  upright_row_cable: [
    'rowing menton poulie', 'upright row cable', 'cable upright row',
  ],

  // Quadriceps / fessiers
  squat_bb_high: ['squat', 'back squat', 'high bar', 'squat haute'],
  squat_bb_low: ['low bar squat', 'low bar', 'squat basse'],
  front_squat: ['front squat', 'FS'],
  goblet_squat: ['goblet'],
  smith_squat: ['squat smith', 'smith machine squat'],
  hack_squat_machine: [
    'hack squat', 'hack', 'plate-loaded hack squat',
    'hack squat machine', 'cybex hack squat',
  ],
  leg_press_45: [
    'presse 45', 'presse oblique', 'leg press', 'presse à cuisses',
    'selection leg press', 'iso-lateral leg press', 'plate loaded leg press',
    'aura leg press', 'versa leg press', 'magnum leg press',
    'presse inclinée',
  ],
  leg_press_horizontal: [
    'presse horizontale', 'horizontal leg press', 'seated leg press',
    'presse à cuisses assise',
  ],
  bulgarian_split: ['squat bulgare', 'bulgarian', 'split squat', 'bulgarian split'],
  walking_lunge: ['fente marchée', 'lunges', 'walking lunges'],
  reverse_lunge: ['fente inversée', 'reverse lunges'],
  step_up: ['step up', 'montée banc'],
  leg_extension: [
    'leg ext', 'extension jambes', 'selection leg extension',
    'machine leg extension', 'quad extension',
  ],
  sissy_squat: ['sissy'],

  // Ischios / fessiers / lombaires
  deadlift_conv: ['SDT', 'soulevé terre', 'deadlift', 'DL', 'SDT conventionnel'],
  deadlift_sumo: ['SDT sumo', 'sumo deadlift'],
  deadlift_trap_bar: ['trap bar', 'hex bar', 'SDT trap bar', 'trap bar deadlift'],
  rdl_bb: ['RDL', 'deadlift roumain', 'romanian deadlift', 'stiff leg deadlift', 'SDT jambes tendues'],
  rdl_db: ['RDL haltères', 'romanian deadlift db'],
  single_leg_rdl: ['RDL unilatéral', 'single leg deadlift'],
  good_morning: ['good morning', 'GM'],
  leg_curl_lying: [
    'leg curl couché', 'lying leg curl', 'machine leg curl',
    'selection lying leg curl', 'prone leg curl',
  ],
  leg_curl_seated: [
    'leg curl', 'leg curl assis', 'seated leg curl',
    'selection seated leg curl', 'machine leg curl assis',
  ],
  leg_curl_standing: [
    'leg curl debout', 'standing leg curl', 'unilateral leg curl',
  ],
  ghr: ['glute ham raise', 'GHR', 'glute-ham raise'],

  // Fessiers
  hip_thrust_bb: ['hip thrust', 'HT', 'hip thrust barre'],
  hip_thrust_machine: [
    'hip thrust machine', 'HT machine', 'glute drive',
    'nautilus glute drive', 'selection glute', 'machine hip thrust',
  ],
  glute_bridge: ['glute bridge', 'pont fessier', 'bridge'],
  single_leg_hip_thrust: ['hip thrust unilatéral', 'single leg hip thrust'],
  cable_kickback: [
    'kickback fessier', 'kickback poulie', 'glute kickback', 'cable glute kickback',
  ],
  cable_pull_through: ['pull through', 'pull-through poulie'],
  bb_glute_bridge: ['glute bridge barre'],

  // Mollets
  calf_standing_machine: [
    'mollets debout', 'standing calf raise', 'extension mollets debout',
    'standing calf machine', 'machine mollets debout',
  ],
  calf_seated_machine: [
    'mollets assis', 'seated calf raise', 'seated calf machine',
    'machine mollets assis',
  ],
  calf_leg_press: ['mollets presse', 'calf press', 'calf press on leg press'],
  calf_smith: ['mollets smith', 'smith calf raise'],
  calf_db_single: ['mollets haltère', 'mollet unilatéral', 'single leg calf raise'],

  // Épaules
  ohp_bb_standing: ['OHP', 'développé militaire', 'overhead press', 'military press', 'DM', 'développé épaules'],
  ohp_bb_seated: ['OHP assis', 'développé militaire assis', 'seated overhead press', 'seated barbell military press'],
  ohp_db_seated: ['DDH', 'développé haltères', 'développé épaules haltères', 'seated db press', 'shoulder press'],
  arnold_press: ['arnold', 'arnold dumbbell press'],
  machine_shoulder_press: [
    'développé épaules machine', 'machine shoulder press',
    'iso-lateral shoulder press', 'selection shoulder press',
    'aura shoulder press', 'versa shoulder press',
    'machine military press', 'développé militaire machine',
  ],
  db_lateral_raise: ['élévations latérales', 'lateral raise', 'side raise', 'side lateral'],
  cable_lateral_raise: [
    'élévations latérales poulie', 'cable lateral raise', 'side cable raise',
  ],
  machine_lateral_raise: [
    'élévations latérales machine', 'lateral raise machine',
    'selection lateral raise', 'machine side raise',
  ],
  face_pull: ['face pull', 'cable face pull'],
  rear_delt_db_fly: ['oiseau', 'rear delt fly', 'rear delt', 'élévations buste penché'],
  chest_supported_rear_fly: ['oiseau torse appuyé', 'chest supported rear delt', 'seated bent over rear delt'],
  cable_rear_delt_fly: ['rear delt poulie', 'cable rear delt', 'cable rear delt fly'],
  reverse_pec_deck: [
    'pec deck inversé', 'reverse pec deck', 'rear pec deck',
    'reverse machine flyes', 'rear delt machine',
  ],

  // Biceps
  bb_curl: ['curl biceps', 'curl barre', 'barbell curl'],
  ez_curl: ['curl EZ', 'EZ curl', 'curl pied', 'ez-bar curl'],
  db_curl_alt: ['curl haltères', 'curl alterné', 'biceps curl', 'db curl', 'alternate dumbbell curl'],
  incline_db_curl: ['curl incliné', 'incline db curl', 'incline dumbbell curl'],
  hammer_curl: ['hammer', 'marteau', 'curl marteau', 'hammer curl'],
  preacher_curl_bb: ['scott', 'pupitre', 'preacher curl', 'curl scott', 'banc scott', 'banc preacher'],
  preacher_curl_db: ['scott haltères', 'pupitre haltères', 'preacher db', 'dumbbell preacher curl'],
  cable_curl: ['curl poulie', 'cable curl', 'standing cable curl', 'curl biceps poulie basse'],
  spider_curl: ['spider'],
  concentration_curl: ['concentration', 'concentration curl'],

  // Triceps
  triceps_pushdown_bar: [
    'pushdown', 'extension triceps poulie', 'tirage triceps',
    'triceps pushdown', 'triceps extension cable',
  ],
  triceps_pushdown_rope: ['pushdown corde', 'rope pushdown', 'triceps corde'],
  dips_triceps: ['dips', 'dips triceps', 'triceps dips'],
  close_grip_bench: ['DC serré', 'close grip bench', 'CGBP'],
  overhead_db_extension: ['extension nuque haltères', 'overhead triceps extension', 'french press haltères', 'seated triceps press'],
  overhead_cable_extension: ['extension nuque poulie', 'overhead cable extension', 'cable overhead extension'],
  french_press_ez: ['french press', 'skull crusher', 'skullcrusher', 'lying triceps extension', 'ez-bar skullcrusher'],
  jm_press: ['JM press', 'JM'],
  kickback_db: ['kickback triceps', 'triceps kickback', 'dumbbell kickback'],
  cable_pushdown_v_bar: ['pushdown V-bar', 'V-bar pushdown', 'triceps v-bar'],

  // Abdos / obliques
  cable_crunch: ['crunch poulie', 'cable crunch'],
  crunch_machine: ['crunch machine', 'abdos machine', 'ab crunch machine', 'selection ab crunch'],
  crunch_floor: ['crunch', 'crunches', 'abdos', 'crunch sol'],
  hanging_leg_raise: ['relevé jambes', 'hanging leg raise', 'abdos suspendu', 'leg raise'],
  captains_chair_leg_raise: ['chaise romaine', "captain's chair"],
  lying_leg_raise: ['relevé jambes allongé', 'lying leg raise'],
  ab_wheel_rollout: ['ab wheel', 'roulette abdos', 'rollout'],
  sit_up_decline: ['sit-up', 'sit up', 'redressement assis'],
  db_side_bend: ['inclinaison latérale', 'side bend'],
  side_plank_loaded: ['planche latérale', 'side plank'],
  russian_twist: ['russian twist', 'rotation russe'],
  oblique_crunch: ['crunch oblique'],

  // Lombaires
  back_extension_45: [
    'hyperextension', 'hyperextension 45', 'lombaires banc', 'back extension',
    'banc à lombaires', 'roman chair',
  ],
  back_extension_horizontal: ['hyperextension horizontale', 'horizontal back extension'],
  reverse_hyper: ['reverse hyper', 'reverse hyperextension'],
};
