# Module M11 — Body Scanner photo IA

Ce module permet de réaliser une analyse anthropométrique et posturale complète à partir de 4 photos standardisées de la silhouette de l'utilisateur.

## Configuration & Feature Flag

- **Feature Flag** : `feature_body_scanner` (Remote Config Firebase ou variable d'environnement `FEATURE_BODY_SCANNER` / `NEXT_PUBLIC_FEATURE_BODY_SCANNER`).
- **Comportement par défaut** : Désactivé (`false`).

## Fonctionnement technique

1. **Prise de vue standardisée** : L'utilisateur importe ou prend 4 clichés (Face, Dos, Profil Gauche, Profil Droit) guidé par un gabarit de silhouette.
2. **Comparatif de contexte** : L'API `/api/scanner/analyze` cherche le précédent rapport du scanner dans Firestore sous `/users/{uid}/body_scans` pour l'injecter au prompt de Gemini.
3. **Analyse Multimodale Gemini Pro** : Les 4 images sont transmises simultanément au modèle `gemini-2.5-pro` avec un prompt d'analyse morphologique.
4. **Calcul du rapport** :
   - Estimation du taux de masse grasse (Body Fat %).
   - Notes sur la répartition adipeuse et la structure musculaire.
   - Observations d'alignement postural (ex: hyperlordose, cyphose).
   - Identification des asymétries évidentes.
   - Différences comparatives vis-à-vis du dernier scan.
5. **Sauvegarde et affichage** : Le rapport validé est enregistré dans `/users/{uid}/body_scans/{YYYY-MM-DD}` et rendu de manière claire et structurée.

## Règles de Sécurité & Confidentialité

Les photos corporelles sont extrêmement sensibles. Elles ne sont pas envoyées à des tiers en dehors de l'infrastructure Firebase / Google Cloud Vertex AI de l'application et sont soumises à la conformité de suppression RGPD (M23).

## Procédure de Rollback

En cas d'incident technique ou de blocage d'accès aux images :
1. Désactiver le flag `feature_body_scanner` dans la console Firebase.
2. Le module est instantanément verrouillé, et redirige l'utilisateur vers un message d'indisponibilité.
