# Module M8 — TDEE Adaptatif (Calculateur Dynamique)

Ce module permet d'estimer le TDEE (Total Daily Energy Expenditure) réel de l'utilisateur de manière dynamique, similaire à l'approche de MacroFactor, en analysant la relation entre l'apport calorique et l'évolution du poids.

## Configuration & Feature Flag

- **Feature Flag** : `feature_tdee_adaptive` (Remote Config Firebase ou variable d'environnement `FEATURE_TDEE_ADAPTIVE` / `NEXT_PUBLIC_FEATURE_TDEE_ADAPTIVE`).
- **Comportement par défaut** : Désactivé (`false`).

## Fonctionnement de l'algorithme

Plutôt que d'utiliser de simples formules théoriques (Mifflin-St Jeor) basées uniquement sur le sexe, l'âge et le poids, ce module calcule une régression linéaire sur une fenêtre glissante de 14 jours :
1. **Évolution du poids** : La pente de la régression linéaire sur les pesées des 14 derniers jours détermine la vitesse réelle de variation du poids ($\text{kg/jour}$).
2. **Apport calorique** : Calcule la moyenne quotidienne des calories réellement consommées (somme des `food_logs` ou estimation à partir de l'adhérence nutritionnelle du check-in quotidien).
3. **Conversion énergétique** : On estime que 1 kg de masse corporelle équivaut à environ 7700 kcal.
4. **Calcul final** :
   $$\text{TDEE adaptatif} = \text{Calories quotidiennes moyennes} - (\text{Pente du poids} \times 7700)$$

## Prérequis de calcul

Le calcul nécessite au moins **5 jours** de données (pesée + calorie) sur la période de 14 jours. En dessous de ce seuil, l'algorithme renvoie le TDEE théorique calculé lors de l'onboarding.

## Intégration API & Tâche récurrente

- **Endpoint** : `POST /api/user/tdee-recalc` (sécurisé, nécessite authentification).
- L'appel recalcule le TDEE adaptatif, met à jour le profil de l'utilisateur (`profile.tdee_adaptive` et `goals.tdee_adaptive`), et logge l'historique dans `/users/{uid}/tdee_history/{date}`.

## Procédure de Rollback

En cas d'instabilité ou d'anomalies de calcul :
1. Désactiver le flag `feature_tdee_adaptive` via Remote Config.
2. Le système réutilisera immédiatement le TDEE théorique ou la valeur cible fixe par défaut du plan pour toutes les recommandations énergétiques et l'affichage du Dashboard.
