/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { flags } from '@/lib/features/flags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, Loader2, CheckCircle, AlertTriangle, Activity, Stethoscope } from 'lucide-react';
import { BloodworkAnalysis, BloodworkMarker } from '@/lib/features/bloodwork-upload/schema';

export default function BloodworkUploadPage() {
  const router = useRouter();
  const { user, getFreshToken } = useAuth();
  
  const [isFlagActive, setIsFlagActive] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<BloodworkAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<BloodworkAnalysis[]>([]);

  useEffect(() => {
    setIsFlagActive(flags.bloodworkUpload());
  }, []);

  // Fetch past bloodworks
  useEffect(() => {
    if (isFlagActive === null || !isFlagActive || !user) return;

    const fetchHistory = async () => {
      const isMockMode = typeof window !== 'undefined' && window.localStorage.getItem('mock_user') === 'true';
      if (isMockMode) {
        setHistory([
          {
            date: '2026-05-10',
            markers: [
              { name: 'Ferritine', value: 85, unit: 'µg/L', referenceRange: '30 - 400', status: 'normal' },
              { name: 'Glycémie', value: 0.95, unit: 'g/L', referenceRange: '0.70 - 1.10', status: 'normal' }
            ],
            summary: "Bilan sanguin dans les normes.",
            recommendations: ["Maintiens tes apports actuels."]
          }
        ]);
        return;
      }

      try {
        const q = query(
          collection(db, 'users', user.uid, 'bloodwork'),
          orderBy('date', 'desc'),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => doc.data() as BloodworkAnalysis);
        setHistory(docs);
      } catch (err) {
        console.error('Error fetching bloodwork history:', err);
      }
    };

    fetchHistory();
  }, [isFlagActive, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorMsg("Le document est trop volumineux (max 15 Mo).");
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setSuccessMsg(null);
    setResult(null);

    // If it's an image, we can show a preview, else just name
    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setErrorMsg(null);

    try {
      const token = await getFreshToken();
      if (!token) {
        throw new Error('Authentification requise');
      }

      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
      });
      reader.readAsDataURL(file);
      
      const base64Data = await base64Promise;
      const mimeType = file.type || 'application/pdf';

      const res = await fetch('/api/bloodwork/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileBase64: base64Data,
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
      console.error('Bloodwork OCR error:', err);
      setErrorMsg(err.message || 'Impossible d\'analyser le bilan sanguin. Assure-toi que le document est lisible et au format PDF ou Image.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveResult = async () => {
    if (!user || !result) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await addDoc(collection(db, 'users', user.uid, 'bloodwork'), {
        ...result,
        createdAt: new Date().toISOString()
      });
      setSuccessMsg("L'analyse sanguine a été enregistrée avec succès dans ton historique.");
      setHistory(prev => [result, ...prev].slice(0, 5));
    } catch (err: any) {
      console.error('Save bloodwork error:', err);
      setErrorMsg('Impossible d\'enregistrer les résultats.');
    } finally {
      setSaving(false);
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
              L'analyse de bilan sanguin n'est pas encore disponible dans ta zone.
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
        <h1 className="text-xl font-serif font-bold text-foreground">Bilan Sanguin</h1>
      </div>

      <div className="space-y-4">
        
        {/* File selection */}
        {!file ? (
          <div className="space-y-6">
            <Card className="border-dashed border-2 border-border bg-card/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold font-serif">Importe tes résultats labo</h3>
                  <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                    Dépose ton bilan biologique (PDF ou Image) pour en extraire automatiquement les marqueurs et adapter ton profil sportif.
                  </p>
                </div>
                
                <label className="cursor-pointer pt-2">
                  <span className="bg-primary text-white hover:bg-primary/95 h-11 px-6 rounded-md font-medium text-sm flex items-center justify-center transition-colors">
                    Sélectionner un fichier
                  </span>
                  <input 
                    type="file" 
                    accept="application/pdf,image/*" 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                </label>
              </CardContent>
            </Card>

            {/* Past reports summary */}
            {history.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-serif font-bold text-foreground">Derniers bilans enregistrés</h2>
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <Card key={i} className="border-border cursor-pointer hover:bg-muted/10" onClick={() => setResult(h)}>
                      <CardContent className="p-3 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <Activity className="h-4 w-4 text-primary" />
                          <span className="text-xs font-semibold">Bilan du {h.date}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{h.markers.length} marqueurs</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-xs font-semibold truncate">{file.name}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setFile(null); setFilePreview(null); setResult(null); setErrorMsg(null); setSuccessMsg(null); }}
                  disabled={analyzing}
                  className="text-red-500 hover:text-red-600"
                >
                  Retirer
                </Button>
              </CardContent>
            </Card>

            {filePreview && (
              <div className="relative rounded-xl overflow-hidden border border-border aspect-[4/3] bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={filePreview} 
                  alt="Aperçu du bilan" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {!result && !analyzing && (
              <Button 
                onClick={handleAnalyze}
                className="w-full h-11"
              >
                Lancer l'analyse du bilan
              </Button>
            )}
          </div>
        )}

        {/* Analyzing state */}
        {analyzing && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-serif text-center">
              Extraction des données cliniques...<br />
              <span className="text-xs">Le décodage de ton bilan sanguin peut prendre jusqu'à 30 secondes.</span>
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

        {/* Success Notification */}
        {successMsg && (
          <Card className="border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300">
            <CardContent className="flex items-start space-x-3 p-4">
              <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Bilan enregistré</h4>
                <p className="text-xs">{successMsg}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results View */}
        {result && (
          <div className="space-y-4">
            
            {/* General card */}
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Date du prélèvement</span>
                  <span className="text-sm font-bold font-serif">{result.date}</span>
                </div>
                <div className="border-t border-border pt-2 mt-2 space-y-1">
                  <span className="text-xs font-semibold text-foreground">Synthèse médicale :</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{result.summary}</p>
                </div>
              </CardContent>
            </Card>

            {/* Markers Table */}
            <Card className="border-border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b border-border font-serif text-sm font-bold">
                Marqueurs analysés ({result.markers.length})
              </div>
              <div className="divide-y divide-border">
                {result.markers.map((marker, i) => (
                  <div key={i} className="p-3 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-foreground">{marker.name}</span>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Réf: {marker.referenceRange}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="font-bold font-mono">{marker.value} {marker.unit}</span>
                      
                      {/* Status badge */}
                      {marker.status === 'low' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          BAS
                        </span>
                      )}
                      {marker.status === 'high' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400">
                          ÉLEVÉ
                        </span>
                      )}
                      {marker.status === 'normal' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400">
                          OK
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recommendations */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-serif">Ajustements hygiéno-diététiques</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <span className="text-primary font-bold mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <div className="flex items-start space-x-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-[10px] text-red-700 dark:text-red-400 leading-relaxed font-semibold">
              <Stethoscope className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <span>
                AVERTISSEMENT : Cette analyse automatisée est à but purement informatif et ne saurait remplacer une consultation médicale. Ne prends aucun traitement et ne modifie aucun dosage de prescription médicale sans l'accord de ton médecin traitant.
              </span>
            </div>

            {/* Save trigger */}
            {!successMsg && (
              <Button 
                onClick={handleSaveResult} 
                disabled={saving}
                className="w-full h-11"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer dans mon carnet de santé'}
              </Button>
            )}

            <Button 
              variant="outline"
              onClick={() => { setFile(null); setFilePreview(null); setResult(null); setErrorMsg(null); setSuccessMsg(null); }}
              className="w-full h-11"
            >
              Importer un autre document
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
