# Module M3 — Voice Logging

Ce module permet à l'utilisateur de dicter vocalement son repas pour que l'IA en extraie automatiquement la liste des aliments, portions et valeurs nutritionnelles.

## Configuration & Feature Flag

- **Feature Flag** : `feature_voice_log` (Remote Config Firebase ou variable d'environnement `FEATURE_VOICE_LOG` / `NEXT_PUBLIC_FEATURE_VOICE_LOG`).
- **Comportement par défaut** : Désactivé (`false`).

## Fonctionnement technique de la dictée

1. **Bouton Micro** : Intégré dans la barre supérieure ([components/navigation/top-bar.tsx](file:///c:/Users/Utilisateur/.gemini/antigravity/scratch/coaching-app-mvp/components/navigation/top-bar.tsx)), il apparaît si `feature_voice_log` est actif.
2. **Capture Audio** : Ouvre un modal ([components/features/voice-log/VoiceRecordModal.tsx](file:///c:/Users/Utilisateur/.gemini/antigravity/scratch/coaching-app-mvp/components/features/voice-log/VoiceRecordModal.tsx)) demandant la permission du micro et enregistre la voix via l'API standard `MediaRecorder` au format WebM.
3. **Analyse Multimodale Native** : L'API transmet le fichier audio encodé directement à **Gemini 2.5 Flash** (via `/api/nutrition/voice-recognize`), évitant ainsi d'utiliser un service tiers de Speech-to-Text puis un parseur. Gemini Flash transcrit et structure en une seule opération.
4. **Validation et Journalisation** : Les aliments reconnus sont affichés dans une liste éditable. Après confirmation, les aliments sont injectés dans `/users/{uid}/food_logs`.

## Procédure de Rollback

En cas d'erreur de décodage audio ou de latence réseau excessive :
1. Désactiver le flag `feature_voice_log` dans Firebase.
2. Le bouton micro disparaît immédiatement de la `TopBar` pour tous les utilisateurs.
