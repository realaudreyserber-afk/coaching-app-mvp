# Go-live checklist — NoDream

> Chronologie minimale pour passer de "code pushed" à "app fonctionnelle en prod".
> Tout ce qui suit nécessite ton action manuelle car protégé par des creds.
>
> **Naming** : "NoDream" (ex-codename "L'Insociable"). Project Firebase ID infra conservé : `linsociable-coaching` — ne pas renommer.

## Étape 1 — Variables d'environnement Vercel (10 min)

1. Ouvre [Vercel dashboard](https://vercel.com/realaudreyserber-1346s-projects/coaching-app-mvp/settings/environment-variables)
2. Mode **Bulk Edit**, colle le contenu de [`.env.vercel.example`](../.env.vercel.example)
3. Remplis chaque valeur (récupère depuis [console Firebase](https://console.firebase.google.com/project/linsociable-coaching/settings/general/))
4. Pour `FIREBASE_ADMIN_PRIVATE_KEY` : depuis [GCP IAM](https://console.cloud.google.com/iam-admin/serviceaccounts?project=linsociable-coaching), génère une nouvelle clé JSON, copie la valeur de `private_key` telle quelle (Vercel UI préserve les retours ligne)
5. Pour `GEMINI_API_KEY` : [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (gratuit jusqu'à 1500 req/jour)
6. Clique **Redeploy** sur le dernier deployment

## Étape 2 — Vérification immédiate

Une fois le redeploy terminé, ouvre :
- `https://<ton-domaine>.vercel.app/api/health` → doit retourner `{"status":"ok"}`
- Si status `degraded`, le payload liste ce qui manque

## Étape 3 — Firebase Functions (auto)

Le déploiement des Cloud Functions est automatisé par **GitHub Actions** (`.github/workflows/firebase-deploy.yml`).

**Action humaine unique** (5 min) :
1. [GCP IAM](https://console.cloud.google.com/iam-admin/serviceaccounts?project=linsociable-coaching) → service account avec roles `Firebase Admin`, `Cloud Functions Developer`, `Cloud Build Editor`
2. Génère une clé JSON, copie le contenu
3. [Settings GitHub repo](https://github.com/realaudreyserber-afk/coaching-app-mvp/settings/secrets/actions) → **New repository secret**
   - Name : `FIREBASE_SERVICE_ACCOUNT`
   - Value : le JSON complet
4. Re-déclenche l'action via [Actions tab](https://github.com/realaudreyserber-afk/coaching-app-mvp/actions) → workflow_dispatch

Une fois ce secret posé, **chaque push sur main qui touche `functions/` redéploie automatiquement**.

## Étape 4 — Stripe (optionnel, pour activer Premium)

1. [Stripe Dashboard](https://dashboard.stripe.com/products) → crée 2 produits (Mensuel, Annuel) avec leurs price IDs
2. Ajoute dans Vercel :
   - `STRIPE_SECRET_KEY` (Dashboard → Developers → API keys → Secret key)
   - `STRIPE_WEBHOOK_SECRET` (Dashboard → Developers → Webhooks → Add endpoint vers `https://europe-west1-linsociable-coaching.cloudfunctions.net/stripeWebhook`)
   - `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_YEARLY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Redeploy Vercel

## Étape 5 — Custom domain (optionnel)

Vercel → Settings → Domains → Add `linsociable.fr` (ou ton domaine), puis DNS A/CNAME selon instructions Vercel.

## Étape 6 — Admin claims (5 min)

Pour accéder à `/admin`, soit :
- **Option A** (simple, env-based) : ajoute ton email dans `ADMIN_EMAILS=foo@bar.com,baz@bar.com`
- **Option B** (recommandée) : custom Firebase claim. Depuis Cloud Shell ou local avec creds :
  ```bash
  node -e "
  const admin = require('firebase-admin');
  admin.initializeApp();
  admin.auth().setCustomUserClaims('TON_UID', { admin: true });
  "
  ```

## Étape 7 — PWA icons ✅ DONE (2026-05-25)

4 PNG livrés dans `public/icons/` :
- `icon-192.png`, `icon-512.png` (purpose any)
- `icon-maskable-192.png`, `icon-maskable-512.png` (safe zone 80%)

Générés depuis `icon-source.png` (1024×1024, monogramme ND) via [scripts/generate-pwa-icons.mjs](../scripts/generate-pwa-icons.mjs). Pour re-générer après update du source : `node scripts/generate-pwa-icons.mjs`.

Originaux source conservés : `icon-source.png` (Flow/Nano Banana export) + `icon-source.jpeg` + SVG legacy (`icon.svg`, `icon-maskable.svg`).

## Validation finale

```bash
# Local
npm run verify:env    # vérifie les .env.local
npm run build         # doit compiler sans erreur
npm run test          # 81/81 ✓

# Prod
curl https://<ton-domaine>.vercel.app/api/health
# attendu : {"status":"ok","checks":{...}}
```

## Étape 8 — Domaines NoDream (à vérifier humainement)

Vérifier dispo + acheter sur registrar (Gandi, OVH, Namecheap) :
- `nodream.app` (premium TLD, ~14€/an, prio si app mobile)
- `nodream.com` (référence universelle, ~12€/an)
- `nodream.fr` (cible FR, ~7€/an)
- `nodream.coach` (niche, optionnel)

Vérifier conflits marque sur [data.inpi.fr/marques](https://data.inpi.fr/marques) classes 5 (compléments), 41 (coaching), 44 (services bien-être).

## Si quelque chose casse

- **Build Vercel fail** : Vercel → Deployments → log. Probable peer dep → vérifie que `installCommand` dans `vercel.json` reste `npm install --legacy-peer-deps`
- **Auth fail** : ouvre `/api/health`, vérifie les services configurés
- **Functions fail** : [Cloud Functions logs](https://console.cloud.google.com/functions/list?project=linsociable-coaching)
- **Stripe webhook fail** : Dashboard Stripe → Webhooks → ton endpoint → "Recent attempts"

## Architecture déployée

```
GitHub push to main
        │
        ├─► Vercel (auto)
        │     - fra1 (EU)
        │     - Next.js front + /api/* serverless
        │     - vercel.json: 1GB memory, 60s timeout for AI routes
        │
        └─► GitHub Action (auto si FIREBASE_SERVICE_ACCOUNT secret posé)
              firebase deploy --only firestore:rules,firestore:indexes,storage:rules,functions
                    - Cloud Functions Gen 2 europe-west1
                    - Firestore rules + indexes
                    - Storage rules
```
