# Bibliographie scientifique — Corpus sèche / recomposition

**Usage** : référentiel interne pour coach IA — chaque référence est fichée avec ses métadonnées, le claim qu'elle supporte, et son contexte d'usage.

> ⚠️ **RÈGLE STRICTE D'ATTRIBUTION** — le coach IA NE DOIT JAMAIS mentionner :
> - le nom commercial de la source de ce corpus (titre, marque)
> - l'auteur de la source ou sa diététicienne collaboratrice
> - la maison d'édition
> - tout code promo ou site partenaire
>
> Les références scientifiques listées ici (Helms, Garthe, Jäger, Aragon, Romijn, Tanaka, etc.) sont des publications académiques publiques et **restent citables sous leur nom d'auteur**.

---

## Index par thématique

| Thème | Références |
|-------|------------|
| **Métabolisme de base & dépense énergétique** | REF-01, REF-02 |
| **Protéines & préservation masse maigre en déficit** | REF-03, REF-11, REF-12, REF-13 |
| **Restriction calorique : effets cardiovasculaires & inflammation** | REF-04 |
| **Adaptations musculaires & nutrition péri-entraînement** | REF-05 |
| **Substrats énergétiques (glucides vs lipides) selon intensité** | REF-06, REF-07 |
| **Fréquence cardiaque maximale** | REF-08 |
| **Stress oxydatif & dysfonction mitochondriale à l'effort** | REF-09 |
| **Vitesse de perte de poids & préservation force/puissance** | REF-10 |
| **Recommandations consolidées prep bodybuilding** | REF-14, REF-15 |

---

## Mapping des citations dans le corps du PDF

| Appel dans le texte | Page PDF | Référence | Claim supporté |
|--------------------|----------|-----------|----------------|
| (1) | p.19 | REF-01 Frankenfield 2005 | "Le MB représente la plus grande part de la DETQ" |
| (2) | p.19 | REF-02 Rosenbaum 2010 | "Pour aller plus loin" sur la thermogenèse adaptative |
| (3) | p.20 | REF-03 Pasiakos 2013 | "Diminution de la performance et force musculaire" en déficit |
| (4) | p.20 | REF-04 Trexler 2014 | "Diminution de la récupération et adaptation" |
| (5) | p.20 | REF-05 Hawley 2011 | "Modification de la composition corporelle" |
| (9) | p.21 | probablement REF-07 Romijn 1993 (numérotation décalée) | Mobilisation glycogène + lipides en déficit |
| Formule FCmax = 208 − (0,7 × âge) | p.21 | REF-08 Tanaka 2001 | Formule la plus fiable pour FCmax |
| (10) | p.21 | probablement REF-10 Garthe 2011 (et non Helge) | Haute intensité + faible volume > haut volume + faible intensité pour préserver masse musculaire et force en déficit |

---

# Fiches détaillées

## REF-01

```yaml
id: REF-01
auteurs: Frankenfield DC, Roth-Yousey L, Compher C
annee: 2005
titre: "Comparison of Predictive Equations for Resting Metabolic Rate in Healthy Nonobese and Obese Adults: A Systematic Review"
journal: Journal of the American Dietetic Association
volume_pages: 105(5), 775-789
doi: 10.1016/j.jada.2005.02.005
lien: https://doi.org/10.1016/j.jada.2005.02.005
type_etude: Revue systématique
```

**Sujet** : Comparaison des équations prédictives du métabolisme de repos (MB) chez l'adulte sain non-obèse et obèse.
**Claim supporté dans le PDF** : Le métabolisme de base représente la plus grande part de la dépense énergétique totale quotidienne.
**Finding clé connu** : Mifflin-St Jeor est l'équation la plus fiable chez le non-obèse (≈ 82 % de précision à ±10 % du MB mesuré) ; toutes les équations perdent en précision chez l'obèse.
**Pertinence pour coach IA** : à utiliser quand on calcule la maintenance calorique d'un athlète — privilégier Mifflin-St Jeor sur Harris-Benedict.

