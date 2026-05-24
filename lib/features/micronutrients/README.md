# Module M15 — Micronutriments

Ce module permet aux utilisateurs de suivre 14 micronutriments (vitamines et minéraux essentiels) à partir de leur journal de repas quotidien.

## Fonctionnalités
- Tableau de bord des micronutriments avec barres de progression colorées comparant les apports réels aux AJR (Apports Journaliers Recommandés).
- Calcul précis via une table de référence locale (USDA/Ciqual pour 50+ aliments courants) couplée aux nutriments réels de l'API Open Food Facts.
- **Zéro estimation IA** pour éviter les hallucinations et garantir des données factuelles rigoureuses.
- Alertes automatiques de carences basées sur un seuil (<70% des AJR cumulés sur 7 jours) et propositions de sources alimentaires riches (sans promouvoir de suppléments artificiels).

## Rollback / Désactivation
Ce module est isolé et désactivable sans redéploiement via le feature flag `micronutrients`.
Dans `lib/features/flags.ts`, la désactivation du flag redirige les utilisateurs vers un écran d'attente "Module en cours de déploiement" et masque l'onglet ou le bouton d'accès sur le Dashboard / Progression.
