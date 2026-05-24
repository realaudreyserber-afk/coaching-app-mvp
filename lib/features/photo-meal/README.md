# Module M1 — Photo-to-meal IA

Ce module permet à l'utilisateur de prendre en photo son repas et de laisser l'IA estimer instantanément la liste des ingrédients, leurs portions et leurs valeurs nutritionnelles complètes.

## Configuration & Feature Flag

- **Feature Flag** : `feature_photo_meal` (Remote Config Firebase ou variable d'environnement `FEATURE_PHOTO_MEAL` / `NEXT_PUBLIC_FEATURE_PHOTO_MEAL`).
- **Comportement par défaut** : Désactivé (`false`).

## Fonctionnement technique de l'analyse

1. **Capture d'image** : L'utilisateur utilise sa caméra ou importe un cliché de son repas depuis la page `/log/photo`.
2. **Transmission de l'image** : L'image est encodée en Base64 côté client puis envoyée à l'API `/api/nutrition/photo-recognize`.
3. **Analyse Gemini Vision** : L'API transmet l'image en `inlineData` avec le prompt de nutrition sportive à `gemini-2.5-flash`.
4. **Validation des données** : Le retour JSON de Gemini est parsé et validé via un schéma Zod ([lib/features/photo-meal/schema.ts](file:///c:/Users/Utilisateur/.gemini/antigravity/scratch/coaching-app-mvp/lib/features/photo-meal/schema.ts)) garantissant la conformité des calories et macronutriments.
5. **Modification & Enregistrement** : L'utilisateur peut modifier les aliments ou leurs portions, ajouter des produits manuellement ou en supprimer.
6. **Enregistrement dans le journal** : Les aliments validés sont enregistrés individuellement dans la sous-collection Firestore `/users/{uid}/food_logs`.

## Procédure de Rollback

En cas d'anomalies critiques sur la reconnaissance d'image (ex: quotas Vertex / Gemini saturés) :
1. Désactiver le flag `feature_photo_meal` via la console Firebase Remote Config.
2. L'accès à la page `/log/photo` sera masqué et bloqué, redirigeant vers un écran d'indisponibilité temporaire sans casser le reste de l'application.
