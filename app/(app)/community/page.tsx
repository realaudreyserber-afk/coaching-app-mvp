import type { Metadata } from "next";
import { MessageCircle, ExternalLink, Hash, Shield, Lock } from "lucide-react";
import { LeaderboardPodium, PodiumUser } from "@/components/community/leaderboard-podium";
import { RankingRow, RankingUser } from "@/components/community/ranking-row";
import { ChallengeCard } from "@/components/community/challenge-card";

export const metadata: Metadata = {
  title: "La communauté — NoDream",
  description:
    "Rejoins la communauté NoDream sur Discord. Salons thématiques, modération sérieuse, zéro coach influenceur.",
};

const DISCORD_INVITE_URL = "https://discord.gg/aT7vUUvawj";

// Mock data Phase 1 — sera remplacé par query Firestore users top 100 by points
// (cf MIGRATION_BRIEF.md section 3.8). Tous prénoms fictifs.
const MOCK_PODIUM: PodiumUser[] = [
  { rank: 1, name: "Elena S.", initials: "ES", tier: "Or", points: 18420, stat: "Régularité 99 %", avatarUrl: "/avatars/elena.jpg" },
  { rank: 2, name: "Marco R.", initials: "MR", tier: "Argent", points: 14650, stat: "Régularité 98 %", avatarUrl: "/avatars/marco.jpg" },
  { rank: 3, name: "Anya K.", initials: "AK", tier: "Bronze", points: 14210, stat: "Régularité 97 %", avatarUrl: "/avatars/anya.jpg" },
];

const MOCK_RANKINGS: RankingUser[] = [
  { rank: 4, name: "David L.", initials: "DL", consistencyPct: 99, points: 15420, avatarUrl: "/avatars/david.jpg" },
  { rank: 5, name: "Sarah M.", initials: "SM", consistencyPct: 98, points: 15420, avatarUrl: "/avatars/sarah.jpg" },
  { rank: 6, name: "Martin C.", initials: "MC", consistencyPct: 98, points: 12380 },
  { rank: 7, name: "Élise L.", initials: "EL", consistencyPct: 98, points: 14650 },
  { rank: 8, name: "Sarah H.", initials: "SH", consistencyPct: 98, points: 14480 },
  { rank: 9, name: "David H.", initials: "DH", consistencyPct: 97, points: 14200 },
  { rank: 10, name: "Anya K.", initials: "AK", consistencyPct: 97, points: 14210, avatarUrl: "/avatars/anya.jpg" },
];

const MOCK_CHALLENGES = [
  { title: "Volonté de fer", progressPct: 85, subtitle: "12 jours restants" },
  { title: "Roi de la régularité", progressPct: 90, subtitle: "5 jours restants" },
  { title: "Pic de performance", progressPct: 70, subtitle: "18 jours restants" },
];

const CHANNELS = [
  { name: "présentations", desc: "Tu démarres ici. Format : prénom, âge, taille, poids, objectif." },
  { name: "questions-libres", desc: "Le canal général. Tout ce qui n'a pas son channel dédié." },
  { name: "séances", desc: "Tes entraînements, tes performances, tes records." },
  { name: "form-check", desc: "Vidéos d'exécution. Feedback technique entre pratiquants." },
  { name: "nutrition", desc: "Plans, recettes, équivalences. Pas de débat keto vs IIFYM." },
  { name: "compléments", desc: "Créatine, oméga 3, magnésium. Pas de promo." },
  { name: "photos-progrès", desc: "Canal opt-in, slow-mode 1 message / 24 h." },
  { name: "stagnations", desc: "T'es bloqué depuis 3 semaines. On regarde ensemble." },
  { name: "victoires", desc: "Tes records, tes milestones, tes premiers abdos visibles." },
  { name: "hormonal-avancé", desc: "TRT, cycle, GLP-1. Discussion factuelle, pas de protocole." },
  { name: "science", desc: "Partage d'études peer-reviewed et discussions corpus." },
  { name: "tca-soutien", desc: "Modéré strict. Ressources pro, écoute, redirection." },
];

const RULES_HIGHLIGHT = [
  {
    icon: Shield,
    title: "Pas de conseil médical entre membres",
    body: "Si quelqu'un décrit une douleur, un trouble alimentaire, des effets de médicament — tu écoutes, tu partages ton vécu, tu rediriges vers un pro. Tu n'es pas médecin.",
  },
  {
    icon: Lock,
    title: "Zéro promotion, zéro affilié",
    body: "Pas de lien partenaire, pas de PDF à vendre, pas de code promo. C'est éliminatoire — pas de seconde chance.",
  },
  {
    icon: MessageCircle,
    title: "Sources quand tu affirmes du factuel",
    body: "Si tu dis « les protéines abîment les reins », attends-toi à ce qu'on te demande l'étude. Sinon tu dis « à mon avis ».",
  },
];

