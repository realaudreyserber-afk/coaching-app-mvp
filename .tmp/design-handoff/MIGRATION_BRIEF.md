# NoDream — Migration Brief (Stitch → Code)

**Source designs** : `.tmp/stitch/*.jpg` (18 écrans, Stitch project `9144321799519106771`)
**Target** : `coaching-app-mvp` (Next.js 16 + React 19 + Tailwind v4 + Firebase)
**Design system** : `DESIGN.md` uploadé sur Stitch (assetId `437e3b2da7d24c42bf0b344284ec5981`)
**Date** : 2026-05-25

---

## 0. Constat brut avant exécution

Les designs Stitch sont **à 70 % alignés** avec DESIGN.md, **30 % à corriger pendant la migration**. Stitch a généré un look magazine premium cohérent mais a partiellement ignoré certaines règles strictes :

| Règle DESIGN.md | Respect Stitch | Action migration |
|---|---|---|
| FR exclusif | ❌ Dashboard, Plan, Workout Summary, Settings encore en EN | Traduire à l'écriture |
| Métrique kg/cm | ❌ Dashboard mobile en lbs | Forcer kg |
| Bulles chat blanches | ❌ Stitch a gardé dark-on-dark | Forcer `bg-white` |
| Palette noir/gold | ✅ | — |
| Pas d'emoji | ✅ | — |
| Photos éditoriales N&B | ✅ Onboarding + Training Level | — |
| Citations sources visibles | ✅ Coach avec sources cards | — |
| Pas de mono-colonne desktop | ✅ Grids 2-3 colonnes partout | — |

**Conséquence** : on n'écrit pas le code « comme Stitch a généré », on écrit le code qui respecte DESIGN.md **en s'inspirant du layout Stitch**.

---

## 1. Token mapping (Stitch → Tailwind v4 + CSS vars)

### Palette

