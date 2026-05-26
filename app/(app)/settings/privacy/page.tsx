"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks';
import { auth } from '@/lib/firebase/client';
import { reauthenticateWithPopup, GoogleAuthProvider, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Download, Trash2, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function PrivacyPage() {
  const router = useRouter();
  const { user, getFreshToken, logout } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showDeleteFlow, setShowDeleteFlow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const res = await fetch('/api/user/export', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export RGPD échoué.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nodream-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message ?? "Impossible d'exporter tes données.");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!user || confirmText !== 'EFFACER') {
      setError("Tape EFFACER en majuscules pour confirmer.");
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      // Reauth required by Cloud Function dataExportPurge (< 5min).
      // Wave 11C — detect provider so we don't hardcode Google. Users who
      // signed up via email/password get a password prompt; others fall
      // through and the server's 5-min freshness check handles them.
      const providerId = user.providerData[0]?.providerId;
      if (providerId === 'google.com') {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      } else if (providerId === 'password') {
        const pwd = window.prompt('Confirme ton mot de passe pour supprimer ton compte :');
        if (!pwd) {
          setDeleting(false);
          return;
        }
        const cred = EmailAuthProvider.credential(user.email ?? '', pwd);
        await reauthenticateWithCredential(user, cred);
      }
      // Anonymous + other providers: skip client-side reauth, rely on server.

      const token = await getFreshToken();
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmText: 'EFFACER' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Suppression échouée.');
      }
      await logout();
      router.push('/login?deleted=1');
    } catch (e: any) {
      setError(e.message ?? "Impossible de supprimer ton compte.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full space-y-6">
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">Confidentialité & RGPD</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="font-serif text-lg">Tes droits RGPD</CardTitle>
          </div>
          <CardDescription>
            Tu peux à tout moment télécharger l&apos;intégralité de tes données ou demander leur suppression définitive (Article 17 du RGPD).
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base flex items-center space-x-2">
            <Download className="h-4 w-4 text-primary" />
            <span>Exporter mes données</span>
          </CardTitle>
          <CardDescription>
            Reçois un fichier JSON contenant ton profil, tes check-ins, tes plans, ton historique coach, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting} className="w-full">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Télécharger mon export'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader>
          <CardTitle className="font-serif text-base flex items-center space-x-2 text-red-700 dark:text-red-300">
            <Trash2 className="h-4 w-4" />
            <span>Supprimer mon compte</span>
          </CardTitle>
          <CardDescription className="text-red-900/70 dark:text-red-100/70">
            Suppression définitive de toutes tes données (Firestore + Storage + abonnement Stripe annulé). Cette action est irréversible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!showDeleteFlow ? (
            <Button
              variant="outline"
              onClick={() => setShowDeleteFlow(true)}
              className="w-full border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-500/10"
            >
              Initier la suppression
            </Button>
          ) : (
            <>
              <div className="flex items-start space-x-2 text-xs text-red-900/80 dark:text-red-100/80">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  Tu vas être déconnecté(e), puis devras te reconnecter avec Google pour confirmer ton identité (RGPD reauth obligatoire dans les 5 minutes).
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm" className="text-xs">
                  Tape <code className="bg-red-500/10 px-1 rounded">EFFACER</code> pour confirmer
                </Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="EFFACER"
                  autoComplete="off"
                />
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowDeleteFlow(false); setConfirmText(''); setError(null); }}>
                  Annuler
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleting || confirmText !== 'EFFACER'}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer définitivement'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
