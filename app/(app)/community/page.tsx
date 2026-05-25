import type { Metadata } from "next";
import { MessageCircle, ExternalLink, Users, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Communauté — NoDream",
  description:
    "Rejoins la communauté NoDream sur Discord. Échange avec d'autres abonnés, partage tes progrès, pose tes questions.",
};

const DISCORD_INVITE_URL = "https://discord.gg/aT7vUUvawj";

export default function CommunityPage() {
  return (
    <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary">
          La communauté
        </h1>
        <p className="mt-2 text-sm text-muted-foreground italic">
          On échange en dehors de l&apos;app, sur Discord. Pas de modération
          robotique, des vrais humains.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="rounded-md bg-primary/10 p-3 text-primary">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-serif font-bold text-foreground">
              Pourquoi Discord, pas un chat interne ?
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Un chat communautaire dans une app de santé exige une
              modération sérieuse — TCA, conseils dangereux entre
              utilisateurs, harcèlement. Plutôt que mal le faire en
              interne, on héberge la conversation sur Discord, qui a
              déjà ses outils de modération et où tu gardes le contrôle
              de ton identité.
            </p>
          </div>
        </div>

        <ul className="space-y-3 text-sm text-foreground/90">
          <li className="flex items-start gap-3">
            <Users className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
            <span>
              Salons thématiques : sèche, recomp, prise de masse, GLP-1,
              questions féminines, retour d&apos;expérience.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Shield className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
            <span>
              Règles strictes : pas de conseil médical entre utilisateurs,
              pas de promo de compléments, pas de jugement sur le poids
              ou la silhouette des autres.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <MessageCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
            <span>
              Le coach IA reste dans l&apos;app. Discord, c&apos;est entre
              vous.
            </span>
          </li>
        </ul>

        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Rejoindre le Discord NoDream
          <ExternalLink className="h-4 w-4" />
        </a>

        <p className="text-[10px] text-center text-muted-foreground">
          Le lien ouvre Discord dans un nouvel onglet. Tu peux y aller
          depuis l&apos;app web ou installer Discord en quelques clics.
        </p>
      </section>

      <p className="mt-6 text-xs text-muted-foreground text-center">
        Tu repères un message inapproprié ? Signale-le directement dans
        Discord (clic droit → Signaler). Les modérateurs vérifient
        chaque signalement.
      </p>
    </main>
  );
}
