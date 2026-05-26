/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Loader } from "@/components/ui/loader";
import React, { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import WeightChart, { WeightDataPoint } from "@/components/dashboard/weight-chart";
import { TrendingUp, Camera, Ruler, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { WeightHistoryRow } from "@/components/progress/weight-history-row";
import { HudCard, PanelHeader, Tag } from "@/components/nodream";

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

// Tactical input + label helpers
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

interface TacticalTabBtnProps {
  active: boolean;
  accent: 'gold' | 'tech' | 'pink';
  onClick: () => void;
  children: React.ReactNode;
}

function TacticalTabBtn({ active, accent, onClick, children }: TacticalTabBtnProps) {
  const colorMap = {
    gold: { bg: 'var(--gold-tint-15)', fg: 'var(--gold-400)', border: 'var(--gold-tint-35)', glow: 'var(--glow-gold-soft)' },
    tech: { bg: 'var(--accent-tech-tint)', fg: 'var(--accent-tech)', border: 'var(--accent-tech)', glow: '0 0 12px var(--accent-tech-tint-strong)' },
    pink: { bg: 'var(--pink-tint-10)', fg: 'var(--pink-500)', border: 'var(--pink-tint-35)', glow: '0 0 12px rgba(255, 42, 109, 0.3)' },
  };
  const c = colorMap[accent];
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className="mono flex items-center justify-center gap-1.5 py-2 px-2 transition-all cursor-pointer"
      style={{
        fontSize: 10,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        fontWeight: 700,
        background: active ? c.bg : 'transparent',
        color: active ? c.fg : 'var(--fg-4)',
        border: active ? `1px solid ${c.border}` : '1px solid transparent',
        boxShadow: active ? c.glow : 'none',
        clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
      }}
    >
      {children}
    </button>
  );
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

        const weeklyRef = collection(db, "users", user.uid, "checkins_weekly");
        const weeklyQuery = query(weeklyRef, orderBy("created_at", "asc"));
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
  }, [user, loading]);

  if (loading || fetching) {
    return (
      <Loader size="fullscreen" message="Analyse de tes bilans et progrès..." />
    );
  }

  const recordA = weeklyRecords.find((r) => r.id === compareWeekA);
  const recordB = weeklyRecords.find((r) => r.id === compareWeekB);

  const renderDelta = (valA: number, valB: number) => {
    if (!valA || !valB) return <span style={{ color: 'var(--fg-5)' }} className="mono">—</span>;
    const diff = valB - valA;
    if (diff === 0) {
      return (
        <span className="mono inline-flex items-center gap-0.5" style={{ color: 'var(--fg-4)', fontSize: 10 }}>
          <Minus className="h-3 w-3" aria-hidden="true" /> 0 cm
        </span>
      );
    }
    const isLoss = diff < 0;
    const color = isLoss ? 'var(--accent-tech)' : 'var(--gold-400)';
    return (
      <span
        className="mono inline-flex items-center gap-0.5"
        style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}
      >
        {isLoss
          ? <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
          : <ArrowUpRight className="h-3 w-3" aria-hidden="true" />}
        {isLoss ? "" : "+"}{diff.toFixed(1)} cm
      </span>
    );
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">
      {/* Tactical header */}
      <div className="space-y-2">
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.3em',
            color: 'var(--accent-tech)',
            opacity: 0.85,
          }}
        >
          [PROG-TRACK · v1]
        </span>
        <h2
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 'var(--type-h1)',
            letterSpacing: 'var(--tracking-display)',
            lineHeight: 1.05,
            color: 'var(--fg-1)',
            marginTop: 4,
          }}
        >
          Suivi <span style={{ color: 'var(--gold-400)' }}>tactique</span>
        </h2>
        <p
          className="mono"
          style={{
            marginTop: 6,
            fontSize: 'var(--type-meta)',
            letterSpacing: '0.18em',
            color: 'var(--fg-4)',
            textTransform: 'uppercase',
          }}
        >
          Évolution objective · sans illusion
        </p>
      </div>

      {/* Tactical tabs (3) */}
      <div
        className="grid grid-cols-3 gap-1 max-w-md"
        style={{
          padding: 4,
          background: 'var(--glass-bg-2)',
          border: '1px solid var(--glass-border)',
          clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
        }}
        role="tablist"
      >
        <TacticalTabBtn active={activeTab === "weight"} accent="gold" onClick={() => setActiveTab("weight")}>
          <TrendingUp className="h-3 w-3" aria-hidden="true" /> 01 Poids
        </TacticalTabBtn>
        <TacticalTabBtn active={activeTab === "measurements"} accent="tech" onClick={() => setActiveTab("measurements")}>
          <Ruler className="h-3 w-3" aria-hidden="true" /> 02 Mesures
        </TacticalTabBtn>
        <TacticalTabBtn active={activeTab === "photos"} accent="pink" onClick={() => setActiveTab("photos")}>
          <Camera className="h-3 w-3" aria-hidden="true" /> 03 Photos
        </TacticalTabBtn>
      </div>

      {/* WEIGHT TAB */}
      {activeTab === "weight" && (
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="space-y-3 lg:col-span-2">
            <div className="px-1 space-y-1">
              <span className="mono" style={{ fontSize: 10, letterSpacing: '0.3em', color: 'var(--gold-500)', opacity: 0.85 }}>
                [GRAPH-POIDS · 7J-MA]
              </span>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.01em', color: 'var(--fg-1)', margin: 0 }}>
                Courbe glissante
              </h3>
            </div>
            <WeightChart data={chartData} />
          </div>

          <HudCard accent="tech" chamfer="sm" className="lg:col-span-1" style={{ padding: '1rem 1.25rem' }}>
            <PanelHeader
              code="HIST-QUOTI"
              title="Historique quotidien"
              accent="tech"
              right={<Tag accent="tech">{dailyWeights.length}</Tag>}
            />
            {dailyWeights.length === 0 ? (
              <div
                className="mono text-center"
                style={{
                  padding: '24px 12px',
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  color: 'var(--fg-5)',
                  textTransform: 'uppercase',
                  background: 'var(--glass-bg-2)',
                  border: '1px dashed var(--glass-border)',
                  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                }}
              >
                Aucune pesée · démarre le check-in
              </div>
            ) : (
              <ul
                className="max-h-60 overflow-y-auto"
                style={{ margin: 0, padding: 0, listStyle: 'none' }}
              >
                {dailyWeights.map((w, idx) => {
                  const next = dailyWeights[idx + 1];
                  const delta = next ? w.weight - next.weight : undefined;
                  return (
                    <WeightHistoryRow
                      key={w.date}
                      createdAt={w.created_at}
                      weight={w.weight}
                      delta={delta}
                    />
                  );
                })}
              </ul>
            )}
          </HudCard>
        </div>
      )}

      {/* MEASUREMENTS TAB */}
      {activeTab === "measurements" && (
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          {weeklyRecords.length < 1 ? (
            <HudCard accent="tech" chamfer="sm" className="lg:col-span-3" style={{ padding: '1.25rem' }}>
              <p className="mono text-center" style={{ fontSize: 11, color: 'var(--fg-4)', letterSpacing: '0.1em' }}>
                Complète l&apos;onboarding pour activer le module mensurations.
              </p>
            </HudCard>
          ) : (
            <>
              <HudCard accent="tech" chamfer="sm" className="lg:col-span-2 lg:sticky lg:top-6 lg:self-start" style={{ padding: '1rem 1.25rem' }}>
                <PanelHeader
                  code="COMPARATEUR-MENS"
                  title={
                    <span className="flex items-center gap-2">
                      <Ruler className="h-4 w-4" style={{ color: 'var(--accent-tech)' }} aria-hidden="true" />
                      Comparateur mensurations
                    </span>
                  }
                  accent="tech"
                />
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>Point A · Départ</label>
                      <select
                        value={compareWeekA}
                        onChange={(e) => setCompareWeekA(e.target.value)}
                        className="mono"
                        style={inputBase}
                      >
                        {weeklyRecords.map((r) => (
                          <option key={r.id} value={r.id}>{r.date}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Point B · Arrivée</label>
                      <select
                        value={compareWeekB}
                        onChange={(e) => setCompareWeekB(e.target.value)}
                        className="mono"
                        style={inputBase}
                      >
                        {[...weeklyRecords].reverse().map((r) => (
                          <option key={r.id} value={r.id}>{r.date}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {recordA && recordB && (
                    <div
                      style={{
                        background: 'var(--glass-bg-2)',
                        border: '1px solid var(--glass-border)',
                        clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                      }}
                    >
                      {[
                        { label: 'Cou', a: recordA.measurements.neck, b: recordB.measurements.neck },
                        { label: 'Taille (nombril)', a: recordA.measurements.waist, b: recordB.measurements.waist },
                        { label: 'Hanches', a: recordA.measurements.hips, b: recordB.measurements.hips },
                        {
                          label: 'Bras (G/D moy)',
                          a: (recordA.measurements.arm_l + recordA.measurements.arm_r) / 2,
                          b: (recordB.measurements.arm_l + recordB.measurements.arm_r) / 2,
                        },
                        {
                          label: 'Cuisses (G/D moy)',
                          a: (recordA.measurements.thigh_l + recordA.measurements.thigh_r) / 2,
                          b: (recordB.measurements.thigh_l + recordB.measurements.thigh_r) / 2,
                        },
                      ].map((row, idx, arr) => (
                        <div
                          key={row.label}
                          className="flex justify-between items-center"
                          style={{
                            padding: '10px 14px',
                            borderBottom: idx < arr.length - 1 ? '1px solid var(--glass-border)' : 'none',
                          }}
                        >
                          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)', letterSpacing: '0.04em' }}>
                            {row.label}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-5)' }}>{row.a.toFixed(1)}</span>
                            <span className="mono" style={{ fontSize: 11, color: 'var(--gold-400)', fontWeight: 700 }}>
                              → {row.b.toFixed(1)}
                            </span>
                            {renderDelta(row.a, row.b)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </HudCard>

              {/* Historique vertical */}
              <div className="space-y-3 lg:col-span-1">
                <div className="px-1 space-y-1">
                  <span className="mono" style={{ fontSize: 9, letterSpacing: '0.3em', color: 'var(--gold-500)', opacity: 0.75 }}>
                    [HIST-HEBDO]
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 14, letterSpacing: '-0.01em', color: 'var(--fg-1)', margin: 0 }}>
                    Historique complet
                  </h3>
                </div>
                <div className="space-y-3 lg:max-h-[600px] lg:overflow-y-auto lg:pr-2">
                  {[...weeklyRecords].reverse().map((rec) => (
                    <HudCard
                      key={rec.id}
                      accent={rec.id === "baseline" ? "gold" : "tech"}
                      chamfer="sm"
                      corners={false}
                      style={{ padding: '0.65rem 0.85rem' }}
                    >
                      <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: 6, marginBottom: 6 }}>
                        <span
                          className="mono"
                          style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)', letterSpacing: '0.05em' }}
                        >
                          {rec.date}
                        </span>
                        <Tag accent={rec.id === "baseline" ? "gold" : "tech"}>
                          {rec.id !== "baseline" ? rec.id : "INIT"}
                        </Tag>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {[
                          { lbl: 'Taille', val: rec.measurements.waist },
                          { lbl: 'Cou', val: rec.measurements.neck },
                          { lbl: 'Hanches', val: rec.measurements.hips },
                        ].map((m) => (
                          <div
                            key={m.lbl}
                            style={{
                              padding: 4,
                              background: 'var(--ink-900)',
                              border: '1px solid var(--glass-border)',
                              clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
                            }}
                          >
                            <span className="eyebrow" style={{ color: 'var(--fg-5)', fontSize: 8 }}>{m.lbl}</span>
                            <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)' }}>
                              {m.val}<span style={{ fontSize: 8, color: 'var(--fg-5)', marginLeft: 1 }}>cm</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </HudCard>
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
            <HudCard accent="tech" chamfer="sm" style={{ padding: '1.25rem' }}>
              <p className="mono text-center" style={{ fontSize: 11, color: 'var(--fg-4)', letterSpacing: '0.1em' }}>
                Aucune galerie · upload tes photos hebdo pour activer le module.
              </p>
            </HudCard>
          ) : (
            <>
              {/* Comparator */}
              <HudCard accent="gold" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
                <PanelHeader
                  code="VIS-RECOMPO"
                  title={
                    <span className="flex items-center gap-2">
                      <Camera className="h-4 w-4" style={{ color: 'var(--gold-400)' }} aria-hidden="true" />
                      Visualiseur recomposition
                    </span>
                  }
                  accent="gold"
                />
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>Avant · Point A</label>
                      <select
                        value={compareWeekA}
                        onChange={(e) => setCompareWeekA(e.target.value)}
                        className="mono"
                        style={inputBase}
                      >
                        {weeklyRecords.map((r) => (
                          <option key={r.id} value={r.id}>{r.date}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Après · Point B</label>
                      <select
                        value={compareWeekB}
                        onChange={(e) => setCompareWeekB(e.target.value)}
                        className="mono"
                        style={inputBase}
                      >
                        {[...weeklyRecords].reverse().map((r) => (
                          <option key={r.id} value={r.id}>{r.date}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div
                    className="grid grid-cols-3 gap-1"
                    style={{
                      padding: 3,
                      background: 'var(--glass-bg-2)',
                      border: '1px solid var(--glass-border)',
                      clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    }}
                  >
                    {(["face", "profile", "back"] as const).map((type) => {
                      const active = photoType === type;
                      return (
                        <button
                          key={type}
                          onClick={() => setPhotoType(type)}
                          className="mono cursor-pointer transition-all"
                          style={{
                            padding: '5px 6px',
                            fontSize: 9,
                            letterSpacing: '0.25em',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            background: active ? 'var(--gold-tint-15)' : 'transparent',
                            color: active ? 'var(--gold-400)' : 'var(--fg-5)',
                            border: active ? '1px solid var(--gold-tint-35)' : '1px solid transparent',
                            clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
                          }}
                        >
                          {type === "face" ? "Face" : type === "profile" ? "Profil" : "Dos"}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {/* Before */}
                    <div className="space-y-1">
                      <span className="mono block text-center" style={{ fontSize: 9, letterSpacing: '0.25em', color: 'var(--fg-4)', textTransform: 'uppercase', fontWeight: 700 }}>
                        {recordA ? recordA.date : "Départ"}
                      </span>
                      <div
                        className="aspect-[3/4] relative overflow-hidden flex items-center justify-center"
                        style={{
                          background: 'var(--ink-900)',
                          border: '1px solid var(--glass-border)',
                          clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                        }}
                      >
                        {recordA?.photos?.[photoType] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={recordA.photos[photoType]}
                            alt={`Photo ${photoType} - ${recordA.date}`}
                            className="object-cover w-full h-full"
                            style={{ filter: 'grayscale(0.5) contrast(1.05)' }}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="mono" style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--fg-5)', textTransform: 'uppercase' }}>
                            Aucune photo
                          </span>
                        )}
                      </div>
                    </div>

                    {/* After */}
                    <div className="space-y-1">
                      <span className="mono block text-center" style={{ fontSize: 9, letterSpacing: '0.25em', color: 'var(--gold-400)', textTransform: 'uppercase', fontWeight: 700 }}>
                        {recordB ? recordB.date : "Actuel"}
                      </span>
                      <div
                        className="aspect-[3/4] relative overflow-hidden flex items-center justify-center"
                        style={{
                          background: 'var(--ink-900)',
                          border: '1px solid var(--gold-tint-25)',
                          boxShadow: 'var(--glow-gold-soft)',
                          clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                        }}
                      >
                        {recordB?.photos?.[photoType] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={recordB.photos[photoType]}
                            alt={`Photo ${photoType} - ${recordB.date}`}
                            className="object-cover w-full h-full"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="mono" style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--fg-5)', textTransform: 'uppercase' }}>
                            Aucune photo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </HudCard>

              {/* Feed galleries */}
              <div className="space-y-4">
                <div className="px-1 space-y-1">
                  <span className="mono" style={{ fontSize: 9, letterSpacing: '0.3em', color: 'var(--gold-500)', opacity: 0.75 }}>
                    [GAL-FEED]
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 14, letterSpacing: '-0.01em', color: 'var(--fg-1)', margin: 0 }}>
                    Galeries complètes
                  </h3>
                </div>
                <div className="space-y-4">
                  {[...weeklyRecords].reverse().map((rec) => (
                    <HudCard
                      key={rec.id}
                      accent={rec.id === "baseline" ? "gold" : "tech"}
                      chamfer="sm"
                      corners={false}
                      style={{ padding: '0.75rem 1rem' }}
                    >
                      <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)', letterSpacing: '0.05em' }}>
                          {rec.date}
                        </span>
                        <Tag accent={rec.id === "baseline" ? "gold" : "tech"}>
                          {rec.id !== "baseline" ? rec.id : "INIT"}
                        </Tag>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(['face', 'profile', 'back'] as const).map((slot) => (
                          <div
                            key={slot}
                            className="aspect-[3/4] relative overflow-hidden flex items-center justify-center"
                            style={{
                              background: 'var(--ink-900)',
                              border: '1px solid var(--glass-border)',
                              clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                            }}
                          >
                            {rec.photos?.[slot] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={rec.photos[slot]}
                                alt={slot}
                                className="object-cover w-full h-full"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="mono" style={{ fontSize: 8, color: 'var(--fg-5)', letterSpacing: '0.1em' }}>
                                —
                              </span>
                            )}
                            <span
                              className="mono absolute bottom-1 left-1"
                              style={{
                                background: 'rgba(6, 3, 15, 0.85)',
                                color: 'var(--fg-2)',
                                fontSize: 8,
                                padding: '1px 5px',
                                letterSpacing: '0.2em',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                border: '1px solid var(--glass-border)',
                              }}
                            >
                              {slot === 'face' ? 'Face' : slot === 'profile' ? 'Profil' : 'Dos'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </HudCard>
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
