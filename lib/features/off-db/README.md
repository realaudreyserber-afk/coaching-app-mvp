# Module M6 — Base Alimentaire EU (Cache Firestore)

Ce module fournit l'infrastructure de mise en cache locale Firestore pour les produits alimentaires identifiés via le barcode scanner (M2) ou le photo-to-meal (M1).

## Configuration & Feature Flag

- **Feature Flag** : `feature_off_db` (Remote Config Firebase ou variable d'environnement `FEATURE_OFF_DB` / `NEXT_PUBLIC_FEATURE_OFF_DB`).
- **Comportement par défaut** : Désactivé (`false`).

## Fonctionnement du cache

Le cache est stocké dans la collection Firestore `/content/foods/items/{barcode}`. 
Chaque fois qu'un produit est scanné :
1. Si `feature_off_db` est active, l'API interroge d'abord Firestore pour voir si le document `{barcode}` existe.
2. Si le document existe, il est renvoyé directement (gain de performance et préservation des quotas d'API).
3. Si le document n'existe pas, l'API interroge Open Food Facts, puis enregistre le résultat normalisé dans Firestore avant de le renvoyer.

## Règles de Sécurité Firestore

Les documents du cache sont lisibles et scriptables par tout utilisateur connecté :
```javascript
match /content/foods/items/{itemId} {
  allow read, write: if request.auth != null;
}
```

## Procédure de Rollback

En cas d'anomalie de cache, de corruption des données dans Firestore ou de dépassement des limites de requêtes Firebase :
1. Désactiver le flag `feature_off_db` via Firebase Remote Config.
2. L'API basculera automatiquement sur des requêtes directes vers Open Food Facts sans tenter de lire ou d'écrire dans Firestore.
