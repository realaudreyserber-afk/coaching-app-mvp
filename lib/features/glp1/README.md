# Module M4 — GLP-1 Medication Tracking

Ce module permet aux utilisateurs sous traitement GLP-1 (Ozempic, Wegovy, Mounjaro, Saxenda, etc.) de suivre leur médication et d'adapter automatiquement les recommandations du Coach IA et du plan nutritionnel en conséquence.

## Configuration & Feature Flag

- **Feature Flag** : `feature_glp1` (Remote Config Firebase ou variable d'environnement `FEATURE_GLP1` / `NEXT_PUBLIC_FEATURE_GLP1`).
- **Comportement par défaut** : Désactivé (`false`).

## Fonctionnement technique

1. **Saisie utilisateur** : L'utilisateur configure son traitement dans l'écran de Paramètres ([app/(app)/settings/page.tsx](file:///c:/Users/Utilisateur/.gemini/antigravity/scratch/coaching-app-mvp/app/(app)/settings/page.tsx)) : Molécule, dose, fréquence, date de début, et effets secondaires.
2. **Persistance** : Les données sont enregistrées dans le document `/users/{uid}/medications/glp1`.
3. **Adaptation Coach IA** : Si le traitement est actif, la route `/api/ai/coach` injecte automatiquement des règles d'adaptation métabolique et de sécurité au Coach "L'Insociable" :
   - Risque majeur de perte musculaire : incitation à hausser l'apport protéique de +20%.
   - Focus sur l'entraînement de résistance musculaire.
   - Conseils de nutrition adaptés en cas d'effets secondaires comme des nausées.
   - Ajout systématique du disclaimer médical.

## Règles de Sécurité

Le coach rappelle systématiquement que ses conseils ne constituent pas une prescription médicale et qu'il est impératif de consulter son médecin prescripteur en cas de doute clinique.

## Procédure de Rollback

En cas d'alerte réglementaire ou médicale concernant le suivi des traitements par l'IA :
1. Désactiver le flag `feature_glp1` dans Firebase.
2. La section "Suivi GLP-1" disparaît instantanément des paramètres, et le Coach cesse d'intégrer les règles de traitement dans ses instructions système.