---

## REF-02

```yaml
id: REF-02
auteurs: Rosenbaum M, Leibel RL
annee: 2010
titre: "Adaptive thermogenesis in humans"
journal: International Journal of Obesity
volume_pages: 34(S1), S47-S55
doi: 10.1038/ijo.2010.184
lien: https://doi.org/10.1038/ijo.2010.184
type_etude: Revue narrative
```

**Sujet** : Thermogenèse adaptative chez l'humain — comment la dépense énergétique chute en réponse à une perte de poids, au-delà de ce qu'expliquerait la seule réduction de masse.
**Claim supporté dans le PDF** : Référence "pour aller plus loin" sur le métabolisme et le déficit calorique.
**Finding clé connu** : Après perte de poids ≥ 10 %, la dépense énergétique totale baisse de 300-500 kcal/jour de plus que prédit par la composition corporelle — d'où la difficulté à maintenir le poids perdu. Le phénomène persiste plusieurs années post-perte.
**Pertinence pour coach IA** : crucial pour anticiper le plateau de sèche et planifier des refeeds / diet breaks.

---

## REF-03

```yaml
id: REF-03
auteurs: Pasiakos SM, Cao JJ, Margolis LM, et al.
annee: 2013
titre: "Effects of high-protein diets on fat-free mass and muscle protein synthesis following weight loss: a randomized controlled trial"
journal: The FASEB Journal
volume_pages: 27(9), 3837-3847
doi: 10.1096/fj.13-230227
lien: https://doi.org/10.1096/fj.13-230227
type_etude: RCT
```

**Sujet** : Effet de régimes hyperprotéinés sur la masse maigre et la synthèse protéique musculaire après perte de poids.
**Claim supporté dans le PDF** : Justifie l'impact du déficit calorique sur la performance et la force musculaire (cité en (3)).
**Finding clé connu** : Doubler ou tripler l'apport protéique (1.6-2.4 g/kg vs 0.8 g/kg) durant un déficit de ~40 % préserve significativement la masse maigre. La synthèse protéique post-prandiale reste maintenue avec un apport élevé.
**Pertinence pour coach IA** : socle scientifique pour fixer la cible protéique en cut autour de 2.2-2.5 g/kg de poids corporel (ou 2.3-3.1 g/kg de masse maigre selon Helms 2014).

---

## REF-04

```yaml
id: REF-04
auteurs: Trexler ET, Smith-Ryan AE, Norton LE
annee: 2014
titre: "Effects of caloric restriction on cardiovascular risk factors and inflammation in overweight individuals: a randomized controlled trial"
journal: Metabolism
volume_pages: 63(12), 1616-1624
doi: 10.1016/j.metabol.2014.09.010
lien: https://doi.org/10.1016/j.metabol.2014.09.010
type_etude: RCT
```

**Sujet** : Effets de la restriction calorique sur les facteurs de risque cardiovasculaires et l'inflammation chez des sujets en surpoids.
**Claim supporté dans le PDF** : Diminution de la récupération et de l'adaptation en déficit (cité en (4)).
**Note de pertinence** : le titre de l'étude (population en surpoids, focus cardio-inflammatoire) ne colle pas parfaitement au claim de l'auteur sur la récupération musculaire. À considérer comme citation indirecte — Trexler est plus connu pour ses travaux sur la metabolic adaptation (2014) chez les compétiteurs naturels.
**Pertinence pour coach IA** : utile pour l'argument que la restriction calorique a aussi des bénéfices cardio-métaboliques, mais ne pas s'appuyer dessus pour des claims sur la récupération à l'entraînement.

---

## REF-05

```yaml
id: REF-05
auteurs: Hawley JA, Burke LM, Phillips SM, Spriet LL
annee: 2011
titre: "Nutritional modulation of training-induced skeletal muscle adaptations"
journal: Journal of Applied Physiology
volume_pages: 110(3), 834-845
doi: 10.1152/japplphysiol.00949.2010
lien: https://doi.org/10.1152/japplphysiol.00949.2010
type_etude: Revue
```

