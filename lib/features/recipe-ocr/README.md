# Module M14 — Import recette + OCR

Ce module permet aux utilisateurs d'importer des recettes à partir de photos de livres de cuisine, de captures d'écran ou de sites web en utilisant Gemini Vision.

## Fonctionnalités
- Import de photos de recettes (formats JPG/PNG).
- Extraction automatique du titre, portions, ingrédients avec macros et instructions.
- Éditeur client interactif pour modifier la recette extraite (titre, portions, ingrédients) avant d'enregistrer.
- Sauvegarde persistante dans Firestore sous `/users/{uid}/recipes`.
- Possibilité de loguer une portion de la recette directement dans le journal de nutrition quotidien.

## Rollback / Désactivation
Ce module est isolé et désactivable sans redéploiement via le feature flag `recipeOcr`.
Dans `lib/features/flags.ts`, la désactivation du flag redirige les utilisateurs vers un écran d'attente "Module en cours de déploiement" et bloque l'accès à la route d'API `/api/nutrition/recipe-ocr` en renvoyant une erreur 403.
