# Module M2 — Barcode Scanner

Ce module permet de scanner le code-barres de n'importe quel produit alimentaire et d'interroger la base de données Open Food Facts.

## Configuration & Feature Flag

- **Feature Flag** : `feature_barcode` (Remote Config Firebase ou variable d'environnement `FEATURE_BARCODE` / `NEXT_PUBLIC_FEATURE_BARCODE`).
- **Comportement par défaut** : Désactivé (`false`).

## Dépendances externes

- **Open Food Facts API** : Base de données collaborative et ouverte pour les produits alimentaires. L'URL de base est configurée par `OPENFOODFACTS_API_BASE` (par défaut `https://world.openfoodfacts.org`).
- **Caméra & PWA** : `@zxing/browser` pour la détection en direct et le décodage vidéo du code-barres dans le navigateur (WebView Android / iOS PWA compatible).

## Parcours Utilisateur

1. L'utilisateur clique sur "Scanner un produit" depuis son journal de bord.
2. Demande de permission de la caméra.
   - En cas d'autorisation : Le flux vidéo s'ouvre, avec un overlay d'aide au ciblage et une animation laser.
   - En cas de refus ou d'absence de caméra : Bascule automatique vers le mode saisie manuelle.
3. Détection et décodage du code-barres.
4. Recherche du produit via `/api/nutrition/barcode?code=...` (avec mise en cache Firestore optionnelle si `feature_off_db` est active).
5. Affichage d'une fiche produit complète (Nom, Marque, Kcal, Protéines, Glucides, Lipides, Nutri-Score, NOVA et Allergènes).
6. Ajustement de la portion via un slider (de 10g à 500g) recalculant en temps réel les calories et macros.
7. Validation et enregistrement de l'aliment dans la sous-collection Firestore `users/{uid}/food_logs`.

## Procédure de Rollback

En cas d'anomalie critique sur le scanner (ex: problème de compatibilité WebView) ou sur l'API Open Food Facts :
1. Désactiver le flag `feature_barcode` via la console Firebase Remote Config (passer à `false`).
2. Aucun redéploiement n'est nécessaire. L'écran redirigera instantanément vers le message de indisponibilité temporaire et cachera le bouton d'accès.
