# Module M22 — Framework A/B Testing

Ce module permet de segmenter les utilisateurs dans des tests expérimentaux A/B de manière 100% déterministe et de mesurer les conversions (Premium, bilans complétés).

## Fonctionnalités
- Segmentation par hachage d'identifiant unique (algorithme djb2) combinant l'UID de l'utilisateur et l'ID de l'expérience, assurant une affectation stable côté client et serveur.
- Traçage d'exposition (`logExperimentExposure`) stockant la variante active sous `users/{uid}/experiments/{experimentId}`.
- Traçage de conversion (`logExperimentConversion`) qualifiant la réussite de l'expérience.

## Rollback / Désactivation
Ce module est isolé et désactivable sans redéploiement via le feature flag `abFramework`.
Dans `lib/features/flags.ts`, la désactivation du flag retourne par défaut le premier variant (Index 0 / Variant A) sans enregistrer d'exposition.