export default function CommunityPage() {
  return (
    <main className="nd-scope flex-1 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Header */}
        <header className="mb-12 nd-fade-up">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[--color-nd-gold] mb-4">
            <div className="h-px w-8 bg-[--color-nd-gold]" />
            <span className="font-semibold">La communauté</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold border border-amber-500/40">
              Bêta
            </span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-[--color-nd-white]">
            Cercle <span className="text-[--color-nd-gold]">NoDream.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg text-[--color-nd-white-dim] leading-relaxed">
            Classement mensuel basé sur ta régularité (check-ins quotidiens) et tes
            performances (records, défis). Pas de vanity metrics — juste le travail réel.
          </p>
        </header>

        {/* Leaderboard section */}
        <section className="mb-16 nd-fade-up nd-stagger-1">
          <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
            {/* Sidebar : Monthly Challenges */}
            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[--color-nd-muted]">
                <div className="h-px w-8 bg-[--color-nd-stroke]" />
                <span>Défis du mois</span>
              </div>
              <div className="space-y-3">
                {MOCK_CHALLENGES.map((c) => (
                  <ChallengeCard
                    key={c.title}
                    title={c.title}
                    progressPct={c.progressPct}
                    subtitle={c.subtitle}
                  />
                ))}
              </div>
              <p className="text-[10px] text-[--color-nd-muted] italic leading-relaxed pt-2">
                Données Bêta — le classement live arrivera quand le Cercle atteindra
                100 membres actifs.
              </p>
            </aside>

            {/* Main : Podium + Rankings */}
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[--color-nd-gold] mb-4">
                  <div className="h-px w-8 bg-[--color-nd-gold]" />
                  <span className="font-semibold">Top 3 Élite</span>
                </div>
                <LeaderboardPodium users={MOCK_PODIUM} />
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
                <header className="grid grid-cols-[2rem_1fr_5rem_5rem] items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
                  <span>Rang</span>
                  <span>Athlète</span>
                  <span className="text-right">Régularité</span>
                  <span className="text-right">Points</span>
                </header>
                <ul role="list" aria-label="Classement global">
                  {MOCK_RANKINGS.map((u) => (
                    <RankingRow key={u.rank} user={u} />
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Discord section separator */}
        <div className="border-t border-[--color-nd-stroke] my-12" aria-hidden="true" />

        <header className="mb-16 nd-fade-up">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[--color-nd-gold] mb-4">
            <div className="h-px w-8 bg-[--color-nd-gold]" />
            <span className="font-semibold">Discord</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.05] tracking-tight text-[--color-nd-white]">
            On parle <span className="text-[--color-nd-gold]">vrai.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-[--color-nd-white-dim] leading-relaxed">
            Un chat communautaire dans une app de santé exige une
            modération sérieuse. Plutôt que mal le faire en interne, on
            héberge la conversation sur Discord, avec règles strictes et
            modérateurs humains.
          </p>
        </header>

        {/* Channels preview */}
        <section className="mb-20 nd-fade-up nd-stagger-1">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[--color-nd-muted] mb-6">
            <div className="h-px w-8 bg-[--color-nd-stroke]" />
            <span>Salons thématiques</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CHANNELS.map((c, idx) => (
              <div
                key={c.name}
                className={`group flex items-start gap-3 p-4 rounded-sm border border-[--color-nd-stroke] bg-[--color-nd-black-soft] hover:border-[--color-nd-gold]/40 transition-all nd-fade-up nd-stagger-${Math.min((idx % 5) + 1, 5)}`}
              >
                <Hash className="h-4 w-4 mt-0.5 text-[--color-nd-gold] flex-shrink-0" />
                <div className="space-y-1">
                  <div className="font-serif text-base font-semibold text-[--color-nd-white]">
                    {c.name}
                  </div>
                  <p className="text-xs text-[--color-nd-white-dim] leading-relaxed">
                    {c.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rules highlight */}
        <section className="mb-20 nd-fade-up nd-stagger-2">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[--color-nd-muted] mb-6">
            <div className="h-px w-8 bg-[--color-nd-stroke]" />
            <span>Les 3 règles non-négociables</span>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {RULES_HIGHLIGHT.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.title}
                  className="space-y-3 p-6 rounded-sm border border-[--color-nd-stroke] bg-[--color-nd-black-soft]"
                >
                  <Icon className="h-5 w-5 text-[--color-nd-gold]" />
                  <h3 className="font-serif text-lg font-bold text-[--color-nd-white] leading-tight">
                    {r.title}
                  </h3>
                  <p className="text-sm text-[--color-nd-white-dim] leading-relaxed">
                    {r.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center nd-fade-up nd-stagger-3">
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center justify-center gap-3 px-8 sm:px-12 h-14 bg-[--color-nd-gold] text-[--color-nd-black] font-semibold text-base sm:text-lg uppercase tracking-[0.15em] hover:bg-[--color-nd-gold-glow] transition-all"
          >
            Rejoindre le Discord
            <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
          <p className="mt-6 text-xs text-[--color-nd-muted] uppercase tracking-[0.18em]">
            Lien officiel · discord.gg/aT7vUUvawj
          </p>
          <p className="mt-2 text-xs text-[--color-nd-muted]">
            Tu repères un message déplacé ? Clic droit → Signaler. Les
            modérateurs vérifient chaque signalement.
          </p>
        </section>
      </div>
    </main>
  );
}
