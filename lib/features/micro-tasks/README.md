# Module M13 — Micro-tâches comportementales daily

Ce module propose une micro-tâche quotidienne non-infantilisante et factuelle à l'utilisateur depuis son Dashboard, adaptée à son profil (ex: hydratation sous GLP-1, marche active pour High BF).

## Structure Firestore

Les complétions de tâches quotidiennes sont stockées sous :

`/users/{uid}/daily_tasks/{dateStr}`
```json
{
  "taskId": "nut_weigh_eye",
  "completed": true,
  "completedAt": "2026-05-24T08:30:00.000Z"
}
```

## Rollback

Désactiver le flag `feature_micro_tasks` dans Firebase Remote Config. Le widget de tâche quotidienne disparaîtra instantanément du Dashboard.
