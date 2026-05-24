# NoDream — Actions restantes (2026-05-25)

> État instantané post-pivot NoDream. À jour vs production réelle vérifiée via `/api/health`.

## ✅ Déjà fait (autonome ou utilisateur)

| Item | État | Détail |
|---|---|---|
| Vercel env vars | ✅ | Vérifié via `/api/health` : firebase_client, firebase_admin, vertex_ai tous configurés |
| Gemini API key | ✅ | Coach prod fonctionne |
| PWA icons (4 PNG) | ✅ | `public/icons/icon-{192,512}.png` + maskable variants. Script `scripts/generate-pwa-icons.mjs` réutilisable |
| Manifest NoDream | ✅ | `public/manifest.json` : name, theme #0a0a0a, 4 icons pointed |
| Rebranding code/UI | ✅ | 15 fichiers patchés (layout metadata, login, coach, top-bar, prompts LLM, service worker, tests, READMEs) |
| Firestore rules | ✅ | Déployées via `firebase deploy --only firestore:rules` |
| Firestore indexes | ✅ | 8 composites déployés |
| Storage rules | ✅ | Déployées en même temps |
| Tests unitaires | ✅ | 144/144 passants (Vitest) |
| Build prod | ✅ | exit 0, 49 pages générées, 0 erreur TS |
| Vérif domaines | ✅ | DNS check (voir tableau Domaines) |

## 🟠 Action humaine — Cloud Functions API GCP (5 min)

**Bloquant pour crons nocturnes** (alerts, TDEE-recalc, smart-notifs, wearable-sync, nightly-analysis, stripe-webhook).

1. Ouvre : https://console.developers.google.com/apis/api/cloudfunctions.googleapis.com/overview?project=linsociable-coaching
2. Clique **ENABLE**
3. Attends 1-2 min de propagation
4. Active aussi : Cloud Build API, Eventarc API, Pub/Sub API (mêmes URL en remplaçant `cloudfunctions` par `cloudbuild`, `eventarc`, `pubsub`)
5. Reviens ici, je lancerai `firebase deploy --only functions`

## 🟠 Action humaine — Domaines (15 min)

État vérifié 2026-05-25 :

| Domaine | État | Source |
|---|---|---|
| `nodream.com` | 🔴 PRIS depuis 2000, registrar CNOBIN (Chine), expire fév 2027 | RDAP Verisign |
| `nodream.fr` | 🟢 Probablement LIBRE | RDAP nic.fr 404 |
| `nodream.app` | 🟢 Probablement LIBRE | DNS NXDOMAIN |
| `nodream.io` | 🟢 Probablement LIBRE | DNS NXDOMAIN |
| `nodream.coach` | 🟢 Probablement LIBRE | DNS NXDOMAIN |
| `nodream.fit` | 🟢 Probablement LIBRE | DNS NXDOMAIN |

**À acheter en priorité** :
- `nodream.app` (~14€/an, premium TLD adapté à une PWA)
- `nodream.fr` (~7€/an, cible francophone)
- Pour `.com` : si tu y tiens, écris au registrar CNOBIN pour faire une offre (probablement 500-5000€)

Registrars conseillés : [Namecheap](https://www.namecheap.com), [Gandi](https://www.gandi.net/fr), [OVH](https://www.ovh.com/fr/domaines/)

Une fois acheté → Vercel → Settings → Domains → Add domain → suivre instructions DNS.

## 🟠 Action humaine — INPI marque (10 min)

WebFetch automatique bloqué par INPI (403). À faire manuellement :

1. Ouvre [data.inpi.fr/marques](https://data.inpi.fr/marques)
2. Cherche : `NoDream`, `Nodream`, `No Dream`, `NODREAM`
3. Vérifie classes Nice à risque : **5** (compléments), **9** (apps), **41** (coaching), **42** (SaaS), **44** (santé/bien-être)
4. Si rien dans ces classes → tu peux déposer ta marque NoDream (~200€ via INPI direct)

WebSearch a confirmé : aucun NoDream visible dans le créneau fitness/coaching/nutrition en ligne. Terrain a priori libre.

## 🟠 Action humaine — Stripe (15 min, OPTIONNEL MVP)

Pas bloquant. Skippe si tu lances en gratuit.

1. [Stripe Dashboard mode TEST](https://dashboard.stripe.com/test/products) → Create 2 products :
   - "NoDream Premium" Monthly 19,90€ → note `price_...`
   - "NoDream Premium Annuel" Yearly 179€ → note `price_...`
2. [API keys](https://dashboard.stripe.com/test/apikeys) → copie `pk_test_...` et `sk_test_...`
3. [Webhooks](https://dashboard.stripe.com/test/webhooks) → Add endpoint :
   - URL : `https://europe-west1-linsociable-coaching.cloudfunctions.net/stripeWebhook` (après deploy Functions)
   - Events : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Note le `whsec_...`
4. Vercel env vars (Bulk Edit) :
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_ID_MONTHLY=price_...
   STRIPE_PRICE_ID_YEARLY=price_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
5. Redeploy Vercel

## 🟡 Tests E2E à investiguer (low priority)

`npm run test:e2e` a sorti 25 fails. Probablement liés au setup local (dev server timeout au démarrage, mock-auth flow), pas au code prod (qui est UP et fonctionne). À regarder quand tu auras 30 min — peut être qu'un sélecteur a divergé après le rebranding.

## 🟢 Validation post-actions

Une fois Cloud Functions deployées, vérifie :

```bash
# Health
curl https://coaching-app-mvp.vercel.app/api/health
# stripe.configured doit être true si Stripe fait

# Functions listées
firebase functions:list --project linsociable-coaching
# doit lister : nightlyAnalysis, alertsMonitor, dataExportPurge, etc. (10 functions)

# Tests local (sanity)
npm run test            # 144/144
npm run build           # exit 0
```

## 📞 Si bloqué

Reviens vers moi avec :
- Capture/lien de l'erreur
- L'étape sur laquelle tu bloques (numérotée)
- L'output du dernier `firebase deploy` ou `gcloud` si applicable
