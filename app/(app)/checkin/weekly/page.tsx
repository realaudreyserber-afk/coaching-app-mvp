/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { compressImage, uploadProgressPhoto } from "@/lib/media";

// Helper to compute YYYY-WW ISO week string
function getISOWeekString(date: Date) {
  const tempDate = new Date(date.valueOf());
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((tempDate.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return `${tempDate.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

export default function WeeklyCheckinPage() {
  const { user, getFreshToken } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState("");

  // Measurements state
  const [neck, setNeck] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [thighL, setThighL] = useState("");
  const [thighR, setThighR] = useState("");
  const [armL, setArmL] = useState("");
  const [armR, setArmR] = useState("");

  // Photos state
  const [photoFace, setPhotoFace] = useState<File | null>(null);
  const [photoProfile, setPhotoProfile] = useState<File | null>(null);
  const [photoBack, setPhotoBack] = useState<File | null>(null);

  // Feedback state
  const [feedback, setFeedback] = useState("");
  const [notes, setNotes] = useState("");

  // AI Review result state
  const [aiReview, setAiReview] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate measurements
    const nNum = parseFloat(neck);
    const wNum = parseFloat(waist);
    const hNum = parseFloat(hips);
    const tLNum = parseFloat(thighL);
    const tRNum = parseFloat(thighR);
    const aLNum = parseFloat(armL);
    const aRNum = parseFloat(armR);

    if (
      isNaN(nNum) || isNaN(wNum) || isNaN(hNum) ||
      isNaN(tLNum) || isNaN(tRNum) || isNaN(aLNum) || isNaN(aRNum)
    ) {
      return setError("S'il te plaît, complète toutes les mensurations.");
    }

    if (!photoFace || !photoProfile || !photoBack) {
      return setError("S'il te plaît, fournis les 3 photos requises (Face, Profil, Dos).");
    }

    setSubmitting(true);
    setError("");
    setProgressMsg("Compression des photos de progrès...");

    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const weekStr = getISOWeekString(new Date());

      // 1. Compress images client-side
      const compressedFace = await compressImage(photoFace);
      const compressedProfile = await compressImage(photoProfile);
      const compressedBack = await compressImage(photoBack);

      setProgressMsg("Upload de la photo face vers Firebase Storage...");
      const urlFace = await uploadProgressPhoto(user.uid, compressedFace, "face", todayStr);

      setProgressMsg("Upload de la photo profil vers Firebase Storage...");
      const urlProfile = await uploadProgressPhoto(user.uid, compressedProfile, "profile", todayStr);

      setProgressMsg("Upload de la photo dos vers Firebase Storage...");
      const urlBack = await uploadProgressPhoto(user.uid, compressedBack, "back", todayStr);

      setProgressMsg("Enregistrement des données de bilan dans Firestore...");

      const payload = {
        measurements: {
          neck: nNum,
          waist: wNum,
          hips: hNum,
          thigh_l: tLNum,
          thigh_r: tRNum,
          arm_l: aLNum,
          arm_r: aRNum,
        },
        photos: {
          face: urlFace,
          profile: urlProfile,
          back: urlBack,
        },
        plan_feedback: feedback.trim(),
        free_notes: notes.trim(),
        created_at: new Date().toISOString(),
      };

      // Write checkin document to subcollection checkins_weekly/
      const checkinRef = doc(db, "users", user.uid, "checkins_weekly", weekStr);
      await setDoc(checkinRef, payload);

      setProgressMsg("Analyse de ton bilan hebdomadaire par l'IA...");
      const token = await getFreshToken();
      
      if (token) {
        try {
          const res = await fetch("/api/ai/weekly-review", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ checkin: payload, week: weekStr }),
          });

          if (res.ok) {
            const data = await res.json();
            setAiReview(data?.review || {
              summary: "Ton bilan hebdomadaire a été enregistré avec succès.",
              diagnostic: "Notre IA analysera tes photos sous peu.",
              should_adjust_plan: false
            });
          }
        } catch (apiErr) {
          console.error("AI Weekly review failed, falling back:", apiErr);
          setAiReview({
            summary: "Bilan hebdomadaire enregistré avec succès !",
            diagnostic: "L'analyse automatique est momentanément indisponible, mais tes données sont bien enregistrées.",
            should_adjust_plan: false
          });
        }
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue pendant le bilan. Réessaie.");
      setSubmitting(false);
    }
  };

  if (aiReview) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-4 bg-background">
        <Card className="max-w-md w-full border-border">
          <CardHeader className="text-center space-y-2">
            <span className="text-3xl">📊</span>
            <CardTitle className="text-2xl font-serif">Bilan Hebdomadaire Validé</CardTitle>
            <CardDescription>Ton diagnostic IA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg border border-border">
                <h4 className="font-semibold text-sm font-serif mb-1">Résumé de la semaine :</h4>
                <p className="text-sm text-foreground leading-relaxed">{aiReview.summary}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <h4 className="font-semibold text-sm font-serif mb-1">Diagnostic technique :</h4>
                <p className="text-sm text-foreground leading-relaxed">{aiReview.diagnostic}</p>
              </div>
              {aiReview.should_adjust_plan && (
                <div className="bg-orange-light p-4 rounded-lg border border-orange-burnt/20 dark:bg-primary/10">
                  <h4 className="font-semibold text-sm text-primary font-serif mb-1">Ajustement recommandé :</h4>
                  <p className="text-sm text-foreground leading-relaxed">{aiReview.adjustments_suggestion}</p>
                </div>
              )}
            </div>
            <Button onClick={() => router.push("/dashboard")} className="w-full h-11">
              Aller au Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-10 px-4 bg-background">
      <Card className="max-w-lg w-full border-border">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-serif">Bilan Hebdomadaire</CardTitle>
          <CardDescription>
            Uploade tes photos et saisis tes mesures pour évaluer ta recomposition corporelle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitting ? (
            <div className="text-center space-y-4 py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="font-serif italic text-primary font-medium animate-pulse">{progressMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Measurements */}
              <div className="space-y-3">
                <h3 className="text-base font-serif font-semibold border-b pb-1">1. Mensurations (en cm)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Tour de cou</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={neck}
                      onChange={(e) => setNeck(e.target.value)}
                      placeholder="ex: 38"
                      className="w-full h-10 px-3 rounded-md border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Tour de taille (au nombril)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={waist}
                      onChange={(e) => setWaist(e.target.value)}
                      placeholder="ex: 82"
                      className="w-full h-10 px-3 rounded-md border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Tour de hanches</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={hips}
                      onChange={(e) => setHips(e.target.value)}
                      placeholder="ex: 94"
                      className="w-full h-10 px-3 rounded-md border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Bras Gauche</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={armL}
                      onChange={(e) => setArmL(e.target.value)}
                      placeholder="ex: 32"
                      className="w-full h-10 px-3 rounded-md border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Bras Droit</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={armR}
                      onChange={(e) => setArmR(e.target.value)}
                      placeholder="ex: 32.5"
                      className="w-full h-10 px-3 rounded-md border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Cuisse Gauche</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={thighL}
                      onChange={(e) => setThighL(e.target.value)}
                      placeholder="ex: 55"
                      className="w-full h-10 px-3 rounded-md border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Cuisse Droite</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={thighR}
                      onChange={(e) => setThighR(e.target.value)}
                      placeholder="ex: 55.2"
                      className="w-full h-10 px-3 rounded-md border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Progress Photos */}
              <div className="space-y-3">
                <h3 className="text-base font-serif font-semibold border-b pb-1">2. Photos de Progrès</h3>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium">Photo de Face</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => setPhotoFace(e.target.files?.[0] || null)}
                      className="text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium">Photo de Profil</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => setPhotoProfile(e.target.files?.[0] || null)}
                      className="text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium">Photo de Dos</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => setPhotoBack(e.target.files?.[0] || null)}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Feedback and Notes */}
              <div className="space-y-3">
                <h3 className="text-base font-serif font-semibold border-b pb-1">3. Tes ressentis</h3>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Retour sur le plan actuel</label>
                  <textarea
                    value={feedback}
                    required
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Comment as-tu trouvé les repas et les entraînements ? Trop faim, trop fatigué ?"
                    className="w-full h-16 p-3 rounded-md border border-border bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Notes additionnelles</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Événements, digestion, stress particulier..."
                    className="w-full h-16 p-3 rounded-md border border-border bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  className="w-1/3 h-11"
                >
                  Annuler
                </Button>
                <Button type="submit" className="w-2/3 h-11">
                  Valider mon bilan hebdomadaire
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
