import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface CheckItem {
  name: string;
  ok: boolean;
  hint: string;
}

function check(name: string, value: string | undefined, hint: string): CheckItem {
  return {
    name,
    ok: Boolean(value && value.length > 0 && !value.startsWith('mock-')),
    hint,
  };
}

export default function SetupPage() {
  const checks: CheckItem[] = [
    check('NEXT_PUBLIC_FIREBASE_API_KEY', process.env.NEXT_PUBLIC_FIREBASE_API_KEY, 'Console Firebase → Project settings → General → SDK setup → Web app config'),
    check('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, 'Format: <project-id>.firebaseapp.com'),
    check('NEXT_PUBLIC_FIREBASE_PROJECT_ID', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'ID du projet Firebase (ex: linsociable-coaching)'),
    check('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, 'Format: <project-id>.appspot.com'),
    check('NEXT_PUBLIC_FIREBASE_APP_ID', process.env.NEXT_PUBLIC_FIREBASE_APP_ID, 'Format: 1:xxxx:web:yyyy'),
    check('FIREBASE_ADMIN_PROJECT_ID', process.env.FIREBASE_ADMIN_PROJECT_ID, 'Identique à NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    check('FIREBASE_ADMIN_CLIENT_EMAIL', process.env.FIREBASE_ADMIN_CLIENT_EMAIL, 'Service Account email — IAM & Admin → Service Accounts'),
    check('FIREBASE_ADMIN_PRIVATE_KEY', process.env.FIREBASE_ADMIN_PRIVATE_KEY, 'Coller la clé COMPLÈTE avec -----BEGIN PRIVATE KEY----- et les vrais retours ligne'),
    check('GEMINI_API_KEY', process.env.GEMINI_API_KEY, 'https://aistudio.google.com/apikey (gratuit). Plus simple que GCP ADC sur Vercel.'),
    check('GOOGLE_CLOUD_PROJECT', process.env.GOOGLE_CLOUD_PROJECT, 'Identique au projet Firebase'),
    check('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL, 'URL publique du déploiement, ex: https://coaching-app-mvp.vercel.app'),
  ];

  const okCount = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const allOk = okCount === total;

  return (
    <main className="min-h-screen bg-cream dark:bg-anthracite px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary">
            Configuration NoDream
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette page apparaît parce que les variables d&apos;environnement Firebase ne sont pas configurées.
            Une fois remplies dans le dashboard Vercel, l&apos;app redirigera automatiquement vers le coaching.
          </p>
        </header>

        <section className="mb-8 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">État des variables</h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                allOk
                  ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                  : 'bg-orange-light/10 text-orange-light'
              }`}
            >
              {okCount} / {total} configurées
            </span>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {checks.map((c) => (
              <li key={c.name} className="py-3 flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-block h-4 w-4 flex-shrink-0 rounded-full ${
                    c.ok ? 'bg-green-500' : 'bg-orange-light/60'
                  }`}
                />
                <div className="flex-1">
                  <code className="text-sm font-mono">{c.name}</code>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-8 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold mb-3">Procédure</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground/90">
            <li>
              Ouvre le projet Vercel →{' '}
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded">Settings → Environment Variables</span>.
            </li>
            <li>
              Récupère les valeurs Firebase depuis la{' '}
              <a className="text-primary underline" href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">
                console Firebase
              </a>
              {' '}→ projet linsociable-coaching → ⚙️ Project settings.
            </li>
            <li>
              Pour <code>FIREBASE_ADMIN_PRIVATE_KEY</code> : génère une clé service account, ouvre le JSON et copie
              la valeur de <code>private_key</code> en gardant les <code>\n</code> ou en les remplaçant par de vrais
              retours ligne dans le UI Vercel.
            </li>
            <li>
              Pour <code>GEMINI_API_KEY</code> : récupère une clé sur{' '}
              <a className="text-primary underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                aistudio.google.com/apikey
              </a>{' '}
              (gratuit jusqu&apos;à 1 500 req/jour).
            </li>
            <li>
              Clique <span className="font-mono bg-muted px-1.5 py-0.5 rounded">Redeploy</span> sur le dernier deployment.
            </li>
            <li>
              Vérifie l&apos;endpoint{' '}
              <Link className="text-primary underline" href="/api/health">
                /api/health
              </Link>{' '}
              — il doit renvoyer <code>status: ok</code>.
            </li>
          </ol>
        </section>

        <section className="mb-8 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold mb-3">Template .env</h2>
          <p className="text-xs text-muted-foreground mb-2">
            Copie-colle dans Vercel → Environment Variables (mode &quot;Bulk Edit&quot;).
          </p>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-[11px] font-mono leading-relaxed">
{`NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=linsociable-coaching.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=linsociable-coaching
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=linsociable-coaching.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
FIREBASE_ADMIN_PROJECT_ID=linsociable-coaching
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxx@linsociable-coaching.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
GOOGLE_CLOUD_PROJECT=linsociable-coaching
VERTEX_AI_LOCATION=europe-west1
GEMINI_API_KEY=
NEXT_PUBLIC_APP_URL=https://coaching-app-mvp.vercel.app
ADMIN_EMAILS=
# Stripe (optionnel)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_MONTHLY=
STRIPE_PRICE_ID_YEARLY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
# Sentry (optionnel)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
# RAG FR (optionnel)
CSE_API_KEY=
CSE_FR_ENGINE_ID=`}
          </pre>
        </section>

        {allOk && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              Configuration complète détectée. {' '}
              <Link href="/dashboard" className="underline font-bold">
                Accéder au dashboard →
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