| Sémantique | Stitch hex | Tailwind utility | CSS var (globals.css) |
|---|---|---|---|
| Page background | `#0a0a0a` | `bg-zinc-950` | `--background` |
| Surface lift faible (header/input bar/nav) | `#18181b` | `bg-zinc-900` | — |
| Surface lift fort (cards) | `#27272a` | `bg-zinc-800` | `bg-card` *(reste #141414, à aligner)* |
| Border subtle | `#27272a` | `border-zinc-800` | `--border` *(actuel #2a2a2a — proche)* |
| Border strong | `#3f3f46` | `border-zinc-700` | — |
| **Bulle chat assistant** | `#ffffff` | `bg-white` | — *(jamais `bg-card`)* |
| Bulle chat user | `#f59e0b` | `bg-amber-500` | — |
| Accent gold primary | `#d4a017` | `bg-primary` ou `bg-amber-600` | `--primary` |
| Accent gold light | `#f59e0b` / `#fbbf24` | `text-amber-500` / `text-amber-400` | — |
| Texte body sur noir | `#fafafa` | `text-zinc-50` | `--foreground` |
| Texte muted | `#a1a1aa` | `text-zinc-400` | `--muted-foreground` |
| Erreur bg/text | `#450a0a` / `#fca5a5` | `bg-red-950/40` / `text-red-300` | — |
| Succès bg/text | `#052e16` / `#6ee7b7` | `bg-emerald-950/40` / `text-emerald-300` | — |
| Focus ring | `#f5c640` | `ring-amber-400` ou `ring-ring` | `--ring` |

### Typographie

| Token | Stack | Usage |
|---|---|---|
| `font-serif` | Fraunces, Georgia | Titres h1-h3, hero |
| `font-sans` | Geist Sans | Body, labels, UI |
| `font-mono` | Geist Mono | Code inline, valeurs numériques tabulaires |

### Échelle typographique

| Token | Taille / weight | Usage |
|---|---|---|
| `text-4xl font-bold font-serif` | 36px / 700 | Page title desktop |
| `text-3xl font-bold font-serif` | 30px / 700 | Page title mobile, section h2 desktop |
| `text-xl font-semibold font-serif` | 20px / 600 | Section h3 |
| `text-lg font-semibold font-serif` | 18px / 600 | Card title |
| `text-base` | 16px / 400 | Body desktop |
| `text-sm` | 14px / 400 | Body mobile, secondary |
| `text-xs` | 12px / 500 | Caption, meta |
| `text-[10px] uppercase tracking-wider` | 10px / 600 | Labels, tabs |

### Spacing

| Token | Valeur | Usage |
|---|---|---|
| `space-y-8 lg:space-y-12` | 32px / 48px | Sections principales |
| `gap-4 lg:gap-6` | 16px / 24px | Grid items |
| `p-4 lg:p-6` | 16px / 24px | Card padding |
| `px-4 sm:px-6 lg:px-8` | 16/24/32px | Container horizontal padding |

### Layout

| Token | Valeur | Usage |
|---|---|---|
| `max-w-7xl mx-auto` | 1280px centered | Container desktop principal |
| `max-w-3xl mx-auto` | 768px centered | Container chat / lecture |
| `lg:grid-cols-3` | 3 cols ≥1024px | Dashboard KPI, Plan layout |
| `md:grid-cols-2` | 2 cols ≥768px | Repas grid, exercices |

---

## 2. Composants à extraire / créer

### Atoms (réutilisables partout)

```
components/ui/
├── kpi-card.tsx          [NEW]  Card chiffre + label + delta (Dashboard, Workout Summary)
├── radial-progress.tsx   [NEW]  Anneau de progression % (Dashboard Goal Progress)
├── magazine-photo.tsx    [NEW]  Wrapper next/image N&B éditorial (Onboarding, Training Level)
├── tier-card.tsx         [NEW]  Card abonnement avec features bullets (Paywall)
├── leaderboard-row.tsx   [NEW]  Ligne de classement avec avatar + score (Community)
├── loader.tsx            [NEW]  Cercle gold + texte FR (Loading global)
├── tab-bar.tsx           [REFACTOR]  Tabs gold-underline pattern (Plan, Progress, Coach)
└── stat-pill.tsx         [NEW]  Badge value+unit (kcal, kg, reps)
```

### Molecules (par feature)

```
components/coach/
├── chat-bubble.tsx       [REFACTOR]  Force bg-white (assistant) / bg-amber-500 (user)
└── sources-card.tsx      [NEW]  Carte sources scientifiques (extrait du Coach actuel)

components/plan/
├── meal-card.tsx         [NEW]  Photo food + nom + macros + bouton CTA
├── exercise-card.tsx     [NEW]  Video preview + sets/reps + bouton Log Set
└── macro-bar.tsx         [NEW]  Barre progress P/G/L avec valeurs en grammes

components/dashboard/
├── kpi-row.tsx           [NEW]  3 KPICard alignés (poids, kcal, série)
├── quick-actions.tsx     [NEW]  Grid 4 boutons icon+label (mobile 2x2)
└── weight-trend-chart.tsx [REFACTOR]  Existe mais à styliser amber/zinc

components/progress/
└── weight-history-list.tsx [NEW]  Liste droite "Historique journalier"

components/community/
└── leaderboard-podium.tsx [NEW]  Top 3 avec médailles or/argent/bronze

components/onboarding/
├── goal-selector.tsx     [NEW]  3 cards avec icônes (Perte gras/Prise muscle/Recomposition)
├── level-selector.tsx    [NEW]  3 cards Intermédiaire/Avancé/Élite
└── morphometrics-input.tsx [NEW]  Inputs taille+poids avec gold underline

components/settings/
├── profile-sidebar.tsx   [NEW]  Sidebar gauche avec avatar + nav anchors
└── toggle-row.tsx        [REFACTOR]  Switch role=switch (déjà a11y-fixed)

components/workout/
└── volume-stat-card.tsx  [NEW]  KPI card avec icône gold (Volume, Time, PR)
```

### Layouts

```
app/(app)/layout.tsx               [REFACTOR]  Top nav desktop déjà OK, ajouter Coach IA icon
app/(app)/workout/layout.tsx       [NEW]       Section workouts
app/(app)/community/layout.tsx     [TBD]       Leaderboard layout
```

---

## 3. Per-screen migration plan

### 3.1 `/coach` (Coach Chat)

**Fichier** : `app/(app)/coach/page.tsx`
**Stitch refs** : `coach-d.jpg`, `coach-m.jpg`

**Current vs Target** :
- ✅ Header sticky avec "Coach NoDream" + statut "En ligne" — déjà OK
- ✅ Container `max-w-3xl` — déjà OK
- ⚠️ Stitch sort les bulles assistant en dark sur dark — **ignorer Stitch, garder bg-white** (DESIGN.md règle stricte)
- ✅ Bulles user gold — déjà OK
- ✅ Sources cards en cream/light — déjà OK
- ✅ Input bar sticky bottom — déjà OK

**Delta restant** :
- Affichage en mobile : les bulles user wrap mal (cf coach-m.jpg, le texte déborde) → vérifier `max-w-[85%]` + word-break

**Composants à extraire** : `<ChatBubble role="user|assistant">` , `<SourcesCard sources={[]}/>`

**Données Firestore** : déjà OK, route `/api/ai/coach` SSE streaming

**Routes à modifier** : aucune (sauf extraction composants)

**Priorité** : **P3** (déjà 90 % fait, juste extraction composants pour réutilisation)

---

### 3.2 `/dashboard` (Tableau de bord)

**Fichier** : `app/(app)/dashboard/page.tsx`
**Stitch refs** : `dashboard-d.jpg`, `dashboard-m.jpg`

**Current vs Target** :
- ✅ Container `max-w-7xl` + grid 3 cols KPI — déjà fait dans le précédent batch
- ❌ Stitch sort KPI cards en EN (Current Weight, Daily Calories, Streak, Weekly Steps, Calories Burned, Active Minutes) → **traduire en FR** (Poids actuel, Calories du jour, Série, Pas hebdo, Calories brûlées, Minutes actives)
- ❌ Stitch sort `185 lbs` → **forcer kg**
- ❌ Top nav en EN (Dashboard / Programs / Nutrition / Profile) → **FR** (Tableau / Programmes / Nutrition / Profil)
- 🟡 Stitch ajoute un `Goal Progress` radial 75% que l'app actuelle n'a pas → **créer composant `<RadialProgress />`**
- 🟡 Stitch ajoute `Weekly Steps` / `Calories Burned` / `Active Minutes` (intégration Apple Health / Google Fit) → **garder pour plus tard, KPI placeholder**
- ✅ Quick actions 4-grid en bas — alignement OK

**Composants à extraire** :
- `<KPICard label value unit delta icon />` ← réutilisé 3-6 fois
- `<RadialProgress value={75} label="Current Goal: Lean Muscle Gain" />` ← nouveau
- `<QuickActionsGrid items={[]} />` ← refactor

**Données Firestore** :
- `users/{uid}.profile.weight` — poids actuel
- `users/{uid}/active_plan.kcal` — cible journalière
- `users/{uid}/checkins_daily/{today}` — pesée du jour
- `users/{uid}.stats.streak_days` — série jours consécutifs (NEW à créer)
- `users/{uid}.stats.goal_progress` — % progression objectif (NEW)

**Routes à modifier** : `/api/user/sync-wearables` (déjà existe) pour pas/minutes actives — placeholder OK

**Priorité** : **P1** (vitrine de l'app, vu par tous les users sur chaque session)

---

### 3.3 `/plan` (Plan Nutrition + Training)

**Fichier** : `app/(app)/plan/page.tsx`
**Stitch refs** : `plan-d.jpg`, `plan-m.jpg`, `training-detail-d.jpg`

**Current vs Target** :
- ✅ Tabs Nutrition/Entraînement déjà OK (mobile + desktop)
- ✅ Sidebar gauche Objectifs du jour sticky — déjà fait
- 🟡 Stitch ajoute **photos de plats premium** sur les meal cards → **MAJEUR** : upload images dans `public/meals/` (besoin de Nano Banana 2 pour générer ou banques d'images food)
- ❌ Stitch génère meal names en EN (Breakfast / Lunch / Dinner) → **FR** (Petit-déjeuner / Déjeuner / Dîner / Collation)
- ❌ Macros en `180g Protein 250g Carbs 75g Fat` → **FR** (180g Protéines / 250g Glucides / 75g Lipides)
- 🟡 Stitch ajoute bouton `Ajouter` ou `View Recipe` sur chaque meal card → wire vers `/log/recipe?id={id}`
- 🟡 Training tab : Stitch sort `training-detail-d.jpg` avec **video preview thumbnails** pour chaque exercice → **MAJEUR** : besoin de wireframes vidéo (vimeo embed ou MP4 self-hosted)
- ❌ `Log Set 1` button en EN → `Logger série 1`
- 🟡 Sidebar gauche du training : `NoDream Training Plan` card avec Duration / Intensity / Volume / Progress bar → **nouveau composant `<TrainingSidebar />`**

**Composants à extraire** :
- `<MealCard meal={meal} photo={url} onView={fn} />` ← grid 2x3
- `<MacroBar p={180} c={250} f={75} kcal={2450} />` ← affiche les macros avec progress vs cible
- `<ExerciseCard exercise={ex} videoUrl={url} onLog={fn} />` ← grid 2-cols dans training
- `<TrainingSidebar plan={plan} progressPct={80} />` ← sidebar gauche training tab
- `<RawCookedConverter foods={FOOD_DATABASE} />` ← déjà existe inline, à extraire

**Données Firestore** :
- `users/{uid}/active_plan.meals_template[]` — existe
- `users/{uid}/active_plan.training.sessions[]` — existe
- `users/{uid}/active_plan.training.sessions[].exercises[].video_url` — **NEW à ajouter au schema**
- `meals/library/{mealId}` — collection meals avec photos (NEW)

**Routes à créer** : aucune (data déjà en place, juste enrichir le schema)

**Risque média** : photos food + videos exercices coûteuses à générer/sourcer. Phase 1 : placeholder gold-on-zinc (next/image avec `fallback`). Phase 2 : Nano Banana 2 batch food photos.

**Priorité** : **P1** (le plan est la valeur principale du coaching)

---

### 3.4 `/progress` (Suivi des progrès)

**Fichier** : `app/(app)/progress/page.tsx`
**Stitch refs** : `progress-d.jpg`

**Current vs Target** :
- ✅ Tabs Poids/Mensurations/Photos — déjà OK
- ✅ Grid weight chart 2/3 + historique 1/3 — déjà fait dans batch précédent
- 🟡 Stitch sort le top nav en EN (Accueil/Programmes/Suivi Progrès/Nutrition/Profil) → on garde notre bottom nav existant + ignorer cette nav Stitch
- 🟡 Stitch sort chart line gold avec gradient fill → vérifier que notre `<WeightChart />` est OK
- ❌ Stitch sort dates en EN format (15 Juin 2024) → déjà FR dans le code actuel

**Composants à extraire** :
- `<WeightHistoryRow date={d} weight={w} delta={n} />` ← réutilisé dans la sidebar

**Données Firestore** : `checkins_daily` déjà OK

**Priorité** : **P2** (visualisation, pas critique)

---

### 3.5 `/onboarding` (Wizard 6 étapes)

**Fichiers** :
- `app/(app)/onboarding/page.tsx` (intro)
- `app/(app)/onboarding/[step]/page.tsx` (chaque étape)

**Stitch refs** :
- `onboarding-redesign-d.jpg` (intro : photo athlète gauche + 3 goals droite)
- `morphometrics-d.jpg` (step silhouette : photo banc gris + inputs taille/poids)
- `training-level-d.jpg` (step level : photo squat lourd + 3 niveaux Intermédiaire/Avancé/Élite)

**Current vs Target** :
- ⚠️ Refonte majeure : Stitch propose un layout **split 50/50** desktop (photo N&B gauche, contenu droite) au lieu du wizard centré actuel
- ✅ FR déjà respecté dans Stitch (Définissons vos objectifs, Étape X sur 6, Suivant)
- 🟡 Photos N&B requises : athlète course, banc gris industriel, squat lourd → **génération Nano Banana 2 ou banque d'images**
- 🟡 Cards goal/level avec icônes lucide custom (Perte de gras/Prise de muscle/Recomposition / Intermédiaire/Avancé/Élite)
- 🟡 Bouton Suivant gold pleine largeur en bas

**Composants à extraire** :
- `<OnboardingLayout photo={url} alt={alt}>{children}</OnboardingLayout>` ← split layout
- `<GoalSelector value={goal} onChange={fn} />` ← 3 cards avec icon
- `<LevelSelector value={level} onChange={fn} />` ← 3 cards
- `<MorphometricsForm height weight onChange={fn} />` ← inputs gold underline
- `<StepIndicator current={3} total={6} />` ← "Étape 3 sur 6"

**Données Firestore** :
- `users/{uid}.profile.goal` (lose_fat / gain_muscle / recomp) — existe
- `users/{uid}.profile.training_level` (intermediate / advanced / elite) — **NEW à ajouter**
- `users/{uid}.profile.height` / `weight` — existe

**Routes à modifier** : `app/api/profile/update-fields/route.ts` ajouter `profile.training_level` à la whitelist

**Risque** : refonte UX visible. Garder le wizard logique actuel (6 steps), juste changer le rendu.

**Priorité** : **P1** (premier contact utilisateur, donne la première impression)

---

### 3.6 `/settings` (Profil & Réglages)

**Fichier** : `app/(app)/settings/page.tsx`
**Stitch refs** : `settings-d.jpg`

**Current vs Target** :
- ⚠️ Stitch propose un layout **3 colonnes** : sidebar gauche avatar + nav anchor + 3 sections (Personal Info / Subscription / App Settings)
- ⚠️ Layout actuel : grid 2-cols form simple — **refonte complète** vers le layout 3-cols
- 🟡 Sidebar avatar : photo profil cercle + nom + badge "Member since 2021" (placeholder ok)
- 🟡 Nav anchors : Profile / Activity / Progress / Community (scroll-to-section)
- 🟡 Card Account Details : Email, Phone, Location (Phone et Location pas dans schema actuel)
- 🟡 Card Subscription : tier badge gold + "Renewal on X" + boutons Manage
- 🟡 Card App Settings : 3 toggles Privacy / Data / Integrations
- ❌ Tout en EN → traduire (Personal Info → Infos personnelles, Account Details → Détails du compte, etc.)
- 🟡 Bouton Sign Out → Se déconnecter (déjà OK dans le code)

**Composants à extraire** :
- `<ProfileSidebar user={user} nav={anchors} />`
- `<AccountDetailsCard user={user} />`
- `<SubscriptionCard tier={tier} renewal={date} />`
- `<AppSettingsCard toggles={[]} />` (déjà a11y-fixed dans batch précédent)

**Données Firestore** :
- `users/{uid}.profile.email` (vient de auth) — OK
- `users/{uid}.profile.phone` — **NEW à ajouter**
- `users/{uid}.profile.location` — **NEW à ajouter**
- `users/{uid}.subscription.tier` — **NEW**
- `users/{uid}.subscription.renewal_date` — **NEW**

**Risque** : refonte UX importante. Couper en deux phases :
- P1 : nouveau layout + traductions
- P2 : ajout fields manquants au schema + UI subscription

**Priorité** : **P2** (visible mais pas critique au flow principal)

---

### 3.7 `/settings/subscription` (Paywall)

**Fichier** : `app/(app)/settings/subscription/page.tsx`
**Stitch refs** : `paywall-d.jpg`

**Current vs Target** :
- ⚠️ Stitch propose layout **3 tiers cards** (Libre Free / Elite €14.99 Recommended / Héritage €29.99)
- 🟡 Header NoDream simple + nav Features/Pricing/Blog/Sign In en haut → on garde notre header app standard
- 🟡 Title "Passez au niveau supérieur" + subtitle EN ("Unlock your full fitness potential…") → traduire
- 🟡 3 tier cards : Libre (Free / Unlimited Premium Workouts / Personalized Training Plans + bouton "Commencer")
- 🟡 Elite (€14.99/month / 4 features / bouton gold "Passer à l'Elite" + badge "Recommended")
- 🟡 Héritage (€29.99/month / 5 features / bouton "Devenir Héritage")
- ❌ Features en EN → traduire (Unlimited Premium Workouts → Séances premium illimitées, Personalized Training Plans → Plans d'entraînement personnalisés, Advanced Analytics → Analyses avancées, Priority Support → Support prioritaire)

**Composants à extraire** :
- `<TierCard tier={t} highlighted={bool} cta={text} onClick={fn} />` ← réutilisé 3 fois

**Routes à modifier** :
- Wire `<TierCard cta="Passer à l'Elite">` vers Stripe Checkout : `POST /api/stripe/checkout {tier: 'elite'}` (existe déjà mais pas configuré côté Stripe → besoin clé API)

**Risque** : Stripe pas encore configuré (no SECRET_KEY). Phase 1 : UI uniquement, bouton mock → toast "Paiement bientôt disponible". Phase 2 : wire Stripe + webhook.

**Priorité** : **P3** (besoin Stripe live d'abord)

---

### 3.8 `/community` (Leaderboard)

**Fichier** : `app/(app)/community/page.tsx`
**Stitch refs** : `leaderboard-d.jpg`

**Current vs Target** :
- ⚠️ **Pivot stratégique** : actuel est une page "Communauté Discord" simple. Stitch propose un vrai **Leaderboard NoDream** (Cercle NoDream, Top 3 Elite podium, Global Rankings table, Monthly Challenges sidebar).
- ⚠️ Refonte complète OU on garde Discord en lien externe + ajoute Leaderboard en bas. **Recommandation** : leaderboard en PRIMARY + lien Discord secondaire.
- 🟡 Top 3 podium : Marco R / Elena S / Anya K avec badges médailles (Silver/Gold/Bronze Tier)
- 🟡 Sidebar gauche : Monthly Challenges (Iron Will Challenge 85%, Consistency King 90%, Peak Performance 70%)
- 🟡 Table Global Rankings : Rank / User / Consistency / Points

**Composants à extraire** :
- `<LeaderboardPodium top3={[]} />`
- `<RankingRow rank={n} user={u} score={s} points={p} />`
- `<ChallengeCard challenge={c} progress={pct} />`

**Données Firestore** :
- `users/*` query top 100 by points (NEW field `users/{uid}.community.points`, NEW field `users/{uid}.community.consistency_pct`)
- `challenges/*` collection NEW (mensuel, défis communautaires)

**Risque** : la communauté nécessite des **users actifs** ; sans masse critique, le leaderboard sera vide. Phase 1 : page UI avec data mock + tooltip "Bientôt". Phase 2 : compute backend.

**Priorité** : **P3** (besoin masse critique d'users)

---

### 3.9 `/log/recipe` (Recipe Library)

**Fichier** : `app/(app)/log/recipe/page.tsx`
**Stitch refs** : `recipe-d.jpg`

**Current vs Target** :
- ⚠️ Actuel : page de saisie de recette (form OCR). Stitch propose une **Recipe Library** ("Cuisine Performance", grid 2x3 recettes avec photos premium, sidebar filtres).
- ⚠️ Confusion sémantique : `/log/recipe` est pour LOGGER une recette mangée, pas pour parcourir une bibliothèque. **Décision** : créer `/recipes` (browse) ET garder `/log/recipe` (log).
- 🟡 Sidebar filtres : Objectif (Prise de masse/Sèche/Maintien) / Temps de préparation (Rapide <20min / Moyen <45min) / Type de repas (Petit-déjeuner/Déjeuner/Dîner/Collation)
- 🟡 Grid 2x3 recettes : photo + nom + temps + macros + bouton vue détaillée
- 🟡 Pagination "Page 1 sur 5"

**Composants à extraire** :
- `<RecipeFilterSidebar filters={[]} onChange={fn} />`
- `<RecipeCard recipe={r} onView={fn} />` ← grid item

**Données Firestore** :
- `recipes/{recipeId}` collection NEW : `name`, `photo_url`, `prep_time`, `macros`, `category`, `tags`

**Routes à créer** :
- `app/(app)/recipes/page.tsx` (browse library) — NEW
- `app/(app)/recipes/[recipeId]/page.tsx` (détail recette) — NEW
- garder `/log/recipe` actuel pour logging

**Risque** : besoin de seed la collection `recipes`. Phase 1 : 12-20 recettes mockées via script. Phase 2 : génération AI batch.

**Priorité** : **P2** (valeur ajoutée significative au plan)

---

### 3.10 NOUVELLE ROUTE `/workout/summary` (Workout Summary)

**Stitch refs** : `workout-summary-d.jpg`

**Layout** :
- Hero "Mission Accomplie" + subtitle ("Excellent session, Alex! Here's your summary.")
- 3 KPI cards radial : Volume (12,450 KG) / Time (1h 15m) / PRs (3 BROKE!)
- Section "Share Your Success" : 3 templates partage social (Bench Press PR, 5K Run, Total Volume)
- Top nav Dashboard / Workouts / Progress / Profile

**Routes à créer** :
- `app/(app)/workout/summary/[sessionId]/page.tsx` NEW
- `app/(app)/workout/log/[sessionId]/page.tsx` NEW (logger pendant la session)

**Composants** :
- `<VolumeStatCard label value unit delta />`
- `<SocialShareCard template={t} stats={s} />`

**Données Firestore** :
- `users/{uid}/workouts/{sessionId}` NEW collection : exercises[], total_volume, duration, prs[]

**Risque** : nouvelle feature, besoin de design du flow complet (avant : page log, pendant : timer + log set, après : summary). Sortir du scope du brief actuel pour le flow log live.

**Priorité** : **P3** (nouvelle feature, après stabilisation existant)

---

### 3.11 Composant global `<Loader />`

**Stitch refs** : `loading-d.jpg`

**Layout** : cercle gold ring + texte FR "Préparation de ton espace de coaching..."

**Composant** :
```tsx
// components/ui/loader.tsx
export function Loader({ message = "Chargement..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-6">
      <div className="h-12 w-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      <p className="text-amber-500 font-serif text-sm tracking-wide">{message}</p>
    </div>
  );
}
```

Remplacer **toutes** les variantes actuelles de loader (4-5 fichiers utilisent leur propre spinner inline).

**Priorité** : **P1** (quick win, propagation immédiate)

---

### 3.12 `/settings/privacy` (Legal Pages)

**Fichier** : `app/(app)/settings/privacy/page.tsx`
**Stitch refs** : `legal-d.jpg`

**Current vs Target** :
- ⚠️ Stitch propose un layout **magazine éditorial** : titre serif énorme "Mentions Légales & Confidentialité", table of contents sticky gauche, contenu droite avec sections numérotées
- 🟡 Table of Contents : Préambule / Conditions Générales d'Utilisation / Politique de Confidentialité / Données Personnelles / Cookies / Propriété Intellectuelle / Contact
- 🟡 Sections numérotées avec h2 serif

**Composants à extraire** :
- `<LegalLayout toc={[]}>{children}</LegalLayout>` ← réutilisable pour Privacy / Terms / Cookies

**Routes à créer** :
- `/settings/terms` NEW
- `/settings/cookies` NEW (consent management)

**Priorité** : **P2** (légal obligatoire RGPD, à finaliser avant prod stable)

---

## 4. Priorité d'exécution

### Quick wins (< 30 min chacun)

1. **P1 — `<Loader />` global** → remplacer les 4-5 spinners inline (propagation immédiate)
2. **P1 — Dashboard FR + kg** → traduire les KPI labels existants
3. **P1 — `<KPICard />` extraction** → débloque Dashboard + Workout Summary
4. **P3 — Coach** → extraction `<ChatBubble />` + `<SourcesCard />` (déjà 90 % fait)

### Refontes layout (1-2h chacune)

5. **P1 — Onboarding split layout** → split 50/50 photo + contenu, besoin photos N&B
6. **P1 — Plan Nutrition** : `<MealCard />` + photos placeholder (phase 1 sans Nano Banana)
7. **P2 — Progress** : extraction `<WeightHistoryRow />`
8. **P2 — Settings 3-cols layout** + traductions

### Nouvelles features (2-4h chacune)

9. **P2 — Recipe Library** : nouvelle route `/recipes` + seed 12 recettes mockées
10. **P3 — Community Leaderboard** : nouveau layout + données mock
11. **P3 — Paywall** : 3 tier cards + UI mock (Stripe wire après)
12. **P3 — Workout Summary** : nouvelle route + flow live à designer

### Legal/admin (1h)

13. **P2 — Legal magazine layout** → privacy + terms + cookies

### Dépendances

```
Loader (P1) ────────────┐
                        ├──► Dashboard (P1) ◄── KPICard (P1)
                        │
Onboarding (P1) ────────┴──► Plan Nutrition (P1) ◄── MealCard (P1)
                                       │
                                       ▼
                            Recipe Library (P2)
                                       │
                                       ▼
                            Workout Summary (P3) ◄── VolumeStatCard
```

---

## 5. Risques connus et points d'attention

### Risques techniques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Stitch génère du EN qu'on doit traduire | 100 % | Faible | Toujours écrire en FR direct, ignorer copy Stitch |
| Photos food/training non disponibles | 100 % | Moyen | Phase 1 placeholder gold-on-zinc avec `next/image fallback` |
| Stripe pas configuré pour paywall | 100 % | Bloque P3 | Phase 1 UI mock → toast "Bientôt", phase 2 après clé API |
| Auth Firebase ouverte (allow read, write: if true) | Existant | Critique sécu | Re-fermer les rules après stabilisation (cf memory `state_naming_nodream`) |
| Bottom nav vs Top nav desktop : Stitch montre top nav, app utilise bottom | Conflit UX | Moyen | Garder bottom nav mobile + TopBar existant desktop ; ignorer top nav Stitch |
| Tailwind purge sur classes dynamiques | Moyen | Moyen | Whitelist `bg-zinc-{900,800,700}` `text-amber-{300,400,500}` dans safelist si purge agressive |
| Stitch screenshots ne reflètent pas DESIGN.md (timeout apply_design_system) | Confirmé | Faible | Code suit DESIGN.md, pas les screenshots |

### Risques produit

| Risque | Mitigation |
|---|---|
| Refonte onboarding casse le funnel actuel | A/B test si possible, sinon ship + monitor drop-off |
| Leaderboard vide tant que pas de masse critique | Mock data + label "Bêta" sur la page |
| Recipe library demande beaucoup de contenu | Seed avec recettes basiques, growth progressif |
| Workout Summary nouvelle feature nécessite design log live | Sortir du scope, ship Summary seul d'abord |

### Points d'attention RGPD / a11y

- ✅ a11y fixes appliqués dans batch précédent (`e5a846b`) — maintenir aria-labels sur nouveaux composants
- ⚠️ Cookie banner : à créer pour `/settings/cookies` avec consent management (vanilla solution ou cookiebot)
- ⚠️ Export RGPD : `/api/user/export` existe déjà, vérifier que nouveaux fields (subscription, community) sont inclus
- ⚠️ Suppression compte : `/api/user/delete` doit supprimer recipes saved, workouts logged, community points

### Points d'attention performance

- 📊 Photos food + photos onboarding N&B : prévoir `<Image priority>` pour LCP, format AVIF/WebP, sizes responsive
- 📊 Leaderboard top 100 users : pagination + cache Firestore
- 📊 Weight chart : déjà existe (Recharts), surveiller bundle size

---

## 6. Composants UI à créer en priorité (ordre d'exécution)

```
Étape 1 (Foundations) :
├── components/ui/loader.tsx              [10 min]
├── components/ui/kpi-card.tsx            [20 min]
├── components/ui/radial-progress.tsx     [25 min]
├── components/ui/magazine-photo.tsx      [15 min]
└── components/ui/stat-pill.tsx           [10 min]

Étape 2 (Plan + Dashboard) :
├── components/plan/meal-card.tsx          [30 min]
├── components/plan/macro-bar.tsx          [20 min]
├── components/plan/exercise-card.tsx      [30 min]
├── components/dashboard/kpi-row.tsx       [15 min]
└── components/dashboard/quick-actions.tsx [15 min]

Étape 3 (Onboarding) :
├── components/onboarding/onboarding-layout.tsx [20 min]
├── components/onboarding/goal-selector.tsx     [25 min]
├── components/onboarding/level-selector.tsx    [20 min]
├── components/onboarding/morphometrics-input.tsx [20 min]
└── components/onboarding/step-indicator.tsx    [10 min]

Étape 4 (Settings + Paywall) :
├── components/settings/profile-sidebar.tsx    [25 min]
├── components/settings/subscription-card.tsx  [20 min]
└── components/ui/tier-card.tsx                [30 min]

Étape 5 (Community + Recipes) :
├── components/community/leaderboard-podium.tsx [40 min]
├── components/community/ranking-row.tsx        [15 min]
├── components/community/challenge-card.tsx     [20 min]
├── components/recipes/recipe-card.tsx          [25 min]
└── components/recipes/filter-sidebar.tsx       [30 min]

Étape 6 (Workout) :
├── components/workout/volume-stat-card.tsx    [20 min]
└── components/workout/social-share-card.tsx   [25 min]
```

**Total estimé** : ~8h de composants atomiques, puis ~6h d'intégration dans les pages, puis ~2h commits + tests E2E.

---

## 7. Mapping screen → routes existantes/nouvelles

| Stitch screen | Route Next.js | Status |
|---|---|---|
| coach-d/m | `/coach` | Existe, refactor mineur |
| dashboard-d/m | `/dashboard` | Existe, refactor majeur (FR/kg) |
| plan-d/m | `/plan` (nutrition tab) | Existe, refactor majeur (photos) |
| training-detail-d | `/plan` (training tab) | Existe, refactor majeur (videos) |
| progress-d | `/progress` | Existe, refactor mineur |
| onboarding-redesign-d | `/onboarding` | Existe, refonte UX |
| morphometrics-d | `/onboarding/[step=silhouette]` | Existe, refonte UX |
| training-level-d | `/onboarding/[step=level]` | À créer |
| settings-d | `/settings` | Existe, refonte UX |
| paywall-d | `/settings/subscription` | Existe, refonte |
| legal-d | `/settings/privacy` | Existe, refonte layout |
| recipe-d | `/recipes` | **À créer** |
| workout-summary-d | `/workout/summary/[id]` | **À créer** |
| leaderboard-d | `/community` | Existe, refonte majeure |
| loading-d | composant `<Loader />` | À créer + propager |

---

## 8. Validation post-migration

Pour chaque écran migré :

1. **Build** : `npm run build` doit passer sans warnings nouveaux
2. **Visual** : ouvrir Vercel preview, comparer côte-à-côte avec Stitch screenshot
3. **a11y check** : aria-labels, touch targets 44×44, focus visible (validé par audit antérieur)
4. **Contrast** : tester sur `prefers-color-scheme: dark` et light
5. **i18n** : grep `\b(workout|recipe|profile|streak|breakfast|lunch|dinner|today|tomorrow)\b` dans le fichier — doit retourner 0 résultat utilisateur
6. **Engineering code-review** : skill `engineering:code-review` sur le commit

---

## 9. Out of scope (à traiter plus tard)

- Stripe live integration (clés API, webhooks, products)
- Apple Health / Google Fit sync (wearables data réelle)
- Push notifications (web push API + Firebase Cloud Messaging)
- Coach IA voice mode (déjà partiellement intégré via TopBar voice icon)
- Multi-langue (juste FR maintenant, EN plus tard)
- Mode clair (pas demandé, NoDream = dark only)
- Apps natives iOS/Android (PWA installable suffit)
- Tests E2E exhaustifs (les 20 tests existants suffisent pour MVP)

---

**Prochaine étape suggérée** : commencer par les Foundations (Étape 1 composants) puis dérouler les pages dans l'ordre de priorité. Le Loader propagé en premier donne un gain visuel immédiat partout dans l'app.
