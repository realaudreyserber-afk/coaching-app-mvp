/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks';
import { flags } from '@/lib/features/flags';
import { logFood } from '@/lib/features/food-logs/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Camera, Loader2, CheckCircle, AlertTriangle, Trash2, Plus, Scale } from 'lucide-react';

interface FoodItem {
  name: string;
  qty_estimated_g: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export default function PhotoMealPage() {
  const router = useRouter();
  const { user, getFreshToken } = useAuth();
  
  const [isFlagActive, setIsFlagActive] = useState<boolean | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<FoodItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [savingLogs, setSavingLogs] = useState(false);

  // For adding a custom item manually
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('100');
  const [newItemKcal, setNewItemKcal] = useState('100');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    setIsFlagActive(flags.photoMeal());
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setErrorMsg(null);
    setSuccessMsg(null);
    setDetectedItems([]);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imagePreview) return;
    setAnalyzing(true);
    setErrorMsg(null);

    // Extract base64 payload from data URL
    const base64Data = imagePreview.split(',')[1];
    const mimeType = imageFile?.type || 'image/jpeg';

    try {
      const token = await getFreshToken();
      if (!token) {
        throw new Error('Authentification requise');
      }

      const res = await fetch('/api/nutrition/photo-recognize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erreur lors de l\'analyse.');
      }

