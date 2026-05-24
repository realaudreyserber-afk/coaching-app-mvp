"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Bell, BellOff, Check } from 'lucide-react';

type NotifCategory =
  | 'checkin_reminder'
  | 'fasting_window'
  | 'micro_task'
  | 'plateau_alert'
  | 'milestone'
  | 'streak_at_risk';

interface CategoryConfig {
  id: NotifCategory;
  label: string;
  description: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'checkin_reminder',
    label: 'Rappel check-in quotidien',
    description: '8h / 20h si tu n\'as pas encore loggé ta journée.',
  },
  {
    id: 'fasting_window',
    label: 'Fenêtre de jeûne intermittent',
    description: 'Alerte 30 min avant la fin de ton jeûne.',
  },
  {
    id: 'micro_task',
    label: 'Micro-tâche du jour',
    description: 'Une action concrète à valider chaque matin.',
  },
  {
    id: 'plateau_alert',
    label: 'Plateau détecté',
    description: 'Quand ton poids stagne sur 2 semaines (1×/sem max).',
  },
  {
    id: 'milestone',
    label: 'Étapes franchies (kg perdus)',
    description: 'Notification factuelle tous les 5 kg.',
  },
  {
    id: 'streak_at_risk',
    label: 'Série de check-ins en danger',
    description: 'Si tu vas perdre une série de 7+ jours.',
  },
];

export default function NotificationsSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [optOut, setOptOut] = useState<Set<NotifCategory>>(new Set());
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission | null>(null);
  const [savedRecently, setSavedRecently] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPerm(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data();
        setGlobalEnabled(data?.settings?.notifications !== false);
        const out: NotifCategory[] = data?.settings?.notification_opt_out ?? [];
        setOptOut(new Set(out));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const toggleCategory = (cat: NotifCategory) => {
    setOptOut((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const requestBrowserPerm = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setBrowserPerm(perm);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          settings: {
            notifications: globalEnabled,
            notification_opt_out: Array.from(optOut),
            notification_settings_updated_at: new Date().toISOString(),
          },
        },
        { merge: true }
      );
      setSavedRecently(true);
      setTimeout(() => setSavedRecently(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full space-y-6">
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">Notifications</h1>
      </div>

      {browserPerm !== 'granted' && (
        <Card className="border-orange-light/30 bg-orange-light/5">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <BellOff className="h-5 w-5 text-orange-light" />
              <CardTitle className="font-serif text-base">Notifications navigateur désactivées</CardTitle>
            </div>
            <CardDescription>
              Pour recevoir les rappels, autorise les notifications dans ton navigateur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={requestBrowserPerm} className="w-full">
              Autoriser les notifications
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="font-serif text-base">Master switch</CardTitle>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={globalEnabled}
              onClick={() => setGlobalEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                globalEnabled ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  globalEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <CardDescription>
            {globalEnabled
              ? 'Coupe ici pour suspendre toutes les notifications sans rien désinstaller.'
              : 'Toutes les notifications sont actuellement suspendues.'}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-base">Catégories</CardTitle>
          <CardDescription>
            Choisis quelles notifications tu veux recevoir. Tout est activé par défaut.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CATEGORIES.map((cat) => {
            const enabled = !optOut.has(cat.id);
            const disabled = !globalEnabled;
            return (
              <div
                key={cat.id}
                className={`flex items-start justify-between gap-3 ${disabled ? 'opacity-40' : ''}`}
              >
                <div className="flex-1 space-y-0.5">
                  <Label className="text-sm font-medium">{cat.label}</Label>
                  <p className="text-xs text-muted-foreground leading-snug">{cat.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  disabled={disabled}
                  onClick={() => toggleCategory(cat.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full flex-shrink-0 transition-colors ${
                    enabled ? 'bg-primary' : 'bg-border'
                  } ${disabled ? 'cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full h-11">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : savedRecently ? (
          <>
            <Check className="h-4 w-4 mr-2" /> Enregistré
          </>
        ) : (
          'Enregistrer mes préférences'
        )}
      </Button>
    </div>
  );
}
