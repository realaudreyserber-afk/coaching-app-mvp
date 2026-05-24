# Module M16 — Analyse de bilan sanguin

Ce module permet aux utilisateurs d'importer leurs analyses de sang (fichiers PDF ou images) pour extraire leurs biomarqueurs de santé clés et recevoir des conseils hygiéno-diététiques adaptés.

## Fonctionnalités
- Importation de fichiers PDF ou d'images de bilans biologiques.
- Parsing documentaire via Gemini Pro Vision pour extraire la date, les valeurs des marqueurs, les unités et les plages de référence.
- Visualisation claire dans un tableau avec mise en surbrillance des valeurs hors-normes.
- Disclaimers médicaux stricts.
- **Intégration Coach IA** : Les derniers biomarqueurs sont automatiquement injectés dans le prompt du Coach IA pour personnaliser les échanges.

## Rollback / Désactivation
Ce module est isolé et désactivable sans redéploiement via le feature flag `bloodworkUpload`.
Dans `lib/features/flags.ts`, la désactivation du flag redirige les utilisateurs vers un écran d'attente "Module en cours de déploiement" et bloque l'accès à l'API route `/api/bloodwork/analyze`.
