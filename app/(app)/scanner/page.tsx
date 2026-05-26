/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { flags } from '@/lib/features/flags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Camera, Loader2, CheckCircle, AlertTriangle, Sparkles, User, RefreshCw } from 'lucide-react';

export default function BodyScannerPage() {
  const router = useRouter();
  const { user, getFreshToken } = useAuth();
  
  const [isFlagActive, setIsFlagActive] = useState<boolean | null>(null);
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]); // [front, back, left, right]
  const [mimeTypes, setMimeTypes] = useState<(string | null)[]>([null, null, null, null]);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [historyReports, setHistoryReports] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const viewNames = ['Face', 'Dos', 'Profil Gauche', 'Profil Droit'];

  useEffect(() => {
    setIsFlagActive(flags.bodyScanner());
  }, []);

  // Fetch previous scans history
  useEffect(() => {
    if (!user || isFlagActive === false) return;
    
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const scansRef = collection(db, 'users', user.uid, 'body_scans');
        const q = query(scansRef, orderBy('createdAt', 'desc'), limit(5));
        const snap = await getDocs(q);

        const loaded: any[] = [];
        snap.forEach((doc) => {
          loaded.push({
            date: doc.id,
            ...doc.data()
          });
        });
        setHistoryReports(loaded);
        if (loaded.length > 0 && !report) {
          // Default display last scan report
          setReport(loaded[0]);
        }
      } catch (err) {
        console.error('Error fetching body scan history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, [user, isFlagActive, report]);

  const handleImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImages(prev => {
        const updated = [...prev];
        updated[index] = reader.result as string;
        return updated;
      });
      setMimeTypes(prev => {
        const updated = [...prev];
        updated[index] = file.type;
        return updated;
      });
    };
    reader.readAsDataURL(file);
    setErrorMsg(null);
  };

  const handleAnalyze = async () => {
    // Ensure all 4 images are uploaded
    if (images.some(img => img === null)) {
      setErrorMsg('Tu dois fournir les 4 photos requises pour démarrer le scan.');
      return;
    }

    setAnalyzing(true);
    setErrorMsg(null);

    // Extract raw base64 data for all 4 images
    const base64Images = images.map(img => img!.split(',')[1]);

    try {
      const token = await getFreshToken();
      if (!token) {
        throw new Error('Authentification requise');
      }

      const res = await fetch('/api/scanner/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          images: base64Images,
          mimeTypes
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erreur lors de l\'analyse morphologique.');
      }

      const data = await res.json();
      setReport({
        date: data.date,
        ...data.analysis
      });
      setImages([null, null, null, null]); // clear uploads
      setMimeTypes([null, null, null, null]);
    } catch (err: any) {
      console.error('Body scan analysis error:', err);
      setErrorMsg(err.message || 'L\'analyse corporelle a échoué. Vérifie la qualité des clichés.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setImages([null, null, null, null]);
    setMimeTypes([null, null, null, null]);
    setErrorMsg(null);
  };

  if (isFlagActive === null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Feature flag check
  if (!isFlagActive) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-6 bg-background text-center space-y-6">
        <Card className="max-w-md w-full border-border">
          <CardHeader className="space-y-2">
            <span className="mono" style={{fontSize:10,letterSpacing:'0.3em',color:'var(--accent-tech)',textTransform:'uppercase',display:'inline-block',padding:'4px 10px',border:'1px solid var(--accent-tech)',fontWeight:700}}>[BETA]</span>
            <CardTitle className="text-2xl font-serif">Module en cours de déploiement</CardTitle>
            <CardDescription>
              Le comparateur morpho et Body Scanner photo n'est pas encore disponible dans ta zone.
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
    <div className="flex-1 flex flex-col bg-background p-4 max-w-md mx-auto w-full space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-serif font-bold text-foreground">Body Scanner Photo IA</h1>
        </div>
        {report && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-primary space-x-1">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Nouveau scan</span>
          </Button>
        )}
      </div>

      {/* Main scanner view */}
      {!report && !analyzing && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-base font-serif font-semibold">Prends 4 photos standardisées</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pour des résultats optimaux, porte des vêtements ajustés, tiens-toi droit sur un fond uniforme et utilise un bon éclairage.
            </p>
          </div>

          {/* Grid of 4 photos */}
          <div className="grid grid-cols-2 gap-4">
            {viewNames.map((name, index) => (
              <div key={index} className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block text-[10px] text-center">{name}</span>
                
                <label className="relative block aspect-[3/4] border-2 border-dashed border-border rounded-xl overflow-hidden bg-card/40 hover:border-primary/50 transition-all cursor-pointer">
                  {images[index] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={images[index]!} 
                      alt={name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 space-y-2">
                      <Camera className="h-6 w-6 text-muted-foreground/80" />
                      <span className="text-[10px] text-muted-foreground">Ajouter la photo</span>
                      
                      {/* Standard Body posture guide SVG */}
                      <svg className="w-1/2 h-1/2 text-muted-foreground/10 absolute opacity-30 pointer-events-none" viewBox="0 0 100 100" fill="currentColor">
                        <path d="M50 15c3.3 0 6-2.7 6-6s-2.7-6-6-6-6 2.7-6 6 2.7 6 6 6zm12 12c-2.2 0-7.8-.5-12-.5s-9.8.5-12 .5c-3 0-5 2-5 5v24c0 1.7 1.3 3 3 3h2v34c0 2.2 1.8 4 4 4h16c2.2 0 4-1.8 4-4V49h2c1.7 0 3-1.3 3-3V32c0-3-2-5-5-5z" />
                      </svg>
                    </div>
                  )}
                  
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(index, e)}
                    className="hidden"
                  />
                </label>
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-500/20 font-serif">
              {errorMsg}
            </div>
          )}

          <Button 
            onClick={handleAnalyze} 
            disabled={images.some(img => img === null)}
            className="w-full h-11"
          >
            Lancer l'analyse silhouette
          </Button>

          {/* History selection */}
          {historyReports.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border/50">
              <div className="text-xs font-semibold text-muted-foreground uppercase">Historique de tes scans</div>
              <div className="grid gap-2">
                {historyReports.map((h, hIdx) => (
                  <button
                    key={hIdx}
                    onClick={() => setReport(h)}
                    className="flex justify-between items-center p-3 rounded-lg border border-border bg-card hover:border-primary/40 transition-all text-xs"
                  >
                    <span className="font-semibold">Scan du {h.date}</span>
                    <span className="text-primary font-bold font-serif">{h.bf_pct_estimated}% BF</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analyzing state sweep animation */}
      {analyzing && (
        <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
          <div className="relative w-44 aspect-[3/4] border border-primary/30 rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
            {/* Outline body logo inside */}
            <User className="h-24 w-24 text-primary/20 animate-pulse" />
            {/* Green horizontal scan bar sweeping up and down */}
            <div className="absolute left-0 right-0 h-1 bg-primary/80 shadow-[0_0_15px_#ff7b00] animate-[bounce_3s_infinite]" />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif font-bold text-lg">Morpho-Analyse en cours...</h3>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Gemini Pro compare tes photos actuelles avec tes scans précédents pour cartographier tes progrès musculaires et posturaux.
            </p>
          </div>
        </div>
      )}

      {/* Scan Results View */}
      {report && !analyzing && (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
          
          {/* Main estimation summary card */}
          <Card className="border-border bg-card shadow-lg text-center overflow-hidden">
            <div className="bg-primary/5 p-6 border-b border-border space-y-2">
              <div className="text-[10px] text-primary uppercase font-bold tracking-widest">Masse Grasse Estimée</div>
              <div className="text-5xl font-serif font-extrabold text-primary">{report.bf_pct_estimated}%</div>
              <div className="text-[10px] text-muted-foreground">Calculé sur la base de tes repères anthropométriques visuels</div>
            </div>
            
            <CardContent className="p-4 space-y-4 text-left">
              {/* Morphology Notes */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Notes Morphologiques
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground leading-relaxed">
                  {report.morphology_notes.map((note: string, idx: number) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>

              {/* Posture observations */}
              <div className="space-y-2 pt-3 border-t border-border/50">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-orange-light" /> Alignement Postural
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground leading-relaxed">
                  {report.posture_observations.map((obs: string, idx: number) => (
                    <li key={idx}>{obs}</li>
                  ))}
                </ul>
              </div>

              {/* Asymmetries if present */}
              {report.asymmetries && report.asymmetries.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-border/50">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Asymétries Musculaires</h4>
                  <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground leading-relaxed">
                    {report.asymmetries.map((asym: string, idx: number) => (
                      <li key={idx}>{asym}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Changes versus previous scan */}
              {report.changes_vs_previous && report.changes_vs_previous.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-border/50 bg-primary/5 p-3 rounded-lg border border-primary/10">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Évolution constatée</h4>
                  <ul className="list-disc pl-4 space-y-1 text-xs text-foreground/90 leading-relaxed font-serif italic">
                    {report.changes_vs_previous.map((change: string, idx: number) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
