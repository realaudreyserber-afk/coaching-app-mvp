# Module M19 — Smart FCM Notifications

Ce module permet d'envoyer des notifications push intelligentes et hautement personnalisées aux utilisateurs en utilisant Firebase Cloud Messaging et Gemini Flash.

## Fonctionnalités
- Enregistrement des jetons de souscription FCM client (Service Worker local dans `public/firebase-messaging-sw.js`).
- Sauvegarde persistante des jetons FCM sous `/users/{uid}/fcm_tokens`.
- Générateur IA `generator.ts` qui rédige dynamiquement le message avec l'avatar NoDream selon le contexte (bilan manquant, motivation, records).
- Endpoint `/api/notifications/send-smart` déclenchable par cron/webhook pour envoyer le message via `firebase-admin/messaging`.

## Rollback / Désactivation
Ce module est isolé et désactivable sans redéploiement via le feature flag `smartNotifs`.
Dans `lib/features/flags.ts`, la désactivation du flag bloque les inscriptions de jetons et les API routes d'envoi.
