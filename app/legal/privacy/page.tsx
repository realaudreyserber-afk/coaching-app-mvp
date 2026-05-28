/**
 * /legal/privacy — Politique de confidentialité RGPD (stub).
 *
 * Page publique. Linkée depuis /login (footer RGPD).
 * Stub assurant que le lien est cliquable (conformité audit 2026-05-28).
 * Texte légal complet à intégrer par DPO / juriste.
 */

import Link from 'next/link';

export const metadata = {
  title: 'Politique de confidentialité RGPD · NoDream',
  description: 'Traitement des données personnelles sur NoDream coaching.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed">
      <Link href="/login" className="text-sm text-gray-500 hover:underline">
        ← Retour à la connexion
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Politique de confidentialité RGPD</h1>
      <p className="mt-2 text-xs text-gray-500">
        Dernière mise à jour : à compléter par DPO.
      </p>

      <section className="mt-8 space-y-4">
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          ⚠ Texte légal en cours de finalisation. Tu peux dès maintenant exercer
          tes droits RGPD (export + suppression) depuis{' '}
          <Link href="/settings/privacy" className="underline">tes paramètres privacy</Link>{' '}
          (après connexion).
        </p>

        <h2 className="text-lg font-semibold">1. Responsable du traitement</h2>
        <p>NoDream — coordonnées à compléter.</p>

        <h2 className="text-lg font-semibold">2. Données collectées</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Identité</strong> : email, nom, âge, sexe.</li>
          <li><strong>Données corporelles</strong> : poids, taille, mensurations, BF estimé.</li>
          <li><strong>Données santé</strong> : objectifs, antécédents, médicaments, bloodwork uploadé.</li>
          <li><strong>Données d'usage</strong> : check-ins quotidiens, food logs, séances, conversations coach.</li>
          <li><strong>Cycle menstruel</strong> (utilisatrices) : phases, symptômes, contraception.</li>
          <li><strong>Wearables</strong> : steps, sommeil, HRV (si connecté Google Fit / Apple Health).</li>
        </ul>

        <h2 className="text-lg font-semibold">3. Finalités</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Fournir un coaching personnalisé.</li>
          <li>Adapter les recommandations à ton profil physiologique et psychologique.</li>
          <li>Archiver tes sessions coach pour audit et amélioration continue.</li>
          <li>Améliorer le service (anonymisation préalable).</li>
        </ul>

        <h2 className="text-lg font-semibold">4. Base légale</h2>
        <p>
          Consentement (art. 6.1.a RGPD) pour le traitement, y compris des données de santé (art. 9.2.a).
          Tu peux retirer ton consentement à tout moment via la suppression de compte.
        </p>

        <h2 className="text-lg font-semibold">5. Sous-traitants</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Google Firebase</strong> (hébergement, auth, base de données) — UE.</li>
          <li><strong>Google Vertex AI / Gemini</strong> (modèle IA) — UE (europe-west1).</li>
          <li><strong>Vercel</strong> (hébergement frontend) — UE.</li>
          <li><strong>Stripe</strong> (paiement, si abonnement) — UE.</li>
        </ul>

        <h2 className="text-lg font-semibold">6. Durée de conservation</h2>
        <p>
          Tant que ton compte est actif. Suppression effective sous 30 jours après demande, sauf
          obligations légales (facturation : 10 ans).
        </p>

        <h2 className="text-lg font-semibold">7. Tes droits</h2>
        <p>
          Accès, rectification, effacement, portabilité, opposition. Exerçables via{' '}
          <Link href="/settings/privacy" className="underline">/settings/privacy</Link> (après connexion)
          ou par email à <a href="mailto:dpo@nodream.app" className="underline">dpo@nodream.app</a>.
        </p>

        <h2 className="text-lg font-semibold">8. Réclamation</h2>
        <p>
          Tu peux déposer une réclamation auprès de la CNIL :{' '}
          <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer" className="underline">
            cnil.fr/fr/plaintes
          </a>
          .
        </p>
      </section>
    </div>
  );
}