      const data = await res.json();
      setDetectedItems(data.analysis.items);
    } catch (err: any) {
      console.error('Photo analysis error:', err);
      setErrorMsg(err.message || 'Impossible d\'analyser ton assiette. Réessaie avec une image plus nette.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleQuantityChange = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    setDetectedItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const ratio = newQty / item.qty_estimated_g;
      return {
        ...item,
        qty_estimated_g: newQty,
        kcal: Math.round(item.kcal * ratio),
        p: Math.round(item.p * ratio * 10) / 10,
        c: Math.round(item.c * ratio * 10) / 10,
        f: Math.round(item.f * ratio * 10) / 10,
      };
    }));
  };

  const handleDeleteItem = (index: number) => {
    setDetectedItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const qty = parseFloat(newItemQty) || 100;
    const kcal = parseFloat(newItemKcal) || 100;

    // Simple macro estimates (e.g. assume balanced carb/prot ratio or let user override, 
    // here we just use custom values or simple calculation)
    const customItem: FoodItem = {
      name: newItemName.trim(),
      qty_estimated_g: qty,
      kcal: kcal,
      p: Math.round((kcal * 0.1) / 4 * 10) / 10, // simple rough estimate
      c: Math.round((kcal * 0.5) / 4 * 10) / 10,
      f: Math.round((kcal * 0.4) / 9 * 10) / 10,
    };

    setDetectedItems(prev => [...prev, customItem]);
    setNewItemName('');
    setNewItemQty('100');
    setNewItemKcal('100');
    setShowAddForm(false);
  };

  const handleSaveMeal = async () => {
    if (!user || detectedItems.length === 0) return;
    setSavingLogs(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // One food_log doc per meal capture, with all detected items inside.
      // Matches canonical schema better (a "meal" is one logical entry).
      await logFood(user, {
        source: 'photo_meal',
        items: detectedItems.map((item) => ({
          name: item.name,
          brand: 'Photo-to-Meal IA',
          qty_g: item.qty_estimated_g,
          kcal: item.kcal,
          p: item.p,
          c: item.c,
          f: item.f,
        })),
      });

      setSuccessMsg(`Repas (${detectedItems.length} aliment(s)) enregistré dans ton journal !`);
      // Wave 5E : feedback ORACLE.IA sur le repas vs macros du jour
      void requestCoachFeedback({
        name: `Photo · ${detectedItems.map((i) => i.name).slice(0, 3).join(', ')}`,
        kcal: totalKcal,
        macros: { p: totalP, c: totalC, f: totalF },
      });
      setDetectedItems([]);
      setImageFile(null);
      setImagePreview(null);
    } catch (err: any) {
      console.error('Log photo meal error:', err);
      setErrorMsg(err?.message || 'Impossible d\'enregistrer les aliments.');
    } finally {
      setSavingLogs(false);
    }
  };

  // Wave 5E — meal feedback hook
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);
  const [coachFeedbackLoading, setCoachFeedbackLoading] = useState(false);

  const requestCoachFeedback = async (meal: { name: string; kcal: number; macros: { p: number; c: number; f: number } }) => {
    if (!user) return;
    setCoachFeedbackLoading(true);
    setCoachFeedback(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/ai/coach-meal-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ meal }),
      });
      const data = await res.json();
      if (res.ok && data.feedback) setCoachFeedback(data.feedback);
    } catch (e) {
      console.warn('[coach-feedback] photo failed:', e);
    } finally {
      setCoachFeedbackLoading(false);
    }
  };

  const totalKcal = detectedItems.reduce((sum, item) => sum + item.kcal, 0);
  const totalP = detectedItems.reduce((sum, item) => sum + item.p, 0);
  const totalC = detectedItems.reduce((sum, item) => sum + item.c, 0);
  const totalF = detectedItems.reduce((sum, item) => sum + item.f, 0);

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
            <span className="text-4xl">🚧</span>
            <CardTitle className="text-2xl font-serif">Module en cours de déploiement</CardTitle>
            <CardDescription>
              La reconnaissance de repas par photo n'est pas encore disponible dans ta zone.
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
        <h1 className="text-xl font-serif font-bold text-foreground font-bold">Photo-to-meal IA</h1>
      </div>

      {/* Main Container */}
      <div className="space-y-4">
        
        {/* Upload Button & Preview */}
        {!imagePreview ? (
          <Card className="border-dashed border-2 border-border bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Camera className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold font-serif">Prends une photo de ton assiette</h3>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                  L'IA analysera visuellement le repas pour estimer sa composition nutritionnelle complète.
                </p>
              </div>
              
              <label className="cursor-pointer">
                <span className="bg-primary text-white hover:bg-primary/95 h-11 px-6 rounded-md font-medium text-sm flex items-center justify-center transition-colors">
                  Prendre ou importer une photo
                </span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  onChange={handleImageChange} 
                  className="hidden" 
                />
              </label>
            </CardContent>
          </Card>
        ) : (
          <div className="relative rounded-xl overflow-hidden border border-border aspect-[4/3] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={imagePreview} 
              alt="Repas" 
              className="w-full h-full object-cover"
            />
            
            {/* Cancel image selection */}
            {!analyzing && detectedItems.length === 0 && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute bottom-4 right-4"
              >
                Changer
              </Button>
            )}

            {/* Launch analyze */}
            {!analyzing && detectedItems.length === 0 && (
              <Button 
                onClick={handleAnalyze}
                className="absolute bottom-4 left-4"
              >
                Analyser l'assiette
              </Button>
            )}
          </div>
        )}

        {/* Loading status */}
        {analyzing && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-serif">Gemini Vision estime tes macros...</p>
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
                <h4 className="font-semibold text-sm">Repas logué !</h4>
                <p className="text-xs">{successMsg}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wave 5E — ORACLE.IA feedback on the just-logged meal */}
        {(coachFeedbackLoading || coachFeedback) && (
          <div
            className="relative"
            style={{
              padding: "12px 14px",
              background: "var(--accent-tech-tint)",
              border: "1px solid var(--accent-tech)",
              boxShadow: "0 0 12px var(--accent-tech-tint-strong)",
              clipPath:
                "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
            }}
          >
            <span
              className="mono flex items-center gap-2"
              style={{
                fontSize: 10,
                letterSpacing: "0.3em",
                color: "var(--accent-tech)",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              <span className="status-dot" aria-hidden="true" />
              ORACLE.IA · BRIEFING REPAS
            </span>
            {coachFeedbackLoading ? (
              <p
                className="mono"
                style={{ fontSize: 11, color: "var(--accent-tech)", fontStyle: "italic", margin: 0 }}
              >
                analyse en cours...
              </p>
            ) : (
              <p
                style={{
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--fg-1)",
                  margin: 0,
                }}
              >
                « {coachFeedback} »
              </p>
            )}
          </div>
        )}

        {/* Detected Items & Editor */}
        {detectedItems.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-lg font-serif">Aliments détectés</CardTitle>
              <CardDescription>
                Ajuste les quantités estimées par l'IA si nécessaire.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border">
              {detectedItems.map((item, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <div className="text-sm font-semibold truncate max-w-[180px]">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.kcal} kcal • {item.p}g P / {item.c}g G / {item.f}g L
                    </div>
                  </div>

                  {/* Quantity editor */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={item.qty_estimated_g}
                      onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                      className="w-16 h-8 text-center text-xs rounded border border-border bg-transparent focus:outline-none"
                    />
                    <span className="text-xs text-muted-foreground">g</span>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteItem(idx)}
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Total Display */}
              <div className="p-4 bg-muted flex flex-col space-y-2">
                <div className="flex justify-between items-center text-sm font-serif font-bold">
                  <span>Total Repas</span>
                  <span>{totalKcal} kcal</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>P: {totalP}g</span>
                  <span>G: {totalC}g</span>
                  <span>L: {totalF}g</span>
                </div>
              </div>

              {/* Form to manually add custom item */}
              {showAddForm ? (
                <form onSubmit={handleAddCustomItem} className="p-4 bg-muted space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Ajouter un ingrédient</div>
                  <input
                    type="text"
                    required
                    placeholder="Nom de l'aliment (ex: Ketchup)"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-border bg-transparent text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      required
                      placeholder="Quantité (g)"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      className="w-full h-8 px-2 rounded border border-border bg-transparent text-xs"
                    />
                    <input
                      type="number"
                      required
                      placeholder="Calories (kcal)"
                      value={newItemKcal}
                      onChange={(e) => setNewItemKcal(e.target.value)}
                      className="w-full h-8 px-2 rounded border border-border bg-transparent text-xs"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Annuler</Button>
                    <Button type="submit" size="sm">Ajouter</Button>
                  </div>
                </form>
              ) : (
                <div className="p-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setShowAddForm(true)} className="space-x-1">
                    <Plus className="h-4 w-4" />
                    <span>Ajouter un aliment</span>
                  </Button>
                </div>
              )}

              {/* Action Save/Cancel buttons */}
              <div className="p-4 flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => { setDetectedItems([]); setImageFile(null); setImagePreview(null); }}
                  className="flex-1 h-11"
                >
                  Tout effacer
                </Button>
                <Button 
                  onClick={handleSaveMeal} 
                  disabled={savingLogs}
                  className="flex-1 h-11"
                >
                  {savingLogs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Enregistrer le repas'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