**Sujet** : Comment la nutrition module les adaptations musculaires induites par l'entraînement.
**Claim supporté dans le PDF** : Modification de la composition corporelle en déficit (cité en (5)).
**Finding clé connu** : La disponibilité en glucides et en protéines autour de l'entraînement module fortement les signaux anaboliques (mTOR, AMPK, PGC-1α). Concept du "train low, compete high" évoqué pour l'endurance.
**Pertinence pour coach IA** : appui pour timer les glucides autour de la séance pendant la sèche (préserver l'intensité d'entraînement).

---

## REF-07

```yaml
id: REF-07
auteurs: Romijn JA, Coyle EF, Sidossis LS, Gastaldelli A, Horowitz JF, Endert E, Wolfe RR
annee: 1993
titre: "Regulation of endogenous fat and carbohydrate metabolism in relation to exercise intensity and duration"
journal: The American Journal of Physiology
volume_pages: 265(3 Pt 1), E380-E391
doi: 10.1152/ajpendo.1993.265.3.E380
lien: https://doi.org/10.1152/ajpendo.1993.265.3.E380
type_etude: Étude expérimentale (traceurs isotopiques)
```

**Sujet** : Régulation du métabolisme endogène des graisses et des glucides selon l'intensité et la durée de l'exercice.
**Claim supporté dans le PDF** : Justifie le choix de l'intensité modérée pour cibler l'oxydation des graisses ; explique pourquoi le cardio à faible intensité préserve le glycogène (probablement référencé en (9) dans le texte).
**Finding clé connu** : Étude de référence — à 25 % VO2max, les graisses fournissent ~80 % de l'énergie ; à 65 % VO2max, l'oxydation absolue des graisses est maximale (le "fat-max zone") ; au-dessus de 85 % VO2max, les glucides dominent. La célèbre courbe de crossover entre substrats.
**Pertinence pour coach IA** : référence canonique pour justifier le cardio LISS en sèche.

---

## REF-08

```yaml
id: REF-08
auteurs: Michal G, Schomburg D
annee: 2012
titre: "Biochemical Pathways: An Atlas of Biochemistry and Molecular Biology"
type: Ouvrage de référence
editeur: Wiley
note: Manuel, pas un article — pas de DOI
```

**Sujet** : Atlas des voies biochimiques et de la biologie moléculaire.
**Claim supporté dans le PDF** : Référence générale pour la physiologie de la production d'énergie (ATP, mitochondries, glycolyse, bêta-oxydation).
**Pertinence pour coach IA** : ouvrage de fond, pas exploitable pour citer un finding précis.

---

## REF-09 / Tanaka 2001

```yaml
id: REF-09
auteurs: Tanaka H, Monahan KD, Seals DR
annee: 2001
titre: "Age-predicted maximal heart rate revisited"
journal: Journal of the American College of Cardiology
volume_pages: 37(1), 153-156
doi: 10.1016/S0735-1097(00)01157-8
lien: https://doi.org/10.1016/S0735-1097(00)01157-8
type_etude: Méta-analyse + étude de validation
```

**Sujet** : Révision de la formule prédictive de la fréquence cardiaque maximale.
**Claim supporté dans le PDF** : Justifie l'utilisation de la formule **FCmax = 208 − (0,7 × âge)** plutôt que l'ancienne formule de Fox (220 − âge).
**Finding clé** : Méta-analyse de 351 études (N = 18 712) + étude de validation (N = 514). La formule de Tanaka est valide indépendamment du sexe et du niveau d'activité. Erreur standard ≈ 10 bpm pour un individu donné (les formules restent imprécises au niveau individuel).
**Pertinence pour coach IA** : utiliser cette formule + le seuil 60 % pour calibrer le cardio LISS, en gardant à l'esprit la marge d'erreur individuelle (idéal : test de terrain).

---

## REF-10

