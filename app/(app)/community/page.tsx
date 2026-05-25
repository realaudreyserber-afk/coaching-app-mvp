import type { Metadata } from "next";
import { MessageCircle, ExternalLink, Hash, Shield, Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "La communauté — NoDream",
  description:
    "Rejoins la communauté NoDream sur Discord. Salons thématiques, modération sérieuse, zéro coach influenceur.",
};

const DISCORD_INVITE_URL = "https://discord.gg/aT7vUUvawj";

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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Header */}
        <header className="mb-16 nd-fade-up">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[--color-nd-gold] mb-4">
            <div className="h-px w-8 bg-[--color-nd-gold]" />
            <span className="font-semibold">La communauté</span>
          </div>
          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-[--color-nd-white]">
            On parle <span className="text-[--color-nd-gold]">vrai.</span>
            <br />
            Sur Discord.
          </h1>
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
