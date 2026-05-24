/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { flags } from '@/lib/features/flags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle, Copy, Share2, Users, Gift } from 'lucide-react';
import { generateReferralCode, applyReferralCode } from '@/lib/features/referral/referral-service';

export default function ReferralPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [isFlagActive, setIsFlagActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState(0);
  const [credits, setCredits] = useState(0);

  // Form states
  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsFlagActive(flags.referral());
  }, []);

  useEffect(() => {
    if (isFlagActive === null || !isFlagActive || !user) return;

    const loadReferralData = async () => {
      setLoading(true);
      
      const isMockMode = typeof window !== 'undefined' && window.localStorage.getItem('mock_user') === 'true';
      if (isMockMode) {
        setCode('INSDEV');
        setReferredBy(null);
        setReferredCount(3);
        setCredits(3);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          const refInfo = data.referral;

          if (refInfo?.code) {
            setCode(refInfo.code);
            setReferredBy(refInfo.referredBy || null);
            setReferredCount(refInfo.referredUsers?.length || 0);
            setCredits(refInfo.premiumCredits || 0);
          } else {
            // Generate and save new code
            const newCode = generateReferralCode();
            await updateDoc(userRef, {
              'referral.code': newCode,
              'referral.referredBy': null,
              'referral.referredUsers': [],
              'referral.premiumCredits': 0,
              'referral.updatedAt': new Date().toISOString()
            });
            setCode(newCode);
            setReferredBy(null);
            setReferredCount(0);
            setCredits(0);
          }
        }
      } catch (err) {
        console.error('Error loading referral data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadReferralData();
  }, [isFlagActive, user]);

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim() || !user) return;
    
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const isMockMode = typeof window !== 'undefined' && window.localStorage.getItem('mock_user') === 'true';
    if (isMockMode) {
      setTimeout(() => {
        setReferredBy('mock-referrer-uid');
        setCredits(prev => prev + 1);
        setSuccessMsg("Félicitations ! Code validé, parrainé par Athlète Pro.");
        setSubmitting(false);
      }, 500);
      return;
    }

    try {
      const res = await applyReferralCode(user.uid, inputCode.trim());
      setReferredBy('applied');
      setCredits(prev => prev + 1);
      setSuccessMsg(`Félicitations ! Code validé, tu es parrainé par ${res.referrer_name}.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Impossible de valider ce code de parrainage.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isFlagActive === null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cream px-4 dark:bg-anthracite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Feature flag check
  if (!isFlagActive) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-6 bg-cream dark:bg-anthracite text-center space-y-6">
        <Card className="max-w-md w-full border-border">
          <CardHeader className="space-y-2">
            <span className="text-4xl">🚧</span>
            <CardTitle className="text-2xl font-serif">Module en cours de déploiement</CardTitle>
            <CardDescription>
              Le système de parrainage n'est pas encore disponible dans ta zone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              Retour au Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-cream dark:bg-anthracite p-4 max-w-md mx-auto w-full space-y-6">
      
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold text-foreground">Parrainage Premium</h1>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-serif">Génération de ton code unique...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Main Info Card */}
          <Card className="border-border bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-6 text-center space-y-4">
              <Gift className="h-12 w-12 text-primary mx-auto" />
              <div className="space-y-1">
                <h2 className="text-lg font-bold font-serif text-foreground">Invite tes amis, gagnez du Premium</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Partage ton code unique. Pour chaque ami qui s'inscrit avec ton code, **vous gagnez tous les deux 1 mois d'abonnement Premium offert**.
                </p>
              </div>

              {/* Code display area */}
              <div className="bg-white/80 dark:bg-black/40 border border-border rounded-xl p-3 flex items-center justify-between max-w-xs mx-auto">
                <span className="font-mono text-lg font-bold tracking-widest text-primary pl-2">{code}</span>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="icon" onClick={handleCopyCode} className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {copied && <span className="text-[10px] text-green-600 font-semibold block">Code copié dans le presse-papiers !</span>}
            </CardContent>
          </Card>

          {/* Stats summary */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-border">
              <CardContent className="p-4 flex flex-col items-center text-center space-y-1">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-mono font-bold">{referredCount}</span>
                <span className="text-[10px] text-muted-foreground">Amis parrainés</span>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 flex flex-col items-center text-center space-y-1">
                <Gift className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-mono font-bold">{credits} mois</span>
                <span className="text-[10px] text-muted-foreground">Premium cumulés</span>
              </CardContent>
            </Card>
          </div>

          {/* Apply a referrer code form */}
          {!referredBy ? (
            <Card className="border-border bg-white dark:bg-black/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-serif">Tu as été parrainé par un ami ?</CardTitle>
                <CardDescription className="text-xs">
                  Saisis son code ci-dessous pour activer tes avantages mutuels.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {successMsg && (
                  <div className="flex items-center space-x-2 text-green-700 dark:text-green-300 text-xs p-3 rounded bg-green-500/10 mb-3 border border-green-500/20">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}
                
                {errorMsg && (
                  <div className="flex items-center space-x-2 text-red-700 dark:text-red-300 text-xs p-3 rounded bg-red-500/10 mb-3 border border-red-500/20">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleApplyCode} className="flex space-x-2">
                  <input
                    type="text"
                    required
                    placeholder="Code ami (ex: INSA21)"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-md border border-border bg-transparent text-sm font-mono tracking-wider uppercase focus:outline-none"
                  />
                  <Button type="submit" disabled={submitting} className="h-10 px-4">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Valider'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-500/20 bg-green-500/5 text-green-800 dark:text-green-300">
              <CardContent className="p-4 flex items-center space-x-3 text-xs">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span>Ton compte bénéficie du parrainage actif ! +1 mois Premium offert activé.</span>
              </CardContent>
            </Card>
          )}

        </div>
      )}

    </div>
  );
}
