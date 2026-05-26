/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks';
import { flags } from '@/lib/features/flags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Video, Loader2, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { FormCheckResult } from '@/lib/features/form-check/schema';

export default function FormCheckPage() {
  const router = useRouter();
  const { getFreshToken } = useAuth();
  
  const [isFlagActive, setIsFlagActive] = useState<boolean | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<FormCheckResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsFlagActive(flags.formCheck());
  }, []);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Constrain to typical size/duration (e.g. 50MB max as sanity check)
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg("Le fichier vidéo est trop volumineux (max 50 Mo).");
      return;
    }

    setVideoFile(file);
    setErrorMsg(null);
    setResult(null);

    const url = URL.createObjectURL(file);
    setVideoPreview(url);
  };

  const handleAnalyze = async () => {
    if (!videoFile) return;
    setAnalyzing(true);
    setErrorMsg(null);

    try {
      const token = await getFreshToken();
      if (!token) {
        throw new Error('Authentification requise');
      }

      // Convert video file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
      });
      reader.readAsDataURL(videoFile);
      
      const base64Data = await base64Promise;
      const mimeType = videoFile.type || 'video/mp4';

      const res = await fetch('/api/exercise/form-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          videoBase64: base64Data,
          mimeType
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erreur lors de l\'analyse.');
      }

      const data = await res.json();
      setResult(data.analysis);
    } catch (err: any) {
      console.error('Video analysis error:', err);
      setErrorMsg(err.message || 'Impossible d\'analyser ta vidéo. Assure-toi qu\'elle dure moins de 30 secondes et réessaie.');
    } finally {
      setAnalyzing(false);
    }
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
              L'analyse technique vidéo n'est pas encore disponible dans ta zone.
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
    <div className="flex-1 flex flex-col bg-background p-4 max-w-md mx-auto w-full space-y-6">
      
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold text-foreground">Form Check Vidéo</h1>
      </div>

      <div className="space-y-4">
        
        {/* Upload & Instructions */}
        {!videoPreview ? (
          <Card className="border-dashed border-2 border-border bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Video className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold font-serif">Analyse ton mouvement</h3>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                  Importe ou filme une vidéo brute de ton exécution (moins de 30 secondes). Notre coach biomécanique analysera tes placements, angles et ta sécurité.
                </p>
              </div>
              
              <div className="text-left bg-card/80 p-3 rounded-lg border border-border text-[11px] space-y-1.5 max-w-xs">
                <div className="font-bold text-foreground font-serif">Consignes de prise de vue :</div>
                <div className="text-muted-foreground">• Place l'appareil de profil ou à 45°.</div>
                <div className="text-muted-foreground">• Cadre l'intégralité du mouvement (tête aux pieds).</div>
                <div className="text-muted-foreground">• Évite les vêtements trop amples si possible.</div>
              </div>
              
              <label className="cursor-pointer pt-2">
                <span className="bg-primary text-white hover:bg-primary/95 h-11 px-6 rounded-md font-medium text-sm flex items-center justify-center transition-colors">
                  Sélectionner une vidéo
                </span>
                <input 
                  type="file" 
                  accept="video/*" 
                  onChange={handleVideoChange} 
                  className="hidden" 
                />
              </label>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-border aspect-[9/16] max-h-[350px] bg-black mx-auto">
              <video 
                src={videoPreview} 
                controls 
                className="w-full h-full object-contain"
              />
            </div>
            
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => { setVideoFile(null); setVideoPreview(null); setResult(null); setErrorMsg(null); }}
                disabled={analyzing}
                className="flex-1"
              >
                Changer de vidéo
              </Button>
              {!result && !analyzing && (
                <Button 
                  onClick={handleAnalyze}
                  className="flex-1"
                >
                  Lancer l'analyse
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Loading state */}
        {analyzing && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-serif text-center">
              Analyse de la vidéo brute en cours...<br />
              <span className="text-xs">Le traitement biomécanique peut prendre jusqu'à 30 secondes.</span>
            </p>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <Card className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300">
            <CardContent className="flex items-start space-x-3 p-4">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Échec de l'analyse</h4>
                <p className="text-xs">{errorMsg}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results view */}
        {result && (
          <div className="space-y-4">
            
            {/* Score & Name Card */}
            <Card className="border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Exercice détecté</div>
                  <div className="text-lg font-bold font-serif text-foreground">{result.exercise}</div>
                </div>
                
                {/* Score Badge */}
                <div className="flex flex-col items-center">
                  <div className={`h-14 w-14 rounded-full flex items-center justify-center font-bold text-lg font-mono text-white ${
                    result.score >= 8 ? 'bg-green-600' : result.score >= 6 ? 'bg-amber-600' : 'bg-red-600'
                  }`}>
                    {result.score}/10
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">Technique</span>
                </div>
              </CardContent>
            </Card>

            {/* Safety Alerts Callout */}
            {result.safetyAlerts.length > 0 && (
              <Card className="border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-400">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center space-x-2 font-bold font-serif text-sm text-red-600 dark:text-red-400">
                    <ShieldAlert className="h-5 w-5" />
                    <span>ALERTE SÉCURITÉ</span>
                  </div>
                  <ul className="list-disc list-inside text-xs space-y-1 pl-1">
                    {result.safetyAlerts.map((alert, i) => (
                      <li key={i}>{alert}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Observations Card */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-serif">Observations techniques</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4">
                  {result.observations.map((obs, i) => (
                    <li key={i}>{obs}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Recommendations Card */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-serif">Corrections recommandées</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Medical Disclaimer */}
            <div className="text-[10px] text-muted-foreground leading-relaxed text-center px-4 pt-2">
              <strong>Avertissement :</strong> Ce diagnostic biomécanique automatisé est fourni à titre indicatif et éducatif. Il ne remplace pas l'encadrement par un professionnel du sport ou du corps médical. Ne tente pas d'exécuter des charges lourdes en cas de doute technique.
            </div>
            
            <Button 
              onClick={() => { setVideoFile(null); setVideoPreview(null); setResult(null); setErrorMsg(null); }}
              className="w-full h-11"
            >
              Analyser un autre mouvement
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