```yaml
id: REF-10
auteurs: Helge JW
annee: 2017
titre: "Exercise-induced metabolic perturbations and mitochondrial dysfunction: a debate"
journal: Journal of Physiology
volume_pages: 595(14), 4687-4696
doi: 10.1113/JP273046
lien: https://doi.org/10.1113/JP273046
type_etude: Débat / commentaire
```

**Sujet** : Débat sur les perturbations métaboliques induites par l'exercice et la dysfonction mitochondriale.
**Claim supporté dans le PDF** : Référence pour la fatigue mitochondriale en contexte de déficit énergétique.
**Note de pertinence** : Le claim que l'auteur du PDF associe à cette référence (haute intensité + faible volume > haut volume + faible intensité pour préserver masse musculaire) correspond beaucoup mieux à **Garthe 2011 (REF-11)**. Possible confusion de numérotation.

---

## REF-11 / Garthe 2011

```yaml
id: REF-11
auteurs: Garthe I, Raastad T, Refsnes PE, Koivisto A, Sundgot-Borgen J
annee: 2011
titre: "Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes"
journal: International Journal of Sport Nutrition and Exercise Metabolism
volume_pages: 21(2), 97-104
doi: 10.1123/ijsnem.21.2.97
lien: https://doi.org/10.1123/ijsnem.21.2.97
type_etude: RCT
```

**Sujet** : Effet de deux vitesses de perte de poids différentes sur la composition corporelle et la performance force/puissance chez des athlètes élite.
**Finding clé** : Étude majeure de la littérature. Comparaison perte de poids lente (0.7 %/semaine) vs rapide (1.4 %/semaine) chez des athlètes élite (N = 24) sur 5-12 semaines.
- **Groupe lent** : -5.6 % de masse grasse, +2.1 % de masse maigre, gains en force au développé couché (+11.9 %) et squat (+4 %).
- **Groupe rapide** : -3.0 % de masse grasse, masse maigre inchangée, gains de force moindres ou nuls.
**Pertinence pour coach IA** : référence canonique pour fixer la cible de perte de poids hebdomadaire en sèche athlétique → cible ≤ 0.7 % du poids corporel/semaine pour préserver les performances.

---

## REF-12

```yaml
id: REF-12
auteurs: Phillips SM, Van Loon LJ
annee: 2011
titre: "Dietary protein for athletes: from requirements to metabolic advantage"
journal: Applied Physiology, Nutrition, and Metabolism
volume_pages: 37(5), 67-76
doi: 10.1139/h11-009
lien: https://doi.org/10.1139/h11-009
type_etude: Revue
```

**Sujet** : Apports protéiques chez l'athlète, des besoins minimaux à l'avantage métabolique.
**Finding clé connu** : Recommandation de 1.3-1.8 g/kg/jour pour les athlètes en maintenance, à répartir en 4-6 prises de 0.25-0.40 g/kg toutes les 3-4 h. Apports plus élevés justifiés en phase de cut ou de récupération de blessure.

---

## REF-13

```yaml
id: REF-13
auteurs: Tipton KD, Hamilton DL, Gallagher IJ, et al.
annee: 2018
titre: "Protein metabolism in female endurance-trained athletes in the luteal phase of the menstrual cycle"
journal: The FASEB Journal
volume_pages: 32(1), 357-358
doi: 10.1096/fasebj.2018.32.1_supplement.357.1
lien: https://doi.org/10.1096/fasebj.2018.32.1_supplement.357.1
type_etude: Abstract de conférence
```

**Sujet** : Métabolisme protéique chez des athlètes féminines entraînées en endurance en phase lutéale du cycle menstruel.
**Pertinence pour coach IA** : très spécifique (population féminine + endurance + phase du cycle). Marginal pour le cadre général de la sèche masculine.

---

## REF-14 / Jäger 2017 (ISSN)

