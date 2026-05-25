/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import WeightChart, { WeightDataPoint } from "@/components/dashboard/weight-chart";
import { TrendingUp, Camera, Ruler, Calendar, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface WeeklyRecord {
  id: string; // ISO week, e.g. 2026-W21 or "baseline"
  date: string;
  measurements: {
    neck: number;
    waist: number;
    hips: number;
    thigh_l: number;
    thigh_r: number;
    arm_l: number;
    arm_r: number;
  };
  photos?: {
    face?: string;
    profile?: string;
    back?: string;
  };
}

export default function ProgressPage() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"weight" | "measurements" | "photos">("weight");
  const [fetching, setFetching] = useState(true);
  const [chartData, setChartData] = useState<WeightDataPoint[]>([]);
  const [dailyWeights, setDailyWeights] = useState<any[]>([]);
  const [weeklyRecords, setWeeklyRecords] = useState<WeeklyRecord[]>([]);
  
  // Photo comparison states
  const [compareWeekA, setCompareWeekA] = useState<string>("");
  const [compareWeekB, setCompareWeekB] = useState<string>("");
  const [photoType, setPhotoType] = useState<"face" | "profile" | "back">("face");

  useEffect(() => {
    if (loading || !user) return;

    const loadProgressData = async () => {
      try {
        // 1. Fetch User document for baseline
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        let baselineRecord: WeeklyRecord | null = null;
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.baseline) {
            baselineRecord = {
              id: "baseline",
              date: "Départ",
              measurements: {
                neck: userData.baseline.measurements?.neck || 0,
                waist: userData.baseline.measurements?.waist || 0,
                hips: userData.baseline.measurements?.hips || 0,
                thigh_l: userData.baseline.measurements?.thigh_l || 0,
                thigh_r: userData.baseline.measurements?.thigh_r || 0,
                arm_l: userData.baseline.measurements?.arm_l || 0,
                arm_r: userData.baseline.measurements?.arm_r || 0,
              },
              photos: {
                face: userData.baseline.photos?.face || "",
                profile: userData.baseline.photos?.profile || "",
                back: userData.baseline.photos?.back || "",
              }
            };
          }
        }

        // 2. Fetch daily weights (all time, up to 100 for graph and history table)
        const dailyRef = collection(db, "users", user.uid, "checkins_daily");
        const dailyQuery = query(dailyRef, orderBy("created_at", "desc"));
        const dailySnap = await getDocs(dailyQuery);
        
        const weightsList: any[] = [];
        dailySnap.forEach((docSnap) => {
          weightsList.push({
            date: docSnap.id,
            weight: docSnap.data().weight,
            created_at: docSnap.data().created_at,
          });
        });

        setDailyWeights(weightsList);

        // Sort ascending for chart rolling average calculation
        if (weightsList.length > 0) {
          const sortedList = [...weightsList].sort((a, b) => a.date.localeCompare(b.date));
          const formattedData = sortedList.map((c, idx) => {
            let sum = 0;
            let count = 0;
            for (let i = Math.max(0, idx - 6); i <= idx; i++) {
              sum += sortedList[i].weight;
              count++;
            }
            return {
              date: c.date.substring(5), // MM-DD
              weight: c.weight,
              average: parseFloat((sum / count).toFixed(2)),
            };
          });
          setChartData(formattedData);
        }

        // 3. Fetch weekly check-ins
        const weeklyRef = collection(db, "users", user.uid, "checkins_weekly");
        const weeklyQuery = query(weeklyRef, orderBy("created_at", "asc"));
        const weeklySnap = await getDocs(weeklyQuery);

        const recordsList: WeeklyRecord[] = [];
        
        // Add baseline first
        if (baselineRecord) {
          recordsList.push(baselineRecord);
        }

        weeklySnap.forEach((docSnap) => {
          const wData = docSnap.data();
          recordsList.push({
            id: docSnap.id, // YYYY-WX
            date: `Semaine ${docSnap.id.split("-W")[1] || docSnap.id}`,
            measurements: {
              neck: wData.measurements?.neck || 0,
              waist: wData.measurements?.waist || 0,
              hips: wData.measurements?.hips || 0,
              thigh_l: wData.measurements?.thigh_l || 0,
              thigh_r: wData.measurements?.thigh_r || 0,
              arm_l: wData.measurements?.arm_l || 0,
              arm_r: wData.measurements?.arm_r || 0,
            },
            photos: {
              face: wData.photos?.face || "",
              profile: wData.photos?.profile || "",
              back: wData.photos?.back || "",
            }
          });
        });

        // Store weekly records sorted descending for lists, but comparisons will reference them
        setWeeklyRecords(recordsList);

        // Prepopulate comparator weeks if we have at least 2 records
        if (recordsList.length >= 2) {
          setCompareWeekA(recordsList[0].id);
          setCompareWeekB(recordsList[recordsList.length - 1].id);
        } else if (recordsList.length === 1) {
          setCompareWeekA(recordsList[0].id);
          setCompareWeekB(recordsList[0].id);
        }

        setFetching(false);
      } catch (err) {
        console.error("Error loading progress data:", err);
        setFetching(false);
      }
    };

    loadProgressData();
  }, [user, loading]);

  if (loading || fetching) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground font-serif">Analyse de tes bilans et progrès...</p>
        </div>
      </div>
    );
  }

  // Find selected comparison records
  const recordA = weeklyRecords.find((r) => r.id === compareWeekA);
  const recordB = weeklyRecords.find((r) => r.id === compareWeekB);

  // Helper function to render measurement delta
  const renderDelta = (valA: number, valB: number) => {
    if (!valA || !valB) return <span className="text-muted-foreground">-</span>;
    const diff = valB - valA;
    if (diff === 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-muted-foreground text-[10px]">
          <Minus className="h-3 w-3" /> 0 cm
        </span>
      );
    }
    const isLoss = diff < 0;
    return (
      <span className={`inline-flex items-center gap-0.5 font-bold text-[10px] ${isLoss ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-500"}`}>
        {isLoss ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
        {isLoss ? "" : "+"}{diff.toFixed(1)} cm
      </span>
    );
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-3xl lg:text-4xl font-bold font-serif text-foreground">Suivi des progrès</h2>
        <p className="text-sm text-muted-foreground">
          Visualise l'évolution de ton corps de manière objective.
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-muted rounded-lg border border-border max-w-md">
        <button
          onClick={() => setActiveTab("weight")}
          className={`py-2 px-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "weight"
              ? "bg-card text-primary shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" /> Poids
        </button>
        <button
          onClick={() => setActiveTab("measurements")}
          className={`py-2 px-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "measurements"
              ? "bg-card text-primary shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Ruler className="h-3.5 w-3.5" /> Mensurations
        </button>
        <button
          onClick={() => setActiveTab("photos")}
          className={`py-2 px-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "photos"
              ? "bg-card text-primary shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-3.5 w-3.5" /> Photos
        </button>
      </div>

      {/* WEIGHT TAB */}
      {activeTab === "weight" && (
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="space-y-2 lg:col-span-2">
            <h3 className="text-lg lg:text-xl font-serif font-semibold text-foreground px-1">Graphique de poids</h3>
            <WeightChart data={chartData} />
          </div>

          <Card className="border border-border bg-card lg:col-span-1">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-serif font-semibold">Historique quotidien</CardTitle>
              <CardDescription>Tes dernières pesées enregistrées</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {dailyWeights.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground font-serif">
                  Aucun historique de pesée disponible. Fais ton premier bilan quotidien pour commencer.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-border">
                  {dailyWeights.map((w, idx) => (
                    <div key={w.date} className="flex justify-between items-center px-4 py-3 hover:bg-muted/10 transition-all text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {new Date(w.created_at).toLocaleDateString("fr-FR", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-foreground text-sm">{w.weight.toFixed(1)} kg</span>
                        {idx < dailyWeights.length - 1 ? (
                          (() => {
                            const diff = w.weight - dailyWeights[idx + 1].weight;
                            if (diff === 0) return <span className="text-[10px] text-muted-foreground">0</span>;
                            return (
                              <span className={`text-[10px] font-bold ${diff < 0 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-500"}`}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-[10px] text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* MEASUREMENTS TAB */}
      {activeTab === "measurements" && (
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Comparison tool */}
          {weeklyRecords.length < 1 ? (
            <Card className="border border-border bg-card p-6 text-center text-xs text-muted-foreground font-serif lg:col-span-3">
              Tu dois compléter au moins ton onboarding pour voir tes mensurations initiales.
            </Card>
          ) : (
            <>
              <Card className="border border-border bg-card shadow-xs lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-serif font-semibold">Comparateur de mensurations</CardTitle>
                  <CardDescription>Compare deux bilans pour analyser ton évolution centimètre par centimètre.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground block">Point A (Départ)</label>
                      <select
                        value={compareWeekA}
                        onChange={(e) => setCompareWeekA(e.target.value)}
                        className="w-full bg-muted border border-border text-foreground py-1.5 px-2 rounded-md text-xs font-serif focus:outline-hidden"
                      >
                        {weeklyRecords.map((r) => (
                          <option key={r.id} value={r.id}>{r.date}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground block">Point B (Arrivée)</label>
                      <select
                        value={compareWeekB}
                        onChange={(e) => setCompareWeekB(e.target.value)}
                        className="w-full bg-muted border border-border text-foreground py-1.5 px-2 rounded-md text-xs font-serif focus:outline-hidden"
                      >
                        {[...weeklyRecords].reverse().map((r) => (
                          <option key={r.id} value={r.id}>{r.date}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {recordA && recordB && (
                    <div className="border border-border/80 rounded-lg overflow-hidden divide-y divide-border bg-card/50 text-xs">
                      {/* Neck */}
                      <div className="flex justify-between items-center p-3">
                        <span className="font-medium text-foreground">Cou</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{recordA.measurements.neck} cm</span>
                          <span className="font-semibold text-foreground">→ {recordB.measurements.neck} cm</span>
                          {renderDelta(recordA.measurements.neck, recordB.measurements.neck)}
                        </div>
                      </div>
                      {/* Waist */}
                      <div className="flex justify-between items-center p-3">
                        <span className="font-medium text-foreground">Taille (Nombril)</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{recordA.measurements.waist} cm</span>
                          <span className="font-semibold text-foreground">→ {recordB.measurements.waist} cm</span>
                          {renderDelta(recordA.measurements.waist, recordB.measurements.waist)}
                        </div>
                      </div>
                      {/* Hips */}
                      <div className="flex justify-between items-center p-3">
                        <span className="font-medium text-foreground">Hanches (Fessiers)</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{recordA.measurements.hips} cm</span>
                          <span className="font-semibold text-foreground">→ {recordB.measurements.hips} cm</span>
                          {renderDelta(recordA.measurements.hips, recordB.measurements.hips)}
                        </div>
                      </div>
                      {/* Arms */}
                      <div className="flex justify-between items-center p-3">
                        <span className="font-medium text-foreground">Bras (G/D moyenne)</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">
                            {((recordA.measurements.arm_l + recordA.measurements.arm_r) / 2).toFixed(1)} cm
                          </span>
                          <span className="font-semibold text-foreground">
                            → {((recordB.measurements.arm_l + recordB.measurements.arm_r) / 2).toFixed(1)} cm
                          </span>
                          {renderDelta(
                            (recordA.measurements.arm_l + recordA.measurements.arm_r) / 2,
                            (recordB.measurements.arm_l + recordB.measurements.arm_r) / 2
                          )}
                        </div>
                      </div>
                      {/* Thighs */}
                      <div className="flex justify-between items-center p-3">
                        <span className="font-medium text-foreground">Cuisses (G/D moyenne)</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">
                            {((recordA.measurements.thigh_l + recordA.measurements.thigh_r) / 2).toFixed(1)} cm
                          </span>
                          <span className="font-semibold text-foreground">
                            → {((recordB.measurements.thigh_l + recordB.measurements.thigh_r) / 2).toFixed(1)} cm
                          </span>
                          {renderDelta(
                            (recordA.measurements.thigh_l + recordA.measurements.thigh_r) / 2,
                            (recordB.measurements.thigh_l + recordB.measurements.thigh_r) / 2
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Complete measurement log */}
              <div className="space-y-3 lg:col-span-1">
                <h3 className="text-sm font-serif font-bold text-foreground px-1 uppercase tracking-wider">Historique complet</h3>
                <div className="space-y-3 lg:max-h-[600px] lg:overflow-y-auto lg:pr-2">
                  {[...weeklyRecords].reverse().map((rec) => (
                    <Card key={rec.id} className="border border-border/80 bg-card/65 p-3 text-xs">
                      <div className="flex justify-between items-center border-b border-border/50 pb-2 mb-2">
                        <span className="font-bold font-serif text-secondary">{rec.date}</span>
                        <span className="text-[10px] text-muted-foreground">{rec.id !== "baseline" ? `ID: ${rec.id}` : "Onboarding"}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-muted/50 p-1.5 rounded-sm">
                          <span className="text-[9px] text-muted-foreground block uppercase">Taille</span>
                          <strong className="text-foreground">{rec.measurements.waist} cm</strong>
                        </div>
                        <div className="bg-muted/50 p-1.5 rounded-sm">
                          <span className="text-[9px] text-muted-foreground block uppercase">Cou</span>
                          <strong className="text-foreground">{rec.measurements.neck} cm</strong>
                        </div>
                        <div className="bg-muted/50 p-1.5 rounded-sm">
                          <span className="text-[9px] text-muted-foreground block uppercase">Hanches</span>
                          <strong className="text-foreground">{rec.measurements.hips} cm</strong>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* PHOTOS TAB */}
      {activeTab === "photos" && (
        <div className="space-y-6">
          {weeklyRecords.length < 1 ? (
            <Card className="border border-border bg-card p-6 text-center text-xs text-muted-foreground font-serif">
              Aucune photo de progrès disponible. Complete ton premier bilan hebdomadaire en téléchargeant tes photos.
            </Card>
          ) : (
            <>
              {/* Image Comparator Card */}
              <Card className="border border-border bg-card shadow-xs">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-serif font-semibold">Visualisateur de recomposition</CardTitle>
                  <CardDescription>Mets tes photos côte à côte pour analyser ta recomposition corporelle.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-4">
                  {/* Dropdowns */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground block">Avant (Point A)</label>
                      <select
                        value={compareWeekA}
                        onChange={(e) => setCompareWeekA(e.target.value)}
                        className="w-full bg-muted border border-border text-foreground py-1.5 px-2 rounded-md text-xs font-serif focus:outline-hidden"
                      >
                        {weeklyRecords.map((r) => (
                          <option key={r.id} value={r.id}>{r.date}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-muted-foreground block">Après (Point B)</label>
                      <select
                        value={compareWeekB}
                        onChange={(e) => setCompareWeekB(e.target.value)}
                        className="w-full bg-muted border border-border text-foreground py-1.5 px-2 rounded-md text-xs font-serif focus:outline-hidden"
                      >
                        {[...weeklyRecords].reverse().map((r) => (
                          <option key={r.id} value={r.id}>{r.date}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Photo type buttons */}
                  <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-md border border-border/80">
                    {(["face", "profile", "back"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setPhotoType(type)}
                        className={`py-1 rounded-sm text-[10px] uppercase tracking-wider font-semibold transition-all ${
                          photoType === type ? "bg-card text-primary font-bold shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {type === "face" ? "Face" : type === "profile" ? "Profil" : "Dos"}
                      </button>
                    ))}
                  </div>

                  {/* Comparison Side-by-Side Images */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {/* Before Image */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground block text-center uppercase tracking-wider">
                        {recordA ? recordA.date : "Départ"}
                      </span>
                      <div className="aspect-[3/4] bg-muted border border-border rounded-lg overflow-hidden flex items-center justify-center relative">
                        {recordA?.photos?.[photoType] ? (
                          <img
                            src={recordA.photos[photoType]}
                            alt={`Photo ${photoType} - ${recordA.date}`}
                            className="object-cover w-full h-full"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic px-2 text-center">Aucune photo</span>
                        )}
                      </div>
                    </div>

                    {/* After Image */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-primary block text-center uppercase tracking-wider">
                        {recordB ? recordB.date : "Actuel"}
                      </span>
                      <div className="aspect-[3/4] bg-muted border border-border rounded-lg overflow-hidden flex items-center justify-center relative">
                        {recordB?.photos?.[photoType] ? (
                          <img
                            src={recordB.photos[photoType]}
                            alt={`Photo ${photoType} - ${recordB.date}`}
                            className="object-cover w-full h-full"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic px-2 text-center">Aucune photo</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Feed of all checkin photo galleries */}
              <div className="space-y-4">
                <h3 className="text-sm font-serif font-bold text-foreground px-1 uppercase tracking-wider">Toutes tes galeries</h3>
                <div className="space-y-4">
                  {[...weeklyRecords].reverse().map((rec) => (
                    <Card key={rec.id} className="border border-border bg-card/50">
                      <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-serif font-bold text-secondary">{rec.date}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="aspect-[3/4] bg-muted rounded-md overflow-hidden border border-border flex items-center justify-center relative">
                            {rec.photos?.face ? (
                              <img
                                src={rec.photos.face}
                                alt="Face"
                                className="object-cover w-full h-full"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="text-[8px] text-muted-foreground">Pas de face</span>
                            )}
                            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] px-1 py-0.2 rounded-sm font-semibold uppercase">Face</span>
                          </div>
                          <div className="aspect-[3/4] bg-muted rounded-md overflow-hidden border border-border flex items-center justify-center relative">
                            {rec.photos?.profile ? (
                              <img
                                src={rec.photos.profile}
                                alt="Profil"
                                className="object-cover w-full h-full"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="text-[8px] text-muted-foreground">Pas de profil</span>
                            )}
                            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] px-1 py-0.2 rounded-sm font-semibold uppercase">Profil</span>
                          </div>
                          <div className="aspect-[3/4] bg-muted rounded-md overflow-hidden border border-border flex items-center justify-center relative">
                            {rec.photos?.back ? (
                              <img
                                src={rec.photos.back}
                                alt="Dos"
                                className="object-cover w-full h-full"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="text-[8px] text-muted-foreground">Pas de dos</span>
                            )}
                            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] px-1 py-0.2 rounded-sm font-semibold uppercase">Dos</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
