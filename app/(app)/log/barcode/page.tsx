/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { flags } from '@/lib/features/flags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Scan, Keyboard, Loader2, CheckCircle, AlertTriangle, Scale } from 'lucide-react';

export default function BarcodePage() {
  const router = useRouter();
  const { user, getFreshToken } = useAuth();
  
  const [isFlagActive, setIsFlagActive] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [product, setProduct] = useState<any | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loggingFood, setLoggingFood] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Check feature flag on mount
  useEffect(() => {
    setIsFlagActive(flags.barcode());
  }, []);

  // Initialize barcode reader
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setProduct(null);
    setScannedCode(null);
    setIsScanning(true);

    try {
      // Prompt camera permission if not granted
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(track => track.stop()); // release temporary stream
      setCameraPermission('granted');

      if (codeReaderRef.current && videoRef.current) {
        await codeReaderRef.current.decodeFromVideoDevice(
          undefined, // undefined selects default camera device (usually back camera)
          videoRef.current,
          (result, error) => {
            if (result) {
              const code = result.getText();
              setScannedCode(code);
              stopScanning();
              lookupProduct(code);
            }
          }
        );
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraPermission('denied');
      setIsScanning(false);
      setManualMode(true);
      setErrorMsg('Impossible d\'accéder à la caméra. Vérifie les permissions.');
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      try {
        (codeReaderRef.current as any).reset();
      } catch (e) {
        console.warn('Reader reset failed:', e);
      }
    }
    // Manually stop stream tracks to turn off the camera light
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      } catch (e) {
        console.warn('Stream cleanup failed:', e);
      }
    }
    setIsScanning(false);
  };

  const lookupProduct = async (code: string) => {
    if (!code) return;
    setLoadingProduct(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const token = await getFreshToken();
      if (!token) {
        throw new Error('Authentification requise');
      }

      const res = await fetch(`/api/nutrition/barcode?code=${encodeURIComponent(code)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Produit introuvable.');
      }

      const data = await res.json();
      setProduct(data.food);
    } catch (err: any) {
      console.error('Lookup error:', err);
      setErrorMsg(err.message || 'Une erreur est survenue lors de la recherche.');
      setProduct(null);
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    lookupProduct(manualCode.trim());
  };

  const handleLogFood = async () => {
    if (!user || !product) return;
    setLoggingFood(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const scale = quantity / 100;
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      const payload = {
        name: product.name,
        brand: product.brand || 'Marque inconnue',
        kcal: Math.round(product.kcal_100g * scale),
        p: Math.round(product.p_100g * scale * 10) / 10,
        c: Math.round(product.c_100g * scale * 10) / 10,
        f: Math.round(product.f_100g * scale * 10) / 10,
        qty_g: quantity,
        barcode: product.barcode || '',
        date: todayStr,
        loggedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'users', user.uid, 'food_logs'), payload);
      setSuccessMsg(`"${product.name}" (${quantity}g) enregistré avec succès !`);
      setProduct(null);
      setScannedCode(null);
      setManualCode('');
    } catch (err: any) {
      console.error('Log food error:', err);
      setErrorMsg('Impossible d\'enregistrer cet aliment dans ton journal.');
    } finally {
      setLoggingFood(false);
    }
  };

  if (isFlagActive === null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cream px-4 dark:bg-anthracite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Feature flag guard
  if (!isFlagActive) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-6 bg-cream dark:bg-anthracite text-center space-y-6">
        <Card className="max-w-md w-full border-border">
          <CardHeader className="space-y-2">
            <span className="text-4xl">🚧</span>
            <CardTitle className="text-2xl font-serif">Module en cours de déploiement</CardTitle>
            <CardDescription>
              Le scanner de code-barres n'est pas encore disponible dans ta zone.
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
        <h1 className="text-xl font-serif font-bold text-foreground">Scanner un produit</h1>
      </div>

      {/* Main scanner view */}
      {!product && !loadingProduct && (
        <div className="space-y-4">
          {!isScanning ? (
            <div className="space-y-4">
              <Card className="border-border overflow-hidden bg-white/50 dark:bg-black/20 backdrop-blur-md">
                <CardContent className="flex flex-col items-center py-10 text-center space-y-6">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <Scan className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-serif font-semibold text-lg">Prêt à scanner ?</h3>
                    <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                      Utilise la caméra pour scanner instantanément les valeurs nutritionnelles de ton produit via Open Food Facts.
                    </p>
                  </div>
                  <Button onClick={startScanning} className="w-full h-11 space-x-2">
                    <Scan className="h-4 w-4" />
                    <span>Lancer le scanner</span>
                  </Button>
                </CardContent>
              </Card>

              <div className="flex items-center my-4">
                <div className="flex-1 border-t border-border" />
                <span className="px-3 text-xs text-muted-foreground font-serif uppercase tracking-wider">ou</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {manualMode ? (
                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <label className="text-sm font-medium">Saisir le code-barres manuellement</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      placeholder="Ex: 3017670010105"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="flex-1 h-11 px-3 rounded-md border border-border bg-white/50 dark:bg-black/20 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button type="submit" className="h-11">Rechercher</Button>
                  </div>
                </form>
              ) : (
                <Button variant="ghost" onClick={() => setManualMode(true)} className="w-full h-11 border border-border space-x-2">
                  <Keyboard className="h-4 w-4" />
                  <span>Saisie manuelle</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-primary/30 bg-black aspect-[4/3] flex items-center justify-center">
              <video 
                ref={videoRef} 
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              />
              
              {/* Scanning Target Overlay */}
              <div className="relative z-10 w-2/3 aspect-[2/1] border-2 border-primary rounded-lg flex items-center justify-center">
                {/* Neon Corners */}
                <div className="absolute top-0 left-0 -mt-1 -ml-1 w-4 h-4 border-t-4 border-l-4 border-orange-light" />
                <div className="absolute top-0 right-0 -mt-1 -mr-1 w-4 h-4 border-t-4 border-r-4 border-orange-light" />
                <div className="absolute bottom-0 left-0 -mb-1 -ml-1 w-4 h-4 border-b-4 border-l-4 border-orange-light" />
                <div className="absolute bottom-0 right-0 -mb-1 -mr-1 w-4 h-4 border-b-4 border-r-4 border-orange-light" />
                
                {/* Laser scan line animation */}
                <div className="w-full h-[2px] bg-primary shadow-[0_0_10px_#ff7b00] animate-[pulse_1.5s_infinite] absolute" />
              </div>

              {/* Close scanning */}
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={stopScanning}
                className="absolute bottom-4 z-20"
              >
                Annuler
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loadingProduct && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-serif">Recherche dans la base européenne...</p>
        </div>
      )}

      {/* Error state */}
      {errorMsg && (
        <Card className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300">
          <CardContent className="flex items-start space-x-3 p-4">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">Erreur de recherche</h4>
              <p className="text-xs leading-relaxed">{errorMsg}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success State */}
      {successMsg && (
        <Card className="border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300">
          <CardContent className="flex items-start space-x-3 p-4">
            <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">Produit enregistré !</h4>
              <p className="text-xs leading-relaxed">{successMsg}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Display Card & Quantifier */}
      {product && !loadingProduct && (
        <Card className="border-border overflow-hidden bg-white dark:bg-black/10 shadow-lg animate-[fadeIn_0.3s_ease-out]">
          {product.imageUrl && (
            <div className="relative h-48 w-full bg-cream dark:bg-anthracite/50 flex items-center justify-center overflow-hidden border-b border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={product.imageUrl} 
                alt={product.name} 
                className="h-full object-contain p-2"
              />
            </div>
          )}
          
          <CardHeader className="space-y-1">
            <span className="text-xs font-serif uppercase tracking-widest text-primary font-bold">
              {product.brand || 'Marque inconnue'}
            </span>
            <CardTitle className="text-xl font-serif">{product.name}</CardTitle>
            {product.nutriscore && (
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                  Nutri-Score {product.nutriscore}
                </span>
                {product.novascore && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-light/10 text-orange-light">
                    NOVA {product.novascore}
                  </span>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Nutritional Values Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-cream dark:bg-anthracite/40 p-2 rounded border border-border">
                <div className="text-base font-bold font-serif">{Math.round(product.kcal_100g * (quantity / 100))}</div>
                <div className="text-[10px] text-muted-foreground">Kcal</div>
              </div>
              <div className="bg-cream dark:bg-anthracite/40 p-2 rounded border border-border">
                <div className="text-base font-bold text-orange-light font-serif">
                  {Math.round(product.p_100g * (quantity / 100) * 10) / 10}g
                </div>
                <div className="text-[10px] text-muted-foreground">Protéines</div>
              </div>
              <div className="bg-cream dark:bg-anthracite/40 p-2 rounded border border-border">
                <div className="text-base font-bold text-secondary font-serif">
                  {Math.round(product.c_100g * (quantity / 100) * 10) / 10}g
                </div>
                <div className="text-[10px] text-muted-foreground">Glucides</div>
              </div>
              <div className="bg-cream dark:bg-anthracite/40 p-2 rounded border border-border">
                <div className="text-base font-bold text-foreground/80 font-serif">
                  {Math.round(product.f_100g * (quantity / 100) * 10) / 10}g
                </div>
                <div className="text-[10px] text-muted-foreground">Lipides</div>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium flex items-center space-x-1.5">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <span>Portion consommée</span>
                </label>
                <span className="text-sm font-bold font-serif text-primary">{quantity} g</span>
              </div>
              
              <input
                type="range"
                min="10"
                max="500"
                step="5"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full accent-primary bg-border h-1.5 rounded-lg appearance-none cursor-pointer"
              />

              <div className="grid grid-cols-4 gap-2 pt-1">
                {[50, 100, 150, 200].map((preset) => (
                  <Button 
                    key={preset}
                    variant="outline" 
                    size="sm" 
                    onClick={() => setQuantity(preset)}
                    className={`h-8 text-xs ${quantity === preset ? 'border-primary text-primary bg-primary/5' : ''}`}
                  >
                    {preset}g
                  </Button>
                ))}
              </div>
            </div>

            {/* Allergens warning */}
            {product.allergens && product.allergens.length > 0 && (
              <div className="text-[11px] text-muted-foreground bg-orange-light/5 border border-orange-light/10 p-2.5 rounded">
                <span className="font-semibold text-orange-light">Allergènes : </span>
                {product.allergens.join(', ')}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex space-x-2 pt-2">
              <Button 
                variant="outline" 
                onClick={() => { setProduct(null); setScannedCode(null); }}
                className="flex-1 h-11"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleLogFood} 
                disabled={loggingFood}
                className="flex-1 h-11"
              >
                {loggingFood ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Ajouter'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
