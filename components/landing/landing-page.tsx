"use client";

/**
 * Landing page publique NoDream — système de design "Tactical OS".
 *
 * Rendu à la racine `/` pour les visiteurs (le fond matrice + les tokens sont
 * fournis globalement par app/layout.tsx). CTA auth-aware : un utilisateur
 * déjà connecté est dirigé vers son tableau de bord, sinon vers l'inscription.
 *
 * Ton : tutoiement, sec, factuel, sans bullshit, sans paternalisme. Pas le mot
 * "régime", pas de surenchère "militaire". FR.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/hooks";
import { HudCard, Tag, Wordmark, BrandMark } from "@/components/nodream";
import {
  Apple,
  Dumbbell,
  LineChart,
  ShieldCheck,
  Brain,
  Users,
  GraduationCap,
  CalendarRange,
  ArrowRight,
  Database,
  Lock,
  ChevronDown,
} from "lucide-react";

const SUB_AGENTS = [
  { code: "NUTRI", icon: Apple, title: "Nutrition", desc: "Macros, repas, jeûne, GLP-1, suppléments — calibrés sur ta masse maigre." },
  { code: "TRAIN", icon: Dumbbell, title: "Entraînement", desc: "Programmation, sélection d'exos, volume, récupération, biomécanique." },
  { code: "ANALYTICS", icon: LineChart, title: "Analytics", desc: "Tendances, détection de plateau, TDEE adaptatif sur tes données réelles." },
  { code: "SAFETY", icon: ShieldCheck, title: "Sécurité", desc: "Garde-fous TCA, planchers caloriques, redirection médecin si signal." },
  { code: "MENTAL", icon: Brain, title: "Mental", desc: "Doute, démotivation, célébration des wins — sans te materner." },
  { code: "SOCIAL", icon: Users, title: "Social", desc: "Sorties, pression sociale, contexte de vie intégrés au plan." },
  { code: "EDU", icon: GraduationCap, title: "Éducation", desc: "Science appliquée, mythes démontés, vulgarisation utile." },
  { code: "PLAN", icon: CalendarRange, title: "Planification", desc: "Cut, gain, recomp, diet break — la bonne phase au bon moment." },
] as const;

const STEPS = [
  { n: "01", title: "Calibrage", desc: "Onboarding précis : morphologie, %MG, niveau, environnement, objectif. Le coach calcule ton TDEE (Katch-McArdle si %MG connu)." },
  { n: "02", title: "Plan généré", desc: "Nutrition + entraînement + cardio personnalisés, avec la justification scientifique de chaque choix." },
  { n: "03", title: "Coach quotidien", desc: "ORACLE.IA suit tes logs, répond à tes questions, ajuste le plan quand les données le demandent." },
  { n: "04", title: "Suivi data", desc: "Poids, mensurations, PR, hydratation, sommeil, HRV, cycle — tout alimente les recommandations." },
] as const;

const FEATURES = [
  { title: "Plan nutritionnel détaillé", desc: "Cible kcal, macros, repas avec grammages et équivalences. Pas de plan inapplicable." },
  { title: "Programme d'entraînement", desc: "Split adapté à ton niveau et ton matériel, séances loggables set par set." },
  { title: "Coach conversationnel", desc: "Un vrai dialogue, pas un chatbot scripté. Il mémorise, recadre, te challenge." },
  { title: "Suivi corporel complet", desc: "Photos, mensurations, records de force, hydratation, sommeil, HRV." },
  { title: "Fondé sur la science", desc: "Helms, Garthe, Phillips, Katch-McArdle — les sources sont citées, pas inventées." },
  { title: "Données en Europe, RGPD", desc: "Export et suppression à tout moment. Tes données santé restent les tiennes." },
] as const;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 10,
        letterSpacing: "0.3em",
        color: "var(--accent-tech)",
        textTransform: "uppercase",
        opacity: 0.9,
      }}
    >
      {children}
    </span>
  );
}

export function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAuthed = !loading && !!user && !user.isAnonymous;

  const primaryHref = isAuthed ? "/dashboard" : "/login";
  const primaryLabel = isAuthed ? "Accéder à mon espace" : "Commencer";

  return (
    <main className="flex-1 w-full" style={{ position: "relative", zIndex: 1 }}>
      {/* ── Top nav ───────────────────────────────────────────── */}
      <header className="w-full border-b" style={{ borderColor: "var(--glass-border)" }}>
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Wordmark size={18} />
          <div className="flex items-center gap-3">
            {!isAuthed && (
              <Link
                href="/login"
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--fg-3)",
                  padding: "8px 10px",
                }}
              >
                Se connecter
              </Link>
            )}
            <Link href={primaryHref} className="btn btn-primary mono" style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              {primaryLabel}
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 text-center">
        <div className="inline-flex mb-6">
          <Tag accent="tech">● ORACLE.IA · EN LIGNE</Tag>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 900,
            fontSize: "clamp(2.5rem, 7vw, 5rem)",
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
            color: "var(--fg-1)",
            margin: "0 auto",
            maxWidth: 900,
          }}
        >
          Pas de rêve.<br />
          <span style={{ color: "var(--gold-400)", textShadow: "0 0 24px var(--gold-tint-15)" }}>
            Des résultats.
          </span>
        </h1>
        <p
          style={{
            marginTop: 24,
            fontSize: "clamp(1rem, 2.2vw, 1.25rem)",
            lineHeight: 1.6,
            color: "var(--fg-3)",
            maxWidth: 620,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Un coach IA de recomposition corporelle qui calibre ton plan sur tes vraies
          données, cite ses sources et t'ajuste au fil des semaines. Sans bullshit,
          sans moralisation.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={primaryHref}
            className="btn btn-primary mono"
            style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", padding: "14px 28px", display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            {primaryLabel} <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#comment"
            className="btn btn-ghost mono"
            style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", padding: "14px 24px", display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            Comment ça marche <ChevronDown className="w-4 h-4" />
          </a>
        </div>
        <p className="mono mt-6" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--fg-4)", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <Lock className="w-3 h-3" aria-hidden="true" /> Hébergé en Europe · RGPD · Export & suppression à tout moment
        </p>
      </section>

      {/* ── Stats band ────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { num: "8", label: "Agents spécialisés" },
            { num: "100%", label: "Personnalisé" },
            { num: "RAG", label: "Sources scientifiques" },
            { num: "0", label: "Régime miracle" },
          ].map((s) => (
            <HudCard key={s.label} accent="gold" chamfer="sm" corners={false} style={{ padding: "1rem", textAlign: "center" }}>
              <div className="stat-num gold" style={{ fontSize: "2rem", lineHeight: 1 }}>{s.num}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--fg-4)", marginTop: 6 }}>{s.label}</div>
            </HudCard>
          ))}
        </div>
      </section>

      {/* ── Problème / réponse ────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">
        <SectionEyebrow>[LE CONSTAT]</SectionEyebrow>
        <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.4rem)", color: "var(--fg-1)", margin: "12px auto 0", maxWidth: 720, lineHeight: 1.15 }}>
          Les apps fitness te donnent un chiffre. Pas un raisonnement.
        </h2>
        <p style={{ marginTop: 16, fontSize: "1.05rem", lineHeight: 1.65, color: "var(--fg-3)", maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
          Compteur de calories générique, plan figé, motivation copiée-collée. NoDream
          part de ta physiologie réelle, t'explique <em>pourquoi</em> chaque décision est
          prise, et corrige le tir quand tes données changent.
        </p>
      </section>

      {/* ── ORACLE.IA multi-agent ─────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <SectionEyebrow>[ORACLE.IA · ARCHITECTURE]</SectionEyebrow>
          <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.4rem)", color: "var(--fg-1)", margin: "12px auto 0", maxWidth: 720, lineHeight: 1.15 }}>
            Un coach, huit spécialistes
          </h2>
          <p style={{ marginTop: 14, fontSize: "1rem", lineHeight: 1.6, color: "var(--fg-3)", maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
            Un superviseur oriente ta question vers les bons experts, puis synthétise une
            réponse unique. Chacun a son domaine, ses garde-fous et ses sources.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SUB_AGENTS.map((a) => {
            const Icon = a.icon;
            return (
              <HudCard key={a.code} accent="tech" chamfer="sm" style={{ padding: "1.1rem" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "var(--ink-900)", border: "1px solid var(--accent-tech-tint)", color: "var(--accent-tech)" }}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <span className="mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--accent-tech)", textTransform: "uppercase" }}>[{a.code}]</span>
                </div>
                <h3 style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, color: "var(--fg-1)", margin: "0 0 4px 0" }}>{a.title}</h3>
                <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-3)", margin: 0 }}>{a.desc}</p>
              </HudCard>
            );
          })}
        </div>
      </section>

      {/* ── Comment ça marche ─────────────────────────────────── */}
      <section id="comment" className="max-w-5xl mx-auto px-4 sm:px-6 py-12" style={{ scrollMarginTop: 80 }}>
        <div className="text-center mb-10">
          <SectionEyebrow>[PROTOCOLE]</SectionEyebrow>
          <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.4rem)", color: "var(--fg-1)", margin: "12px auto 0", lineHeight: 1.15 }}>
            Comment ça marche
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STEPS.map((s) => (
            <HudCard key={s.n} accent="gold" chamfer="sm" style={{ padding: "1.25rem", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <span className="stat-num gold" style={{ fontSize: "1.8rem", lineHeight: 1, flexShrink: 0 }}>{s.n}</span>
              <div>
                <h3 style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 16, color: "var(--fg-1)", margin: "0 0 6px 0" }}>{s.title}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--fg-3)", margin: 0 }}>{s.desc}</p>
              </div>
            </HudCard>
          ))}
        </div>
      </section>

      {/* ── Fonctionnalités ───────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <SectionEyebrow>[CAPACITÉS]</SectionEyebrow>
          <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.4rem)", color: "var(--fg-1)", margin: "12px auto 0", lineHeight: 1.15 }}>
            Tout ce qu'il te faut, au même endroit
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <HudCard key={f.title} accent="none" corners={false} chamfer="sm" style={{ padding: "1.25rem", border: "1px solid var(--glass-border)" }}>
              <h3 style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, color: "var(--gold-400)", margin: "0 0 6px 0" }}>{f.title}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fg-3)", margin: 0 }}>{f.desc}</p>
            </HudCard>
          ))}
        </div>
      </section>

      {/* ── Science / disclaimer ──────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <HudCard accent="tech" chamfer="md" style={{ padding: "1.75rem" }}>
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 flex-shrink-0" style={{ color: "var(--accent-tech)", marginTop: 2 }} aria-hidden="true" />
            <div>
              <SectionEyebrow>[BASE SCIENTIFIQUE]</SectionEyebrow>
              <p style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-2)" }}>
                Les recommandations s'appuient sur la littérature (Helms 2014, Garthe 2011,
                Phillips 2011, Aragon &amp; Schoenfeld 2013, formule Katch-McArdle). Quand
                une source est utilisée, elle est citée — jamais inventée.
              </p>
              <p style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.55, color: "var(--fg-4)" }}>
                <strong style={{ color: "var(--fg-3)" }}>[NON MÉDICAL]</strong> — NoDream est
                un outil de coaching sportif et nutritionnel, pas un dispositif médical. Il ne
                pose aucun diagnostic et ne remplace pas l'avis d'un professionnel de santé.
              </p>
            </div>
          </div>
        </HudCard>
      </section>

      {/* ── CTA final ─────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="flex justify-center mb-5"><BrandMark size={48} /></div>
        <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 900, fontSize: "clamp(1.8rem, 5vw, 3rem)", color: "var(--fg-1)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          Prêt à arrêter de deviner ?
        </h2>
        <p style={{ marginTop: 16, fontSize: "1.05rem", lineHeight: 1.6, color: "var(--fg-3)", maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
          Ton premier plan est calibré dès la fin de l'onboarding. Tu ajustes ensuite avec
          le coach, semaine après semaine.
        </p>
        <div className="mt-8">
          <button
            type="button"
            onClick={() => router.push(primaryHref)}
            className="btn btn-primary mono"
            style={{ fontSize: 14, letterSpacing: "0.2em", textTransform: "uppercase", padding: "16px 36px", display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            {primaryLabel} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: "var(--glass-border)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <Wordmark size={16} />
          <div className="flex items-center gap-5 mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            <Link href="/legal/terms" style={{ color: "var(--fg-4)" }}>Conditions</Link>
            <Link href="/legal/privacy" style={{ color: "var(--fg-4)" }}>Confidentialité</Link>
            <Link href="/login" style={{ color: "var(--fg-4)" }}>Se connecter</Link>
          </div>
          <span className="mono" style={{ fontSize: 10, letterSpacing: "0.15em", color: "var(--fg-5)", textTransform: "uppercase" }}>
            © {new Date().getFullYear()} NoDream · Europe
          </span>
        </div>
      </footer>
    </main>
  );
}
