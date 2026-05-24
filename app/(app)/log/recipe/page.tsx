/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { logFood } from '@/lib/features/food-logs/client';
import { flags } from '@/lib/features/flags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Camera, Loader2, CheckCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { RecipeOcrResult, RecipeIngredientSchema } from '@/lib/features/recipe-ocr/schema';

export default function RecipeOcrPage() {
  const router = useRouter();
  const { user, getFreshToken } = useAuth();
  
  const [isFlagActive, setIsFlagActive] = useState<boolean | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [recipe, setRecipe] = useState<RecipeOcrResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // States for adding custom ingredient
  const [showAddIng, setShowAddIng] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngQty, setNewIngQty] = useState('100');
  const [newIngUnit, setNewIngUnit] = useState('g');
  const [newIngKcal, setNewIngKcal] = useState('100');

  useEffect(() => {
    setIsFlagActive(flags.recipeOcr());
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setErrorMsg(null);
    setSuccessMsg(null);
    setRecipe(null);

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

    const base64Data = imagePreview.split(',')[1];
    const mimeType = imageFile?.type || 'image/jpeg';

    try {
      const token = await getFreshToken();
      if (!token) {
        throw new Error('Authentification requise');
      }

      const res = await fetch('/api/nutrition/recipe-ocr', {
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
      setRecipe(data.recipe);
    } catch (err: any) {
      console.error('Recipe OCR error:', err);
      setErrorMsg(err.message || 'Impossible d\'analyser l\'image. Assure-toi que le texte de la recette est lisible.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFieldChange = (field: keyof RecipeOcrResult, value: any) => {
    if (!recipe) return;
    setRecipe({
      ...recipe,
      [field]: value
    });
  };

  const handleIngredientChange = (index: number, updatedFields: Partial<any>) => {
    if (!recipe) return;
    const updatedIngredients = recipe.ingredients.map((ing, idx) => {
      if (idx !== index) return ing;
      const newIng = { ...ing, ...updatedFields };
      
      // If quantity or calories changed, re-scale macros proportionally if we want,
      // but here we let the user edit fields individually.
      return newIng;
    });

    // Recalculate totals
    const totalKcal = updatedIngredients.reduce((sum, ing) => sum + (ing.kcal || 0), 0);
    const totalP = updatedIngredients.reduce((sum, ing) => sum + (ing.p || 0), 0);
    const totalC = updatedIngredients.reduce((sum, ing) => sum + (ing.c || 0), 0);
    const totalF = updatedIngredients.reduce((sum, ing) => sum + (ing.f || 0), 0);

    setRecipe({
      ...recipe,
      ingredients: updatedIngredients,
      totalKcal,
      totalP: Math.round(totalP * 10) / 10,
      totalC: Math.round(totalC * 10) / 10,
      totalF: Math.round(totalF * 10) / 10
    });
  };

  const handleDeleteIngredient = (index: number) => {
    if (!recipe) return;
    const updatedIngredients = recipe.ingredients.filter((_, idx) => idx !== index);
    
    // Recalculate totals
    const totalKcal = updatedIngredients.reduce((sum, ing) => sum + (ing.kcal || 0), 0);
    const totalP = updatedIngredients.reduce((sum, ing) => sum + (ing.p || 0), 0);
    const totalC = updatedIngredients.reduce((sum, ing) => sum + (ing.c || 0), 0);
    const totalF = updatedIngredients.reduce((sum, ing) => sum + (ing.f || 0), 0);

    setRecipe({
      ...recipe,
      ingredients: updatedIngredients,
      totalKcal,
      totalP: Math.round(totalP * 10) / 10,
      totalC: Math.round(totalC * 10) / 10,
      totalF: Math.round(totalF * 10) / 10
    });
  };

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipe || !newIngName.trim()) return;

    const qty = parseFloat(newIngQty) || 0;
    const kcal = parseFloat(newIngKcal) || 0;
    
    const newIng = {
      name: newIngName.trim(),
      qty,
      unit: newIngUnit,
      kcal,
      p: Math.round((kcal * 0.1) / 4 * 10) / 10, // rough estimate
      c: Math.round((kcal * 0.5) / 4 * 10) / 10,
      f: Math.round((kcal * 0.4) / 9 * 10) / 10
    };

    const updatedIngredients = [...recipe.ingredients, newIng];
    
    // Recalculate totals
    const totalKcal = updatedIngredients.reduce((sum, ing) => sum + (ing.kcal || 0), 0);
    const totalP = updatedIngredients.reduce((sum, ing) => sum + (ing.p || 0), 0);
    const totalC = updatedIngredients.reduce((sum, ing) => sum + (ing.c || 0), 0);
    const totalF = updatedIngredients.reduce((sum, ing) => sum + (ing.f || 0), 0);

    setRecipe({
      ...recipe,
      ingredients: updatedIngredients,
      totalKcal,
      totalP: Math.round(totalP * 10) / 10,
      totalC: Math.round(totalC * 10) / 10,
      totalF: Math.round(totalF * 10) / 10
    });

    setNewIngName('');
    setNewIngQty('100');
    setNewIngUnit('g');
    setNewIngKcal('100');
    setShowAddIng(false);
  };

  const handleSaveRecipe = async () => {
    if (!user || !recipe) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Save recipe under users/{uid}/recipes
      await addDoc(collection(db, 'users', user.uid, 'recipes'), {
        ...recipe,
        createdAt: new Date().toISOString()
      });
      setSuccessMsg(`La recette "${recipe.name}" a été sauvegardée avec succès !`);
    } catch (err: any) {
      console.error('Save recipe error:', err);
      setErrorMsg('Impossible de sauvegarder la recette dans ton carnet.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogPortion = async () => {
    if (!user || !recipe) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const todayStr = new Date().toISOString().split('T')[0];
    const portionKcal = Math.round(recipe.totalKcal / recipe.servings);
    const portionP = Math.round((recipe.totalP / recipe.servings) * 10) / 10;
    const portionC = Math.round((recipe.totalC / recipe.servings) * 10) / 10;
    const portionF = Math.round((recipe.totalF / recipe.servings) * 10) / 10;

    try {
      await logFood(user, {
        source: 'recipe_ocr',
        notes: `Recette : ${recipe.name}`,
        items: [
          {
            name: `${recipe.name} (1 portion)`,
            brand: 'Recette importée',
            qty_g: 100,
            kcal: portionKcal,
            p: portionP,
            c: portionC,
            f: portionF,
          },
        ],
      });

      setSuccessMsg(`Une portion (${portionKcal} kcal) a été ajoutée à ton journal de nutrition.`);
    } catch (err: any) {
      console.error('Log recipe portion error:', err);
      setErrorMsg(err?.message || 'Impossible de consigner la portion dans ton journal.');
    } finally {
      setSaving(false);
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
              L'import de recette par OCR n'est pas encore disponible dans ta zone.
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
        <h1 className="text-xl font-serif font-bold text-foreground">Import de Recette</h1>
      </div>

      <div className="space-y-4">
        
        {/* Upload & Photo Preview */}
        {!imagePreview ? (
          <Card className="border-dashed border-2 border-border bg-white/50 dark:bg-black/20">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Camera className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold font-serif">Numérise un livre ou écran</h3>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                  Prends une photo d'une recette papier ou téléverse une capture d'écran. Gemini Vision extraira les ingrédients, étapes de préparation et calculera les macros.
                </p>
              </div>
              
              <label className="cursor-pointer pt-2">
                <span className="bg-primary text-white hover:bg-primary/95 h-11 px-6 rounded-md font-medium text-sm flex items-center justify-center transition-colors">
                  Importer ou capturer
                </span>
                <input 
                  type="file" 
                  accept="image/*" 
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
              alt="Recette brute" 
              className="w-full h-full object-cover"
            />
            
            {!analyzing && !recipe && (
              <div className="absolute bottom-4 left-4 right-4 flex space-x-2">
                <Button 
                  variant="secondary" 
                  onClick={() => { setImageFile(null); setImagePreview(null); setRecipe(null); setErrorMsg(null); }}
                  className="flex-1"
                >
                  Changer
                </Button>
                <Button 
                  onClick={handleAnalyze}
                  className="flex-1"
                >
                  Scanner la recette
                </Button>
              </div>
            )}
          </div>
        )}

        {/* OCR Analyzing state */}
        {analyzing && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-serif">Gemini déchiffre la recette et estime les portions...</p>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <Card className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300">
            <CardContent className="flex items-start space-x-3 p-4">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Échec du scan</h4>
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
                <h4 className="font-semibold text-sm">Action complétée</h4>
                <p className="text-xs">{successMsg}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recipe Editor Form */}
        {recipe && (
          <div className="space-y-4">
            
            {/* General details */}
            <Card className="border-border bg-white dark:bg-black/10">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-serif">Nom de la recette</label>
                  <input
                    type="text"
                    value={recipe.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-border bg-transparent text-sm font-semibold"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-serif">Nombre de portions (servings)</label>
                  <input
                    type="number"
                    min="1"
                    value={recipe.servings}
                    onChange={(e) => handleFieldChange('servings', Number(e.target.value) || 1)}
                    className="w-full h-10 px-3 rounded-md border border-border bg-transparent text-sm font-semibold"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Ingredients Editor */}
            <Card className="border-border bg-white dark:bg-black/10">
              <CardHeader className="pb-2 border-b border-border">
                <CardTitle className="text-sm font-serif">Ingrédients & Teneurs</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border">
                {recipe.ingredients.map((ing, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between space-x-2">
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={ing.name}
                        onChange={(e) => handleIngredientChange(idx, { name: e.target.value })}
                        className="text-xs font-semibold bg-transparent border-none p-0 focus:outline-none w-full truncate"
                      />
                      <div className="text-[10px] text-muted-foreground">
                        {ing.kcal || 0} kcal • P: {ing.p || 0}g / G: {ing.c || 0}g / L: {ing.f || 0}g
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <input
                        type="number"
                        value={ing.qty}
                        onChange={(e) => handleIngredientChange(idx, { qty: Number(e.target.value) || 0 })}
                        className="w-12 h-7 text-center text-xs rounded border border-border bg-transparent"
                      />
                      <input
                        type="text"
                        value={ing.unit}
                        onChange={(e) => handleIngredientChange(idx, { unit: e.target.value })}
                        className="w-10 h-7 text-center text-[10px] rounded border border-border bg-transparent"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteIngredient(idx)}
                        className="h-7 w-7 text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Totals */}
                <div className="p-3 bg-cream/30 dark:bg-anthracite/20 space-y-1">
                  <div className="flex justify-between text-xs font-serif font-bold">
                    <span>Total Recette</span>
                    <span>{recipe.totalKcal} kcal</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>P: {recipe.totalP}g</span>
                    <span>G: {recipe.totalC}g</span>
                    <span>L: {recipe.totalF}g</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-primary font-bold border-t border-border pt-1 mt-1">
                    <span>Par portion (1/{recipe.servings})</span>
                    <span>{Math.round(recipe.totalKcal / recipe.servings)} kcal</span>
                  </div>
                </div>

                {/* Add ingredient manual form */}
                {showAddIng ? (
                  <form onSubmit={handleAddIngredient} className="p-3 bg-cream/10 dark:bg-anthracite/5 space-y-2">
                    <input
                      type="text"
                      required
                      placeholder="Nom de l'ingrédient"
                      value={newIngName}
                      onChange={(e) => setNewIngName(e.target.value)}
                      className="w-full h-8 px-2 rounded border border-border bg-transparent text-xs"
                    />
                    <div className="grid grid-cols-3 gap-1">
                      <input
                        type="number"
                        required
                        placeholder="Qté"
                        value={newIngQty}
                        onChange={(e) => setNewIngQty(e.target.value)}
                        className="w-full h-8 px-2 rounded border border-border bg-transparent text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Unité"
                        value={newIngUnit}
                        onChange={(e) => setNewIngUnit(e.target.value)}
                        className="w-full h-8 px-2 rounded border border-border bg-transparent text-xs"
                      />
                      <input
                        type="number"
                        required
                        placeholder="Kcal"
                        value={newIngKcal}
                        onChange={(e) => setNewIngKcal(e.target.value)}
                        className="w-full h-8 px-2 rounded border border-border bg-transparent text-xs"
                      />
                    </div>
                    <div className="flex space-x-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowAddIng(false)}>Annuler</Button>
                      <Button type="submit" size="sm">Ajouter</Button>
                    </div>
                  </form>
                ) : (
                  <div className="p-2 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddIng(true)} className="space-x-1">
                      <Plus className="h-3 w-3" />
                      <span>Ajouter un ingrédient</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preparation Steps */}
            <Card className="border-border bg-white dark:bg-black/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-serif">Instructions de préparation</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground pl-1">
                  {recipe.steps.map((step, i) => (
                    <li key={i} className="leading-relaxed">{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex space-x-2 pt-2">
              <Button
                variant="outline"
                disabled={saving}
                onClick={handleSaveRecipe}
                className="flex-1 h-11"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer la recette'}
              </Button>
              <Button
                disabled={saving}
                onClick={handleLogPortion}
                className="flex-1 h-11"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Loguer 1 portion'}
              </Button>
            </div>
            
            <Button 
              variant="ghost"
              onClick={() => { setImageFile(null); setImagePreview(null); setRecipe(null); setErrorMsg(null); setSuccessMsg(null); }}
              className="w-full"
            >
              Scanner une autre recette
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
