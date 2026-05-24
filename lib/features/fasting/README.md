# Module M5 — Jeûne Intermittent

Ce module permet de suivre un protocole de jeûne intermittent (16:8, 18:6, 20:4, OMAD ou personnalisé) avec l'affichage d'un minuteur d'état en temps réel sur le Dashboard de l'utilisateur.

## Configuration Firestore

Les données de jeûne sont stockées dans le document utilisateur :

`users/{uid}`
```json
{
  "fasting_protocol": {
    "type": "16:8",
    "eating_window_start": "12:00",
    "eating_window_end": "20:00",
    "days_active": [0, 1, 2, 3, 4, 5, 6],
    "active": true
  }
}
```

## Rollback

Pour désactiver ce module en production :
1. Positionner le feature flag `feature_fasting` à `false` via la console Firebase Remote Config.
2. Le minuteur disparaîtra instantanément de l'interface utilisateur.
