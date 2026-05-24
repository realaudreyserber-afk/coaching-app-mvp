# Module M18 — Streak factuel

Ce module calcule la régularité d'un utilisateur sous forme d'un compteur de jours consécutifs de check-ins quotidiens réussis. L'affichage est délibérément sobre et factuel ("47 jours de régularité").

## Structure Firestore

Les streaks sont calculés et mis à jour sur le document utilisateur :

`users/{uid}`
```json
{
  "streak": {
    "current": 14,
    "longest": 32,
    "lastCheckinDate": "2026-05-24"
  }
}
```

## Rollback

Désactiver le flag `feature_streak` dans Firebase Remote Config. Le compteur de régularité disparaîtra instantanément du Dashboard.
