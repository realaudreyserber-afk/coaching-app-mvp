/**
 * /legal/terms — Conditions Générales d'Utilisation (stub).
 *
 * Page publique (pas d'auth requise). Linkée depuis /login (footer RGPD).
 * Texte légal complet à intégrer par le service juridique — ce stub assure
 * que le lien est cliquable (conformité audit RGPD 2026-05-28).
 */

import Link from 'next/link';

export const metadata = {
  title: 'Conditions Générales d\'Utilisation · NoDream',
  description: 'CGU de l\'application NoDream coaching.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed">
      <Link href="/login" className="text-sm text-gray-500 hover:underline">
        ← Retour à la connexion
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Conditions Générales d'Utilisation</h1>
      <p className="mt-2 text-xs text-gray-500">
        Dernière mise à jour : à compléter par le service juridique.
      </p>

      <section className="mt-8 space-y-4">
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          ⚠ Texte légal en cours de rédaction. Pour toute question, contacte
          le support à <a href="mailto:contact@nodream.app" className="underline">contact@nodream.app</a>.
        </p>

        <h2 className="text-lg font-semibold">1. Objet</h2>
        <p>
          NoDream est une application de coaching en composition corporelle, nutrition et entraînement.
          Elle s'adresse aux personnes majeures cherchant à structurer leur progression santé/performance.
        </p>

        <h2 className="text-lg font-semibold">2. Accès au service</h2>
        <p>
          L'accès nécessite la création d'un compte. L'utilisateur s'engage à fournir des informations
          exactes et à maintenir la confidentialité de ses identifiants.
        </p>

        <h2 className="text-lg font-semibold">3. Coach IA — Limitations</h2>
        <p>
          Le coach IA (ORACLE.IA) fournit des recommandations basées sur des données utilisateur et la
          littérature scientifique. <strong>Il ne constitue PAS un avis médical.</strong> En cas de
          symptômes physiques, troubles alimentaires, dépression ou pathologie chronique, consulte
          immédiatement un professionnel de santé qualifié.
        </p>

        <h2 className="text-lg font-semibold">4. Données personnelles</h2>
        <p>
          Le traitement des données personnelles est régi par notre{' '}
          <Link href="/legal/privacy" className="text-blue-600 underline">
            Politique de confidentialité RGPD
          </Link>
          .
        </p>

        <h2 className="text-lg font-semibold">5. Résiliation</h2>
        <p>
          Tu peux supprimer ton compte à tout moment depuis les paramètres. La suppression entraîne
          la perte définitive de tes données (sauf obligations légales de conservation).
        </p>

        <h2 className="text-lg font-semibold">6. Contact</h2>
        <p>
          Pour toute question relative à ces conditions :{' '}
          <a href="mailto:contact@nodream.app" className="underline">contact@nodream.app</a>.
        </p>
      </section>
    </div>
  );
}
