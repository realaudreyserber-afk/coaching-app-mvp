# Module M7, M24 & M25 — Hub Wearables & Mobile Health

Ce module unifie la synchronisation des données d'activité physique (pas, dépenses caloriques) à partir d'appareils et applications connectées.

## Fonctionnalités
- Flux d'autorisation OAuth 2.0 complet vers Google Fit pour l'application Web.
- Route de callback sécurisée qui stocke les jetons chiffrés dans Firestore sous la collection `/users/{uid}/tokens/google-fit`.
- Synchronisation incrémentale journalière interrogeant l'API REST Google Fit.
- Wrapper multiplateforme `lib/platform/health.ts` incluant des stubs natifs Android Health Connect (M24) et iOS HealthKit (M25) en préparation de l'exportation mobile de l'application via Capacitor.

## Rollback / Désactivation
Ce module est isolé et désactivable sans redéploiement via le feature flag `wearables`.
Dans `lib/features/flags.ts`, la désactivation du flag masque l'onglet de synchronisation et l'écran de réglages associés.
