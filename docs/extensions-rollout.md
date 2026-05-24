# Extensions rollout playbook

> Plan d'activation progressive des 25 modules V1 en production.
> Acceptance criterion §8.3 du brief V2.

## Principe

Tous les flags Remote Config sont **par défaut OFF**. L'activation se fait :
1. Pour 1% des utilisateurs (canary) pendant 48-72h
2. Lecture du dashboard admin + Sentry → vérifier absence d'erreurs runtime
3. Élargissement à 10%, puis 50%, puis 100% par paliers de 48h
4. Si KPI baisse de +3pt sur Lighthouse ou +5% erreurs → rollback immédiat

## Ordre d'activation recommandé

| Vague | Modules | Pré-requis | Critère succès | Rollback |
|---|---|---|---|---|
| **V1** Polish | M18 streak | aucun | DAU stable, pas d'erreur | flag `false` |
| **V1** Polish | M13 micro-tasks | aucun | engagement micro-task > 30% | flag `false` |
| **V1** Polish | M23 RGPD self-service | aucun | 100% des delete OK, 0 fuite | route 404 visible |
| **V2** Tracking | M2 barcode | OFF base partielle OK | scans / DAU > 0.5 | flag `false`, logs intacts |
| **V2** Tracking | M1 photo-meal | Vertex AI Vision quotas OK | photos / DAU > 0.3 | flag `false` |
| **V2** Tracking | M5 fasting | aucun | activation rate ≥ 15% | flag `false`, doc préservé |
| **V3** Coaching | M10 profile paths | Plan generator stable | retention J7 cohorte high-bf > standard | revert profile_path lecture |
| **V3** Coaching | M9 RAG sourcing | CSE FR + PubMed key | sources cliquées / message > 5% | flag `false`, prompt revert |
| **V3** Coaching | M19 smart notifs | FCM tokens collectés | open rate notif > 12% | cron disabled, logs préservés |
| **V4** Payant | M20 Stripe portail | Stripe live keys + webhooks OK | tier upgrade rate > baseline | flag `false`, customers intacts |
| **V4** Payant | M17 référral | M20 actif | viral coefficient k > 0.15 | flag `false`, codes préservés |
| **V5** Vidéo | M11 body scanner | 4-photo capture mobile OK | scans / mois Premium > 2 | flag `false` |
| **V5** Vidéo | M12 form check | Vertex Vision vidéo OK | uses / mois Premium > 1 | flag `false`, quota respecté |
| **V6** Pro | M16 bloodwork | Disclaimer médical en place | uploads / Premium > 0.5 | flag `false`, docs persistés |
| **V6** Pro | M4 GLP-1 tracking | Safety layer testé | déclarations / Premium > 5% | flag `false`, medical.glp1 intact |
| **V7** Mesure | M8 TDEE adaptif | 14+ jours de checkins | écart vs Mifflin documenté | flag `false`, fallback theoretical |
| **V7** Mesure | M7 wearables Google Fit | OAuth credentials OK | connections / Premium > 20% | flag `false`, tokens conservés |
| **V8** Tooling | M21 admin dashboard | Service account BigQuery OK | dashboard < 3s p95 | URL non listée |
| **V8** Tooling | M22 A/B framework | M21 actif | 1 test live | tous experiments `active: false` |
| **V9** Avancé | M14 recipe OCR | M1 photo-meal stable | uses / mois Premium > 1 | flag `false` |
| **V9** Avancé | M15 micronutriments | M6 OFF enrichi 30j | dashboard ouvert > 5% sessions | flag `false` |
| **V9** Avancé | M3 voice log | Cloud STT quotas | uses / mois Premium > 3 | flag `false` |
| **V10** Mobile | M24 Health Connect Android | Wrap Capacitor V2 | sync rate > 70% | wrapper stub revert |
| **V10** Mobile | M25 HealthKit iOS | Wrap Capacitor V2 + Apple Dev | idem | idem |
| **V11** Volume | M6 OFF base full | 500k produits ingérés | barcode hit rate > 85% | cron paused, cache only |

## Hypothèses A/B testables (M22)

