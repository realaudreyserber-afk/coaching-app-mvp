/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Loader } from "@/components/ui/loader";
import React, { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import Link from "next/link";
import WeightChart, { WeightDataPoint } from "@/components/dashboard/weight-chart";
import { Activity, Sparkles, TrendingUp, Camera, Ruler, Dumbbell, Moon, Droplets, Smile, Flame, Coffee, Cookie, CircleDot } from "lucide-react";
import { HudCard, PanelHeader, StatNum, Tag } from "@/components/nodream";
import { WeightHistoryRow } from "@/components/progress/weight-history-row";
import { Overview, Ring, Spark, MiniLine, MultiLine, Delta, Hint, Section, HUD, LIFT_META, MEASURE_LABELS } from "@/components/progress/viz";

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

// Saisie rapide (tactical input + label helpers)
const inputBase: React.CSSProperties = {
  background: 'var(--glass-bg-2)',
  border: '1px solid var(--glass-border)',
  color: 'var(--fg-1)',
  fontSize: 12,
  padding: '0 12px',
  height: 36,
  width: '100%',
  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.18em',
  color: 'var(--fg-4)',
  textTransform: 'uppercase',
  fontWeight: 700,
  display: 'block',
  marginBottom: 6,
};

// Petit panneau interne (bordure chamfrée) pour grouper dans une Section.
const tile: React.CSSProperties = {
  background: 'var(--glass-bg-2)',
  border: '1px solid var(--glass-border)',
  padding: '12px 14px',
  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
};

const ANCHORS = [
  { id: "forme", label: "Forme" },
  { id: "poids", label: "Poids" },
  { id: "mesures", label: "Mesures" },
  { id: "photos", label: "Photos" },
  { id: "force", label: "Force" },
  { id: "recup", label: "Récup" },
  { id: "ressenti", label: "Ressenti" },
  { id: "habitudes", label: "Habitudes" },
];

export default function ProgressPage() {
  const { user, loading, getFreshToken } = useAuth();

  // Données agrégées (lecture seule) — mêmes snapshots que les agents (DRY).
  const [overview, setOverview] = useState<Overview | null>(null);

  // Analyse ORACLE.IA (opt-in, cache 6 h côté serveur).
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const handleRequestAnalysis = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiErr(null);
    try {
      const token = await getFreshToken();
      if (!token) throw new Error("Auth requise");
      const res = await fetch("/api/ai/coach-progress-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "analysis_failed");
      setAiAnalysis(data.analysis);
    } catch (e: any) {
      setAiErr(e?.message ?? "erreur");
    } finally {
      setAiLoading(false);
    }
  };

  const [fetching, setFetching] = useState(true);
  const [chartData, setChartData] = useState<WeightDataPoint[]>([]);
  const [dailyWeights, setDailyWeights] = useState<any[]>([]);
  const [weeklyRecords, setWeeklyRecords] = useState<WeeklyRecord[]>([]);

  // Comparateur photos
  const [compareWeekA, setCompareWeekA] = useState<string>("");
  const [compareWeekB, setCompareWeekB] = useState<string>("");
  const [photoType, setPhotoType] = useState<"face" | "profile" | "back">("face");

  // Saisie rapide de poids directement depuis la page Suivi (la courbe lit
  // checkins_daily ; on upsert le même doc du jour en merge pour rester
  // cohérent avec le check-in quotidien). refreshTick relance le chargement.
  const [refreshTick, setRefreshTick] = useState(0);
  const [weighInput, setWeighInput] = useState("");
  const [weighSaving, setWeighSaving] = useState(false);
  const [weighMsg, setWeighMsg] = useState<string | null>(null);

  const handleQuickWeighIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || weighSaving) return;
    const w = parseFloat(weighInput.replace(",", "."));
    if (!Number.isFinite(w) || w < 20 || w > 400) {
      setWeighMsg("Poids invalide (20–400 kg).");
      return;
    }
    setWeighSaving(true);
    setWeighMsg(null);
    try {
      // Même format de doc-id que /checkin/daily pour viser le MÊME document du
      // jour (pas de doublon). On écrit aussi `date` (cf. fix audit #7).
      const todayStr = new Date().toISOString().split("T")[0];
      await setDoc(
        doc(db, "users", user.uid, "checkins_daily", todayStr),
        {
          weight: w,
          date: todayStr,
          // Audit QA #6 : l'« Historique quotidien » et la courbe trient par
          // `created_at` (orderBy) → un doc sans ce champ est EXCLU de la query
          // (la pesée n'apparaissait pas). On l'écrit donc aussi. Si un check-in
          // complet existe déjà ce jour, le merge ne fait que rafraîchir l'horodatage.
          created_at: new Date().toISOString(),
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );
      setWeighInput("");
      setWeighMsg("Pesée enregistrée ✓");
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setWeighMsg(err instanceof Error ? err.message : "Échec de l'enregistrement");
    } finally {
      setWeighSaving(false);
    }
  };

  // Charge l'agrégat /api/progress/overview (relancé après une pesée).
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getFreshToken();
        if (!token) return;
        const res = await fetch("/api/progress/overview", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setOverview(json);
      } catch { /* dégradation gracieuse */ }
    })();
    return () => { cancelled = true; };
  }, [user, loading, getFreshToken, refreshTick]);

  useEffect(() => {
    if (loading || !user) return;

    const loadProgressData = async () => {
      try {
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

        // Wave 11E — Cap to the last 180 daily check-ins (~6 months). Without
        // limit the chart re-downloaded the entire history on every visit,
        // and on a 2-year veteran account would push ~700 docs through.
        const dailyRef = collection(db, "users", user.uid, "checkins_daily");
        const dailyQuery = query(dailyRef, orderBy("created_at", "desc"), limit(180));
        const dailySnap = await getDocs(dailyQuery);

        const weightsList: any[] = [];
        dailySnap.forEach((docSnap) => {
          // Ignore les docs check-in SANS pesée (ressenti seul logué par le coach,
          // ou check-in sans poids) : sinon weight=undefined casse la moyenne mobile.
          const w = docSnap.data().weight;
          if (typeof w !== "number") return;
          weightsList.push({
            date: docSnap.id,
            weight: w,
            created_at: docSnap.data().created_at,
          });
        });

        setDailyWeights(weightsList);

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
              date: c.date.substring(5),
              weight: c.weight,
              average: parseFloat((sum / count).toFixed(2)),
            };
          });
          setChartData(formattedData);
        }

        // Wave 11E — Cap to the last 104 weekly check-ins (~2 years).
        const weeklyRef = collection(db, "users", user.uid, "checkins_weekly");
        const weeklyQuery = query(weeklyRef, orderBy("created_at", "asc"), limit(104));
        const weeklySnap = await getDocs(weeklyQuery);

        const recordsList: WeeklyRecord[] = [];

        if (baselineRecord) {
          recordsList.push(baselineRecord);
        }

        weeklySnap.forEach((docSnap) => {
          const wData = docSnap.data();
          recordsList.push({
            id: docSnap.id,
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

        setWeeklyRecords(recordsList);

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
  }, [user, loading, refreshTick]);

  if (loading || fetching) {
    return (
      <Loader size="fullscreen" message="Analyse de tes bilans et progrès..." />
    );
  }

  const recordA = weeklyRecords.find((r) => r.id === compareWeekA);
  const recordB = weeklyRecords.find((r) => r.id === compareWeekB);

  // ---- Dérivés des données agrégées ----
  const forme = overview?.forme ?? null;
  const formeColor = forme?.score == null ? 'var(--fg-4)' : forme.score >= 60 ? HUD.gold : forme.score >= 40 ? HUD.tech : HUD.alert;
  const weight = overview?.weight ?? null;
  const currentKg = weight?.current ?? (dailyWeights.length ? dailyWeights[0].weight : null);
  const weightDeltaText = weight
    ? (weight.delta_kg === 0 ? 'stable sur 7 j' : `${weight.delta_kg > 0 ? '+' : ''}${weight.delta_kg} kg sur 7 j`)
    : undefined;
  const prs = overview?.prs ?? null;
  const sleep = overview?.sleep ?? null;
  const hrv = overview?.hrv ?? null;
  const hydration = overview?.hydration ?? null;
  const habits = overview?.habits ?? null;
  const substances = overview?.substances ?? null;
  const cravings = overview?.cravings ?? null;
  const cycle = overview?.cycle ?? null;
  const subjective = overview?.subjective ?? null;
  const series = overview?.series ?? null;
  const photos = overview?.photos ?? null;

  const liftSeries = series?.lifts
    ? Object.entries(series.lifts).map(([k, pts]) => ({ label: LIFT_META[k]?.label ?? k, color: LIFT_META[k]?.color ?? HUD.gold, unit: 'kg', points: pts.map((p) => ({ date: p.date, value: p.e1rm })) }))
    : [];
  const energy = subjective?.map((s) => s.energy) ?? [];
  const mood = subjective?.map((s) => s.mood) ?? [];
  const latestSubj = subjective && subjective.length ? subjective[subjective.length - 1] : null;
  const hydraPct = hydration ? (hydration.today_effective_ml / Math.max(1, hydration.today_target_ml)) * 100 : 0;

  // Lignes du comparateur de mensurations (source : checkins_weekly G/D).
  const measureRows = recordA && recordB ? [
    { label: 'Cou', a: recordA.measurements.neck, b: recordB.measurements.neck },
    { label: 'Taille (nombril)', a: recordA.measurements.waist, b: recordB.measurements.waist },
    { label: 'Hanches', a: recordA.measurements.hips, b: recordB.measurements.hips },
    { label: 'Bras (G/D moy)', a: (recordA.measurements.arm_l + recordA.measurements.arm_r) / 2, b: (recordB.measurements.arm_l + recordB.measurements.arm_r) / 2 },
    { label: 'Cuisses (G/D moy)', a: (recordA.measurements.thigh_l + recordA.measurements.thigh_r) / 2, b: (recordB.measurements.thigh_l + recordB.measurements.thigh_r) / 2 },
  ] : [];

  const iconTitle = (Icon: React.ElementType, label: string, color: string) => (
    <span className="flex items-center gap-2"><Icon className="h-4 w-4" style={{ color }} aria-hidden="true" /> {label}</span>
  );

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-4">
      {/* En-tête (titres adoucis, marque dans l'eyebrow codé) */}
      <div className="space-y-2">
        <span className="mono" style={{ fontSize: 10, letterSpacing: '0.3em', color: 'var(--accent-tech)', opacity: 0.85 }}>
          [PROG-TRACK · v2]
        </span>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 'var(--type-h1)', letterSpacing: 'var(--tracking-display)', lineHeight: 1.05, color: 'var(--fg-1)', marginTop: 4 }}>
          Tes <span style={{ color: 'var(--gold-400)' }}>progrès</span>
        </h2>
        <p className="mono" style={{ marginTop: 6, fontSize: 'var(--type-meta)', letterSpacing: '0.18em', color: 'var(--fg-4)', textTransform: 'uppercase' }}>
          Évolution objective · sans illusion
        </p>
      </div>

      {/* Barre d'ancres (saut de section, non-sticky pour ne pas chevaucher le header) */}
      <nav aria-label="Sections" className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {ANCHORS.map((a) => (
          <a key={a.id} href={`#${a.id}`} className="mono shrink-0" style={{ padding: '6px 12px', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-3)', background: 'var(--glass-bg-2)', border: '1px solid var(--glass-border)', clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}>
            {a.label}
          </a>
        ))}
      </nav>

      {/* FORME DU JOUR — hero readiness */}
      <section id="forme" style={{ scrollMarginTop: 72 }}>
        <HudCard accent="tech" chamfer="sm" corners style={{ padding: '1.1rem 1.25rem' }}>
          <div className="flex items-center gap-5">
            <Ring pct={forme?.score ?? 0} color={formeColor} size={116} stroke={11} label={forme?.score != null ? String(forme.score) : '—'} sub="/100" />
            <div className="min-w-0 flex-1">
              <span className="mono" style={{ fontSize: 10, letterSpacing: '0.3em', color: 'var(--accent-tech)', opacity: 0.7 }}>[FORME-DU-JOUR]</span>
              <p style={{ fontSize: '1.35rem', fontWeight: 900, color: formeColor, margin: '2px 0 0', letterSpacing: '-0.01em' }}>{forme?.label ?? '—'}</p>
              {forme && forme.drivers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {forme.drivers.map((d, i) => (
                    <Tag key={i} accent={d.ok ? 'tech' : 'gold'}>{d.ok ? '✓' : '↓'} {d.label}</Tag>
                  ))}
                </div>
              ) : (
                <p className="mono" style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 8, lineHeight: 1.5 }}>Logge ta récup (sommeil, HRV, hydratation) pour activer ton score.</p>
              )}
            </div>
          </div>
        </HudCard>
      </section>

      {/* POIDS — chiffre + saisie inline + courbe + historique */}
      <Section id="poids" code="POIDS · 7J-MA" title={iconTitle(TrendingUp, 'Poids', 'var(--gold-400)')} accent="gold" right={weight ? <Delta value={weight.delta_pct} /> : null}>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <StatNum value={currentKg != null ? currentKg.toFixed(1) : '—'} unit="kg" accent="gold" label="Poids actuel" delta={weightDeltaText} />
          <form onSubmit={handleQuickWeighIn} className="flex items-end gap-2">
            <div style={{ width: 120 }}>
              <label htmlFor="quick-weigh" style={labelStyle}>Pesée du jour</label>
              <input id="quick-weigh" type="number" inputMode="decimal" step="0.1" min={20} max={400} value={weighInput} onChange={(e) => setWeighInput(e.target.value)} placeholder="ex. 82.4" style={inputBase} disabled={weighSaving} />
            </div>
            <button type="submit" disabled={weighSaving} className="btn btn-primary mono" style={{ height: 36, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              {weighSaving ? "…" : "Logger"}
            </button>
          </form>
        </div>
        {weighMsg && (
          <p className="mono" role="status" style={{ fontSize: 10, letterSpacing: '0.1em', color: weighMsg.includes('✓') ? 'var(--accent-tech)' : 'var(--alert-500)', marginBottom: 12 }}>{weighMsg}</p>
        )}
        {chartData.length > 0 ? (
          <WeightChart data={chartData} />
        ) : (
          <Hint>« je pèse 82,4 kg » — dicte-le au coach ou logge ci-dessus</Hint>
        )}
        {dailyWeights.length > 0 && (
          <div className="mt-3">
            <PanelHeader code="HIST-QUOTI" title="Historique quotidien" accent="tech" right={<Tag accent="tech">{dailyWeights.length}</Tag>} />
            <ul className="max-h-56 overflow-y-auto" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {dailyWeights.map((w, idx) => {
                const next = dailyWeights[idx + 1];
                const delta = next ? w.weight - next.weight : undefined;
                return <WeightHistoryRow key={w.date} createdAt={w.created_at} weight={w.weight} delta={delta} />;
              })}
            </ul>
          </div>
        )}
      </Section>

      {/* MENSURATIONS — comparateur point A → point B (cm, source checkins_weekly) */}
      <Section id="mesures" code="COMPARATEUR-MENS" title={iconTitle(Ruler, 'Mensurations', 'var(--gold-400)')} accent="gold"
        right={<Link href="/progress/measurements" className="mono inline-flex items-center gap-1.5" style={{ height: 30, padding: '0 10px', background: 'var(--accent-tech-tint)', border: '1px solid var(--accent-tech)', color: 'var(--accent-tech)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}><Ruler className="h-3 w-3" aria-hidden="true" /> Saisir</Link>}>
        {weeklyRecords.length < 1 ? (
          <Hint>« tour de taille 96, bras 38 » — ou complète l'onboarding</Hint>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Point A · Départ</label>
                <select value={compareWeekA} onChange={(e) => setCompareWeekA(e.target.value)} className="mono" style={inputBase}>
                  {weeklyRecords.map((r) => <option key={r.id} value={r.id}>{r.date}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Point B · Arrivée</label>
                <select value={compareWeekB} onChange={(e) => setCompareWeekB(e.target.value)} className="mono" style={inputBase}>
                  {[...weeklyRecords].reverse().map((r) => <option key={r.id} value={r.id}>{r.date}</option>)}
                </select>
              </div>
            </div>
            {measureRows.length > 0 && (
              <div style={tile}>
                {measureRows.map((row, idx, arr) => (
                  <div key={row.label} className="flex justify-between items-center" style={{ padding: '10px 0', borderBottom: idx < arr.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)', letterSpacing: '0.04em' }}>{row.label}</span>
                    {(!row.a || !row.b) ? (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-5)' }}>—</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-5)' }}>{row.a.toFixed(1)}</span>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--gold-400)', fontWeight: 700 }}>→ {row.b.toFixed(1)}</span>
                        <Delta value={row.b - row.a} unit=" cm" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {weeklyRecords.length > 1 && (
              <div>
                <PanelHeader code="HIST-HEBDO" title="Historique complet" accent="gold" right={<Tag accent="gold">{weeklyRecords.length}</Tag>} />
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {[...weeklyRecords].reverse().map((rec) => (
                    <div key={rec.id} style={tile}>
                      <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: 6, marginBottom: 6 }}>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)' }}>{rec.date}</span>
                        <Tag accent={rec.id === 'baseline' ? 'gold' : 'tech'}>{rec.id !== 'baseline' ? rec.id : 'INIT'}</Tag>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {[{ lbl: 'Taille', val: rec.measurements.waist }, { lbl: 'Cou', val: rec.measurements.neck }, { lbl: 'Hanches', val: rec.measurements.hips }].map((m) => (
                          <div key={m.lbl} style={{ padding: 4, background: 'var(--ink-900)', border: '1px solid var(--glass-border)' }}>
                            <span className="mono" style={{ color: 'var(--fg-5)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.lbl}</span>
                            <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)' }}>{m.val}<span style={{ fontSize: 8, color: 'var(--fg-5)', marginLeft: 1 }}>cm</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* PHOTOS — visualiseur recomposition (source checkins_weekly, fallback expiré conservé) */}
      <Section id="photos" code="VIS-RECOMPO" title={iconTitle(Camera, 'Photos', 'var(--gold-400)')} accent="gold"
        right={<Link href="/checkin/weekly" className="mono inline-flex items-center gap-1.5" style={{ height: 30, padding: '0 10px', background: 'var(--pink-tint-10)', border: '1px solid var(--pink-tint-35)', color: 'var(--pink-500)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}><Camera className="h-3 w-3" aria-hidden="true" /> Ajouter</Link>}>
        {weeklyRecords.length < 1 ? (
          <Hint>upload tes photos hebdo (face / profil / dos) pour activer le visualiseur</Hint>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Avant · Point A</label>
                <select value={compareWeekA} onChange={(e) => setCompareWeekA(e.target.value)} className="mono" style={inputBase}>
                  {weeklyRecords.map((r) => <option key={r.id} value={r.id}>{r.date}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Après · Point B</label>
                <select value={compareWeekB} onChange={(e) => setCompareWeekB(e.target.value)} className="mono" style={inputBase}>
                  {[...weeklyRecords].reverse().map((r) => <option key={r.id} value={r.id}>{r.date}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1" style={{ padding: 3, background: 'var(--glass-bg-2)', border: '1px solid var(--glass-border)', clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
              {(["face", "profile", "back"] as const).map((type) => {
                const active = photoType === type;
                return (
                  <button key={type} onClick={() => setPhotoType(type)} className="mono cursor-pointer transition-all" style={{ padding: '5px 6px', fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 700, background: active ? 'var(--gold-tint-15)' : 'transparent', color: active ? 'var(--gold-400)' : 'var(--fg-5)', border: active ? '1px solid var(--gold-tint-35)' : '1px solid transparent', clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)' }}>
                    {type === "face" ? "Face" : type === "profile" ? "Profil" : "Dos"}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Avant */}
              <div className="space-y-1">
                <span className="mono block text-center" style={{ fontSize: 9, letterSpacing: '0.25em', color: 'var(--fg-4)', textTransform: 'uppercase', fontWeight: 700 }}>{recordA ? recordA.date : "Départ"}</span>
                <div className="aspect-[3/4] relative overflow-hidden flex items-center justify-center" style={{ background: 'var(--ink-900)', border: '1px solid var(--glass-border)', clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  {recordA?.photos?.[photoType] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={recordA.photos[photoType]} alt={`Photo ${photoType} - ${recordA.date}`} className="object-cover w-full h-full" style={{ filter: 'grayscale(0.5) contrast(1.05)' }} referrerPolicy="no-referrer"
                      onError={(e) => { const target = e.currentTarget; target.style.display = 'none'; const fallback = target.parentElement?.querySelector('[data-photo-fallback]') as HTMLElement | null; if (fallback) fallback.style.display = 'flex'; }} />
                  ) : null}
                  <span data-photo-fallback className="mono items-center justify-center w-full h-full" style={{ display: recordA?.photos?.[photoType] ? 'none' : 'flex', fontSize: 9, letterSpacing: '0.15em', color: 'var(--fg-5)', textTransform: 'uppercase' }}>
                    {recordA?.photos?.[photoType] ? 'Photo expirée' : 'Aucune photo'}
                  </span>
                </div>
              </div>
              {/* Après */}
              <div className="space-y-1">
                <span className="mono block text-center" style={{ fontSize: 9, letterSpacing: '0.25em', color: 'var(--gold-400)', textTransform: 'uppercase', fontWeight: 700 }}>{recordB ? recordB.date : "Actuel"}</span>
                <div className="aspect-[3/4] relative overflow-hidden flex items-center justify-center" style={{ background: 'var(--ink-900)', border: '1px solid var(--gold-tint-25)', boxShadow: 'var(--glow-gold-soft)', clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  {recordB?.photos?.[photoType] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={recordB.photos[photoType]} alt={`Photo ${photoType} - ${recordB.date}`} className="object-cover w-full h-full" referrerPolicy="no-referrer"
                      onError={(e) => { const target = e.currentTarget; target.style.display = 'none'; const fallback = target.parentElement?.querySelector('[data-photo-fallback]') as HTMLElement | null; if (fallback) fallback.style.display = 'flex'; }} />
                  ) : null}
                  <span data-photo-fallback className="mono items-center justify-center w-full h-full" style={{ display: recordB?.photos?.[photoType] ? 'none' : 'flex', fontSize: 9, letterSpacing: '0.15em', color: 'var(--fg-5)', textTransform: 'uppercase' }}>
                    {recordB?.photos?.[photoType] ? 'Photo expirée' : 'Aucune photo'}
                  </span>
                </div>
              </div>
            </div>
            {weeklyRecords.length > 0 && (
              <div>
                <PanelHeader code="GAL-FEED" title="Galeries complètes" accent="gold" />
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {[...weeklyRecords].reverse().map((rec) => (
                    <div key={rec.id} style={tile}>
                      <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)' }}>{rec.date}</span>
                        <Tag accent={rec.id === 'baseline' ? 'gold' : 'tech'}>{rec.id !== 'baseline' ? rec.id : 'INIT'}</Tag>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(['face', 'profile', 'back'] as const).map((slot) => (
                          <div key={slot} className="aspect-[3/4] relative overflow-hidden flex items-center justify-center" style={{ background: 'var(--ink-900)', border: '1px solid var(--glass-border)', clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                            {rec.photos?.[slot] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={rec.photos[slot]} alt={slot} className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                            ) : <span className="mono" style={{ fontSize: 8, color: 'var(--fg-5)' }}>—</span>}
                            <span className="mono absolute bottom-1 left-1" style={{ background: 'rgba(6, 3, 15, 0.85)', color: 'var(--fg-2)', fontSize: 8, padding: '1px 5px', letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase', border: '1px solid var(--glass-border)' }}>{slot === 'face' ? 'Face' : slot === 'profile' ? 'Profil' : 'Dos'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* FORCE — 1RM + évolution 3 lifts */}
      <Section id="force" code="FORCE · 1RM" title={iconTitle(Dumbbell, 'Force', 'var(--gold-400)')} accent="gold" right={prs ? <Tag accent="gold">{prs.n_exercises_tracked} exos</Tag> : null}>
        {prs && prs.top_exercises.length > 0 ? (
          <>
            <ul className="space-y-1.5">
              {prs.top_exercises.slice(0, 6).map((e) => (
                <li key={e.exercise_name} className="flex items-baseline justify-between gap-2">
                  <span className="mono" style={{ fontSize: 13, color: 'var(--fg-2)' }}>{e.exercise_name}</span>
                  <span className="flex items-baseline gap-2 shrink-0"><span className="mono" style={{ color: 'var(--fg-1)', fontWeight: 700 }}>{e.current_1rm} kg</span><Delta value={e.delta_90day_pct} /></span>
                </li>
              ))}
            </ul>
            {liftSeries.some((s) => s.points.length >= 2) && (
              <div className="mt-4"><span className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--fg-4)', textTransform: 'uppercase' }}>Évolution 1RM</span><div className="mt-1"><MultiLine series={liftSeries} h={140} /></div></div>
            )}
          </>
        ) : <Hint>« PR : 100 kg au développé couché »</Hint>}
      </Section>

      {/* RÉCUPÉRATION — sommeil/HRV + hydratation */}
      <Section id="recup" code="RECUP · 7J" title={iconTitle(Moon, 'Récupération', 'var(--accent-tech)')} accent="tech">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div style={tile}>
            {sleep ? (
              <>
                <StatNum value={sleep.avg_hours_7day.toFixed(1)} unit="h / nuit" accent="tech" label="Sommeil 7j" delta={`qualité ${sleep.avg_quality_7day.toFixed(0)}/10 · ${sleep.short_nights_7day} courte(s)`} />
                {hrv && hrv.avg_hrv_7day !== null && (
                  <div className="mt-2"><Tag accent={hrv.is_chronic_drift ? 'red' : 'tech'}>HRV {hrv.avg_hrv_7day}ms · {hrv.is_chronic_drift ? 'fatigue' : 'stable'}</Tag></div>
                )}
                {series?.sleep && series.sleep.length >= 2 && (
                  <div className="mt-3"><span className="mono" style={{ fontSize: 10, color: 'var(--fg-5)' }}>Sommeil · {series.sleep.length}j</span><div className="mt-1"><Spark values={series.sleep.map((d) => d.hours)} max={9} color={HUD.tech} /></div></div>
                )}
              </>
            ) : <Hint>« mal dormi, 6 h »</Hint>}
          </div>
          <div style={tile}>
            <div className="flex items-center gap-2 mb-2"><Droplets className="h-4 w-4" style={{ color: 'var(--accent-tech)' }} aria-hidden="true" /><span className="mono" style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 700 }}>Hydratation</span></div>
            {hydration ? (
              <>
                <Ring pct={hydraPct} color={HUD.tech} label={`${(hydration.today_effective_ml / 1000).toFixed(1)}L`} sub={`/ ${(hydration.today_target_ml / 1000).toFixed(1)}L`} />
                <p className="mono" style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 8, textAlign: 'center' }}>Moy 7j {(hydration.avg_7day_ml / 1000).toFixed(1)}L · cible {hydration.days_target_hit_7day}/7</p>
                {series?.hydration && series.hydration.length >= 2 && (
                  <div className="mt-2"><Spark values={series.hydration.map((d) => d.ml)} max={Math.max(hydration.today_target_ml, ...series.hydration.map((d) => d.ml))} color={HUD.tech} /></div>
                )}
              </>
            ) : <Hint>« j'ai bu 1,5 L »</Hint>}
          </div>
        </div>
      </Section>

      {/* RESSENTI — énergie / humeur / faim */}
      <Section id="ressenti" code="RESSENTI · 14J" title={iconTitle(Smile, 'Ressenti', 'var(--accent-tech)')} accent="tech">
        {latestSubj ? (
          <div className="space-y-3">
            <div className="flex gap-1.5 flex-wrap">
              {latestSubj.energy != null && <Tag accent="tech">énergie {latestSubj.energy}/10</Tag>}
              {latestSubj.mood != null && <Tag accent="gold">humeur {latestSubj.mood}/10</Tag>}
              {latestSubj.hunger != null && <Tag accent="dim">faim {latestSubj.hunger}/10</Tag>}
            </div>
            <div><span className="mono" style={{ fontSize: 10, color: 'var(--fg-5)' }}>Énergie · 14j</span><div className="mt-1"><Spark values={energy} color={HUD.tech} h={48} /></div></div>
            <div><span className="mono" style={{ fontSize: 10, color: 'var(--fg-5)' }}>Humeur · 14j</span><div className="mt-1"><Spark values={mood} color={HUD.gold} h={48} /></div></div>
          </div>
        ) : <Hint>« crevé, mal dormi »</Hint>}
      </Section>

      {/* HABITUDES */}
      <Section id="habitudes" code="HABITUDES · 7J" title={iconTitle(Flame, 'Habitudes', 'var(--gold-400)')} accent="gold">
        {habits && habits.habits_summary.length > 0 ? (
          <div className="flex items-center gap-5">
            <Ring pct={habits.adherence_7day_pct} color={HUD.gold} label={`${habits.adherence_7day_pct}%`} sub="7 jours" />
            <ul className="flex-1 space-y-1">
              {habits.habits_summary.slice(0, 5).map((h) => (
                <li key={h.name} className="flex items-center justify-between" style={{ fontSize: 12 }}><span className="mono" style={{ color: 'var(--fg-3)' }}>{h.name}</span><span className="mono" style={{ color: 'var(--gold-400)' }}>🔥{h.current_streak}</span></li>
              ))}
            </ul>
          </div>
        ) : <Hint>crée une habitude à suivre dans l'app</Hint>}
      </Section>

      {/* ORACLE.IA — analyse (descendue sous les chiffres, opt-in explicite) */}
      <HudCard accent="tech" chamfer="sm" style={{ padding: "0.85rem 1.25rem" }}>
        <PanelHeader
          code="ORACLE.IA · ANALYSE"
          title={iconTitle(Activity, 'Analyse de ta progression (4 sem.)', 'var(--accent-tech)')}
          accent="tech"
          right={
            !aiAnalysis && !aiLoading ? (
              <button onClick={handleRequestAnalysis} className="btn btn-tech mono" style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", height: 36, padding: "0 14px" }}>
                <Sparkles className="h-3 w-3" aria-hidden="true" /> Demander l'analyse
              </button>
            ) : aiLoading ? <Tag accent="tech">ANALYSE...</Tag> : <Tag accent="tech">CACHED 6H</Tag>
          }
        />
        {aiErr && <p className="mono" style={{ fontSize: 11, color: "var(--alert-500)", letterSpacing: "0.05em" }}>[ERR-ANALYSE] {aiErr}</p>}
        {aiLoading && !aiAnalysis && <p className="mono" style={{ fontSize: 11, color: "var(--accent-tech)", letterSpacing: "0.1em", fontStyle: "italic", margin: 0 }}>ORACLE.IA · synthèse en cours...</p>}
        {aiAnalysis && <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "var(--type-body)", lineHeight: 1.7, color: "var(--fg-1)", margin: 0 }}>« {aiAnalysis} »</p>}
        {!aiAnalysis && !aiLoading && !aiErr && <p className="mono" style={{ fontSize: 11, color: "var(--fg-5)", letterSpacing: "0.05em", fontStyle: "italic", margin: 0 }}>Débrief optionnel : tendance poids, mesures, sessions, plateau éventuel. Cache 6 h.</p>}
      </HudCard>

      {/* CONDITIONNELS — substances / cycle / fringales */}
      {(substances && (substances.avg_7day_caffeine_mg > 0 || substances.total_alcohol_7day > 0)) || cycle?.current_phase || (cravings && cravings.days_with_cravings_7day > 0) ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {substances && (substances.avg_7day_caffeine_mg > 0 || substances.total_alcohol_7day > 0) && (
            <HudCard accent="gold" chamfer="sm" corners={false} style={{ padding: '0.85rem 1rem' }}>
              <div className="flex items-center gap-2 mb-1"><Coffee className="h-4 w-4" style={{ color: 'var(--gold-400)' }} aria-hidden="true" /><span className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--fg-4)', textTransform: 'uppercase', fontWeight: 700 }}>Substances</span></div>
              <p className="mono" style={{ fontSize: 13, color: 'var(--fg-2)' }}>Caféine <span style={{ color: 'var(--fg-1)', fontWeight: 700 }}>{Math.round(substances.today_caffeine_mg)}mg</span></p>
              {substances.total_alcohol_7day > 0 && <p className="mono" style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>Alcool {substances.total_alcohol_7day}u/7j</p>}
            </HudCard>
          )}
          {cycle?.current_phase && (
            <HudCard accent="tech" chamfer="sm" corners={false} style={{ padding: '0.85rem 1rem' }}>
              <div className="flex items-center gap-2 mb-1"><CircleDot className="h-4 w-4" style={{ color: 'var(--accent-tech)' }} aria-hidden="true" /><span className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--fg-4)', textTransform: 'uppercase', fontWeight: 700 }}>Cycle</span></div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', textTransform: 'capitalize' }}>{cycle.current_phase}</p>
            </HudCard>
          )}
          {cravings && cravings.days_with_cravings_7day > 0 && (
            <HudCard accent="gold" chamfer="sm" corners={false} style={{ padding: '0.85rem 1rem' }}>
              <div className="flex items-center gap-2 mb-1"><Cookie className="h-4 w-4" style={{ color: 'var(--gold-400)' }} aria-hidden="true" /><span className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--fg-4)', textTransform: 'uppercase', fontWeight: 700 }}>Fringales</span></div>
              <p className="mono" style={{ fontSize: 13, color: 'var(--fg-2)' }}>{cravings.days_with_cravings_7day}j/7 · {cravings.avg_intensity_7day.toFixed(1)}/10</p>
            </HudCard>
          )}
        </div>
      ) : null}
    </div>
  );
}
