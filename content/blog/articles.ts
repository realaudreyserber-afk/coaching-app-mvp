/**
 * Articles statiques du blog NoDream.
 * Stockés en TS plutôt qu'en MDX pour éviter une dep supplémentaire.
 * Le rendu utilise <MarkdownLight> (composants/coach/markdown-light.tsx)
 * qui couvre **bold**, *italic*, `code`, paragraphes et listes.
 */

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  date: string; // ISO
  read_minutes: number;
  category: string;
  citations?: string[]; // ex: ["Garthe 2011", "Helms 2014"]
  hero_image?: string; // absolute path under /public, ex: /blog-images/garthe-2011.jpg
  hero_alt?: string;
  accent_chart?: "garthe-2011" | "whtr-scale" | "anabolic-window"; // inline SVG to render
}

export const ARTICLES: Article[] = [
  {
    slug: "perdre-1kg-par-semaine-ruine-ton-muscle",
    title: "Perdre 1 kg par semaine, c'est la dette qui te ruinera",
    excerpt:
      "La balance descend vite, l'ego est content. Six mois plus tard tu pèses moins mais tu as moins de muscle qu'avant. Voici pourquoi.",
    category: "Vitesse de perte",
    date: "2026-05-25",
    read_minutes: 4,
    citations: ["Garthe 2011"],
    hero_image: "/blog-images/garthe-rate.jpg",
    hero_alt: "Athlète en sèche, barre de squat sur les épaules, salle minimaliste éclairée à contre-jour",
    accent_chart: "garthe-2011",
    body: `On te vend partout des plans "perte 1 kg/semaine garantie". Marketing efficace. Physiologie médiocre.

Une étude RCT de 2011 sur 24 athlètes élite a comparé deux vitesses de perte :
- Groupe lent : 0.7 % du poids corporel par semaine
- Groupe rapide : 1.4 % du poids corporel par semaine

**Le verdict.**

Groupe lent : -5.6 % de masse grasse, **+2.1 % de masse maigre**, gains en force au développé couché +11.9 % et au squat +4 %.

Groupe rapide : -3.0 % de masse grasse, masse maigre **inchangée**, gains de force **moindres ou nuls**.

Traduit : perdre plus vite ne fait pas perdre plus de gras. Ça fait perdre moins de gras et stagne la performance. C'est l'inverse du résultat recherché.

**Pourquoi.**

Quand le déficit est trop agressif, ton corps ne sait pas si tu pourras manger demain. Il préserve le gras (réserve d'énergie) et catabolise le muscle (cher à maintenir). C'est une réponse de survie, pas un défaut.

**Le bon rythme.**

- Athlète sec : 0.4 à 0.7 % du poids/semaine
- Profil normal : 0.5 à 1.0 %
- Surpoids gras : 0.7 à 1.2 %
- Obésité musclée : 0.5 à 0.8 % (la balance bougera moins, c'est normal)

Pour un homme de 100 kg, ça veut dire 500 à 1000 g par semaine maximum. Pas 2 kg parce que tu l'as vu sur TikTok.

**Conclusion.**

Tu peux pousser plus fort. Tu paieras en muscle. La balance dira "ça marche" pendant trois mois, ton miroir et tes performances diront la vérité au bout de six.

La sèche, c'est un investissement, pas une dette à la consommation.`,
  },
  {
    slug: "imc-est-mort",
    title: "L'IMC est mort, vive la composition corporelle",
    excerpt:
      "L'indice de masse corporelle a été inventé en 1832 pour étudier des populations entières, pas pour évaluer des individus. Aujourd'hui il classe des athlètes en obèses et te dit que tu vas bien parce que tu pèses 70 kg pour 1m75. Voilà ce qu'il faut regarder à la place.",
    category: "Mesure",
    date: "2026-05-25",
    read_minutes: 5,
    citations: ["Ashwell 2012"],
    hero_image: "/blog-images/imc-mort.jpg",
    hero_alt: "Mètre ruban enroulé sur un fond charcoal, lumière dorée latérale, objet isolé",
    accent_chart: "whtr-scale",
    body: `Adolphe Quetelet, statisticien belge, 1832. Il cherche à décrire des populations entières. Il invente un indice rapide : poids divisé par taille au carré. Il prévient lui-même : *ne pas utiliser au niveau individuel*.

200 ans plus tard, ton médecin t'annonce que tu as un IMC de 32 et que tu dois "perdre du poids" sans te demander combien tu fais de squat.

**Le problème.**

L'IMC ne sait pas faire la différence entre 10 kg de gras et 10 kg de muscle. Pour lui c'est pareil.

Conséquences absurdes :
- Un rugbyman de 110 kg pour 1m85, 12 % de gras → "obèse classe 1" selon l'IMC
- Un sédentaire de 70 kg pour 1m75, 30 % de gras → "poids normal" selon l'IMC

Devine lequel des deux risque l'infarctus dans 10 ans.

**Ce qu'il faut regarder à la place.**

Le seul ratio simple qui ait fait ses preuves cliniquement : le **WHtR** (Waist-to-Height Ratio). Tour de taille divisé par taille.

\`\`\`
WHtR = tour_taille_cm / taille_cm
\`\`\`

Règle de poche : ton tour de taille doit être inférieur à la moitié de ta taille.

| WHtR | Lecture |
|---|---|
| Moins de 0.43 | Sous-poids ou très sec |
| 0.43 - 0.49 | Optimal santé |
| 0.50 - 0.57 | Surpoids viscéral, à surveiller |
| 0.58 - 0.62 | Obésité viscérale, action |
| Plus de 0.63 | Sévère, consulte |

Une étude de 2012 sur des dizaines de cohortes a montré que le WHtR prédit mieux le risque cardio-métabolique que l'IMC. Plus simple. Plus précis. Et tu n'as besoin que d'un mètre ruban à 3 euros.

**Mesure correcte.**

Debout, mètre horizontal, au niveau du nombril, expiration complète, ventre **non rentré**. Pas de triche.

**Conclusion.**

L'IMC n'a aucune place dans un plan personnalisé. Il a sa place dans des études épidémiologiques sur 50 000 personnes. Si quelqu'un te juge à ton IMC, tu peux poliment ranger sa réflexion à la même date que son outil.`,
  },
  {
    slug: "fenetre-anabolique-est-un-mythe",
    title: "La fenêtre anabolique de 30 minutes n'existe pas",
    excerpt:
      "Tu cours aux vestiaires shaker en main parce qu'on t'a dit que les 30 minutes post-training étaient sacrées. Tu peux ralentir. La science dit autre chose depuis dix ans.",
    category: "Protéines",
    date: "2026-05-25",
    read_minutes: 3,
    citations: ["Jäger 2017"],
    hero_image: "/blog-images/fenetre-anabolique.jpg",
    hero_alt: "Horloge analogique abstraite éclatée, fond charcoal éditorial, lumière or",
    accent_chart: "anabolic-window",
    body: `Le mythe est simple : passé 30 minutes après la fin de la séance, ton muscle ne profiterait plus des protéines. Donc shaker immédiat. Sinon c'est perdu.

L'origine vient d'études sur des sujets **à jeun** depuis 8+ heures, où effectivement l'apport rapide post-effort changeait des choses. La généralisation s'est faite toute seule. Mal.

**Ce qu'on sait vraiment en 2017** (position officielle ISSN, organisme de référence en nutrition sportive) :

- La sensibilité anabolique du muscle reste élevée **pendant au moins 24 heures** après une séance.
- Le déterminant n°1 n'est pas le timing post-effort. C'est **l'apport total quotidien en protéines** et sa répartition.
- L'apport recommandé en cut : 2.3 à 3.1 g de protéines par kilo de masse maigre par jour.
- À répartir en 4 à 6 prises de 0.25 à 0.40 g/kg, espacées de 3 à 4 heures.

**Concrètement.**

Si tu termines ta séance à 18 h et que tu manges à 20 h, ton muscle est encore en condition de capter. Tu ne joues pas au sprint avec le shaker.

Si tu mangeas un repas riche en protéines 2 heures **avant** la séance, l'effet anabolique post-effort est déjà couvert.

**Ce qui compte vraiment :**

1. Atteindre ta cible protéique totale sur 24 h.
2. Bien répartir entre 4 et 6 prises.
3. Avoir au moins une prise riche en leucine (whey, œuf, viande maigre) dans les 2 heures post-effort si tu peux. Sinon pas la fin du monde.

**Le résidu de vérité.**

Si tu t'entraînes à jeun depuis 14 heures, oui, le timing post-effort compte plus que d'habitude. Pour 99 % des cas, non.

**Conclusion.**

Le post-workout immédiat est moins critique que la régularité sur 24 heures. Tu peux aller te doucher tranquillement, manger un vrai repas, et continuer ta vie. Le muscle attendra.`,
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getAllArticles(): Article[] {
  return [...ARTICLES].sort((a, b) => b.date.localeCompare(a.date));
}