```yaml
id: REF-14
auteurs: Jäger R, Kerksick CM, Campbell BI, Cribb PJ, Wells SD, Skwiat TM, et al.
annee: 2017
titre: "International Society of Sports Nutrition Position Stand: protein and exercise"
journal: Journal of the International Society of Sports Nutrition
volume_pages: 14(1), 20
doi: 10.1186/s12970-017-0177-8
lien: https://doi.org/10.1186/s12970-017-0177-8
type_etude: Position stand officielle (ISSN)
```

**Findings clés** :
- Apports recommandés : 1.4-2.0 g/kg/jour pour la plupart des sportifs.
- En phase de déficit énergétique : jusqu'à 2.3-3.1 g/kg de masse maigre pour préserver la masse musculaire.
- Doses optimales par prise : 0.25-0.40 g/kg, environ 20-40 g par repas.
- Fenêtre anabolique : effets anaboliques jusqu'à au moins 24 h post-exercice.
- Sources : whey, caséine, œuf et bœuf sont les meilleures en termes de leucine.

---

## REF-15 / Helms 2014

```yaml
id: REF-15
auteurs: Helms ER, Aragon AA, Fitschen PJ
annee: 2014
titre: "Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation"
journal: Journal of the International Society of Sports Nutrition
volume_pages: 11(1), 20
doi: 10.1186/1550-2783-11-20
lien: https://doi.org/10.1186/1550-2783-11-20
type_etude: Revue evidence-based
```

**Findings clés** :
- **Vitesse de perte** : 0.5-1 %/semaine du poids corporel.
- **Protéines** : 2.3-3.1 g/kg de masse maigre/jour.
- **Lipides** : 15-30 % des calories totales, jamais < 20 % chez l'homme (préservation testostérone).
- **Glucides** : le reste des calories, pour maximiser la performance à l'entraînement.
- **Réfeeds & diet breaks** : justifiés pour atténuer la chute hormonale (leptine, T3) et la fatigue mentale.
- **Suppléments avec preuves** : créatine monohydrate (3-5 g/jour), caféine, bêta-alanine. Whey utile pour atteindre la cible protéique.
- **Cardio** : à utiliser comme outil ajustable, pas comme base — privilégier le déficit alimentaire.

---

## REF-16 / Aragon 2017 (ISSN)

```yaml
id: REF-16
auteurs: Aragon AA, Schoenfeld BJ, Wildman R, Kleiner S, VanDusseldorp T, Taylor L, Antonio J, et al.
annee: 2017
titre: "International Society of Sports Nutrition Position Stand: diets and body composition"
journal: Journal of the International Society of Sports Nutrition
volume_pages: 14(1), 16
doi: 10.1186/s12970-017-0174-y
lien: https://doi.org/10.1186/s12970-017-0174-y
type_etude: Position stand officielle (ISSN)
```

**Findings clés** :
- Aucune approche diététique n'est universellement supérieure — c'est le déficit calorique et l'adhérence qui priment.
- Les régimes hypocaloriques avec protéines élevées et entraînement en résistance maximisent la rétention de masse maigre.
- Le timing des nutriments a un impact modéré comparé à l'apport total et à la répartition des macros.
- Distribution protéique recommandée : 3-6 prises de 20-40 g espacées de 3-4 h.

---

# Résumé exécutif pour le coach IA

| Sujet | Référence à citer | Pourquoi |
|-------|-------------------|----------|
| Vitesse de perte de poids en sèche athlétique | **Garthe 2011** | Seule étude RCT directe avec athlètes élite |
| Cible protéique en sèche | **Jäger 2017** + **Helms 2014** | Position officielle + bodybuilding naturel |
| Structure complète d'une prep sèche | **Helms 2014** | Revue evidence-based dédiée |
| Stratégie diététique générale | **Aragon 2017** | Position officielle consensus |
| Cardio LISS et oxydation des lipides | **Romijn 1993** | Étude canonique sur le crossover des substrats |
| Formule FCmax | **Tanaka 2001** | Validation méta-analytique |
| Métabolisme de base | **Frankenfield 2005** | Revue systématique des équations prédictives |
| Adaptation métabolique en perte de poids | **Rosenbaum 2010** | Référence sur la thermogenèse adaptative |
