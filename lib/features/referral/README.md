# Module M17 — Système de parrainage

Ce module récompense l'engagement viral en offrant un mois Premium gratuit au parrain et au filleul lors de l'activation d'un code.

## Fonctionnalités
- Attribution automatique d'un code de parrainage unique à 6 caractères (`INSXXX`) à chaque utilisateur.
- Enregistrement des parrainages par transactions sécurisées pour éviter les fraudes et doubles attributions.
- Crédits Premium cumulables affichés dans le carnet de l'utilisateur.

## Rollback / Désactivation
Ce module est isolé et désactivable sans redéploiement via le feature flag `referral`.
Dans `lib/features/flags.ts`, la désactivation du flag masque l'onglet de parrainage dans les Réglages.
