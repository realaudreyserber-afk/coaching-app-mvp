# Module M12 — Form check vidéo

Ce module permet aux utilisateurs de soumettre des vidéos d'exécution de leurs exercices (max 30s) pour recevoir une analyse biomécanique automatisée par Gemini Vision.

## Fonctionnalités
- Envoi de vidéo brute au format base64 à Gemini (via l'API unifiée).
- Détection automatique de l'exercice et notation (score de 1 à 10).
- Recommandations anatomiques de placement, vitesse, trajectoire et alertes de sécurité en cas de mauvaise exécution.
- Disclaimer d'avertissement limitant les risques juridiques.

## Rollback / Désactivation
Ce module est isolé et désactivable sans redéploiement via le feature flag `formCheck`. 
Dans `lib/features/flags.ts`, la désactivation du flag redirige les utilisateurs vers un écran d'attente "Module en cours de déploiement" et bloque l'accès à la route d'API `/api/exercise/form-check` en renvoyant une erreur 403.