### A/B-001 — Prix annuel
- **Hypothèse** : un prix annuel 179€ (-30% vs mensuel × 12) génère plus de revenu par utilisateur que 149€ (-42%) ou 199€ (-22%)
- **Variantes** : `pricing_yearly_179` / `pricing_yearly_149` / `pricing_yearly_199`
- **Métrique** : revenu net mensualisé par exposé (LTV-12m)
- **Sample size** : 1000 exposés / variante (puissance 80%, MDE 8%)
- **Durée** : 60 jours
- **Décision** : retient le ARPU max si écart > 5%

### A/B-002 — Onboarding step 11 — message d'attente Gemini
- **Hypothèse** : narrer la génération (steps progressifs visibles) augmente le taux de complétion vs spinner unique
- **Variantes** : `narrative` / `spinner_only`
- **Métrique** : completion rate étape 11
- **Sample size** : 500 / variante
- **Durée** : 14 jours

### A/B-003 — Notif check-in du soir : 19h vs 20h vs 21h
- **Variantes** : 3 valeurs `hour_local` dans le template `checkin_evening`
- **Métrique** : open rate notif + check-in completion dans les 2h
- **Sample size** : 800 / variante
- **Durée** : 21 jours

### A/B-004 — Streak format affichage
- **Hypothèse** : afficher `47 jours` (factuel) plus efficace que `🔥 47 jours` (gamifié) pour adhésion long terme
- **Variantes** : `plain` / `emoji`
- **Métrique** : streak_average après 30 jours
- **Sample size** : 1500 / variante
- **Durée** : 60 jours

### A/B-005 — Coach IA streaming SSE vs response one-shot
- **Hypothèse** : streaming améliore perçu de réactivité (réduction abandon mid-attente)
- **Variantes** : `sse` / `oneshot`
- **Métrique** : message_completion_rate (% messages où le user reste jusqu'au done)
- **Sample size** : 600 / variante
- **Durée** : 14 jours

## Métriques à surveiller (dashboard admin)

### Santé runtime
- /api/health `status: ok` checks 60s (uptime > 99.5%)
- Sentry erreur rate < 0.5% des requêtes
- Vertex AI quota usage < 80% du daily cap
- Stripe webhook success rate > 99%

### Engagement
- DAU / WAU / MAU ratios (stickiness)
- Funnel onboarding : signup → step 11 → first checkin (target > 60%)
- Retention par cohorte d'inscription (J1, J7, J30)
- % users actifs sur plus de 5 sessions / semaine

### Économique
- Conversion free → premium (target > 3% sur 30j post-signup)
- ARPU (premium MRR / total users premium)
- Churn mensuel (target < 7%)
- LTV / CAC ratio (target > 3)

### Safety (CRITIQUE)
- # alertes TCA déclenchées / mois
- # alertes EXTREME_LOSS / mois
- # blocages onboarding pour IMC < 18.5
- # mention 3114 dans le coach
- Aucun de ces compteurs ne doit baisser à 0 par bug, à surveiller activement

## Procédure rollback générique

```bash
# 1. Désactiver le flag en console Remote Config
#    (effet immédiat client après cache TTL 5min)

# 2. Vérifier que le module ne fuit pas via une autre voie
curl https://coaching-app-mvp.vercel.app/api/health

# 3. Si données corrompues écrites pendant la fenêtre buggée :
firebase firestore:delete users/{uid}/<collection> --shallow  # à user

# 4. Communiquer aux users affectés via FCM ciblée
```

## Modules à NE PAS rollback automatiquement

- **M23 RGPD** : un rollback empêcherait export/delete → violation Article 17. Maintenir actif quoi qu'il arrive.
- **M18 streak** : juste un compteur read-only, pas de risque de corruption.
- **Safety layer (déjà MVP)** : jamais désactiver.

## Gates de promotion entre vagues

Une vague ne passe à la suivante que si :
1. Aucun incident SEV-1 (impact > 5% users) dans les 48h précédentes
2. Sentry error rate < 0.5% sur les routes touchées
3. KPI principal du module ≥ seuil défini
4. Documentation `lib/features/<module>/README.md` à jour
5. Tests E2E Playwright passent à 100% dans la CI Vercel
