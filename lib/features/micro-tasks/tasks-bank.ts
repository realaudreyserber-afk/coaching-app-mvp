import { MicroTask } from './schema';

export const MICRO_TASKS_BANK: MicroTask[] = [
  // Nutrition Category
  {
    id: 'nut_weigh_eye',
    text: "Pèse 3 aliments de ton prochain repas que tu aurais d'habitude estimés à l'œil. Note la différence.",
    category: 'nutrition',
  },
  {
    id: 'nut_water_glass',
    text: "Boit un grand verre d'eau plate (250ml) dès le saut du lit pour relancer l'hydratation.",
    category: 'nutrition',
  },
  {
    id: 'nut_satiety_half',
    text: "Fais une pause de 30 secondes au milieu de ton assiette pour évaluer ton niveau de satiété réel.",
    category: 'nutrition',
  },
  {
    id: 'nut_proteins_first',
    text: "Commence ton repas principal en mangeant la source de protéines en premier.",
    category: 'nutrition',
  },
  {
    id: 'nut_no_distraction',
    text: "Prends un repas complet aujourd'hui sans regarder aucun écran (téléphone, ordinateur, TV).",
    category: 'nutrition',
  },
  {
    id: 'nut_green_veggies',
    text: "Ajoute au moins 100g de légumes verts ou de crudités à ton déjeuner ou ton dîner.",
    category: 'nutrition',
  },
  
  // Lifestyle Category
  {
    id: 'life_walk_post_meal',
    text: "Marche activement pendant 10 minutes juste après ton repas principal de la journée.",
    category: 'lifestyle',
  },
  {
    id: 'life_sleep_winddown',
    text: "Coupe tous tes écrans 30 minutes avant de dormir. Lis un livre ou fais des étirements doux.",
    category: 'lifestyle',
  },
  {
    id: 'life_neat_stairs',
    text: "Prends systématiquement les escaliers aujourd'hui à la place de l'ascenseur ou des escaliers mécaniques.",
    category: 'lifestyle',
  },
  {
    id: 'life_breath_stress',
    text: "Prends 3 respirations diaphragmatiques lentes et profondes avant de commencer ton premier repas.",
    category: 'lifestyle',
  },
  {
    id: 'life_sleep_target',
    text: "Organise ta soirée pour cumuler au moins 7h30 de sommeil cette nuit.",
    category: 'lifestyle',
  },

  // Training Category
  {
    id: 'train_warmup',
    text: "Accorde 5 minutes complètes à ton échauffement articulaire avant ton entraînement.",
    category: 'training',
  },
  {
    id: 'train_mobility',
    text: "Effectue 10 minutes d'étirements ou de travail de mobilité pour le bas du corps (hanches/chevilles).",
    category: 'training',
  },
  {
    id: 'train_notes',
    text: "Note précisément tes charges et répétitions de ta séance du jour pour préparer la surcharge progressive.",
    category: 'training',
  },
  {
    id: 'train_posture_walk',
    text: "Pense à te tenir droit avec les épaules basses et la poitrine ouverte pendant tes déplacements aujourd'hui.",
    category: 'training',
  }
];

export const GLP1_TASKS_BANK: MicroTask[] = [
  {
    id: 'glp1_hydration',
    text: "Boit au moins 2,5L d'eau aujourd'hui par petites gorgées régulières pour prévenir la constipation.",
    category: 'lifestyle',
  },
  {
    id: 'glp1_fiber',
    text: "Assure-toi de consommer au moins 25g de fibres aujourd'hui (légumes, graines de chia, flocons d'avoine).",
    category: 'nutrition',
  },
  {
    id: 'glp1_protein_density',
    text: "Répartis ton apport protéique en 4 prises régulières d'au moins 25-30g aujourd'hui.",
    category: 'nutrition',
  },
  {
    id: 'glp1_chew_slowly',
    text: "Pose tes couverts entre chaque bouchée et prends le temps de mâcher chaque aliment 20 fois.",
    category: 'nutrition',
  }
];

export const HIGH_BF_TASKS_BANK: MicroTask[] = [
  {
    id: 'hbf_steps_target',
    text: "Ajoute 1500 pas à ta moyenne de pas quotidienne habituelle en marchant à intensité basse.",
    category: 'lifestyle',
  },
  {
    id: 'hbf_standing',
    text: "Passe au moins 2 heures debout cumulées aujourd'hui (travail debout, appels téléphoniques).",
    category: 'lifestyle',
  },
  {
    id: 'hbf_hydration_pre_meal',
    text: "Boit un grand verre d'eau 15 minutes avant ton repas principal pour réguler la faim.",
    category: 'nutrition',
  }
];
