/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Loader } from "@/components/ui/loader";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { UserSettings, UserProfile, TrainingEnvironment } from "@/types/user";
import { User, Settings as SettingsIcon, ShieldAlert, Download, LogOut, Save, Check, ShieldCheck } from "lucide-react";
import { flags } from "@/lib/features/flags";
import { HudCard, PanelHeader, Tag } from "@/components/nodream";

// ---------- Tactical UI helpers (inline styles to avoid a new component file) ----------
const inputBase: React.CSSProperties = {
  background: 'var(--glass-bg-2)',
  border: '1px solid var(--glass-border)',
  color: 'var(--fg-1)',
  fontSize: 12,
  padding: '0 12px',
  height: 40,
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

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  desc?: string;
  accent?: 'gold' | 'tech';
}

function TacticalToggle({ id, checked, onChange, label, desc, accent = 'gold' }: ToggleProps) {
  const onColor = accent === 'tech' ? 'var(--accent-tech)' : 'var(--gold-500)';
  const onGlow = accent === 'tech' ? '0 0 10px var(--accent-tech-tint-strong)' : 'var(--glow-gold-soft)';
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <span id={`${id}-label`} className="mono" style={{ ...labelStyle, marginBottom: 2 }}>
          {label}
        </span>
        {desc && (
          <span id={`${id}-desc`} className="mono" style={{ fontSize: 10, color: 'var(--fg-5)', letterSpacing: '0.05em' }}>
            {desc}
          </span>
        )}
      </div>
      <label className="relative inline-flex items-center cursor-pointer" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          aria-labelledby={`${id}-label`}
          aria-describedby={desc ? `${id}-desc` : undefined}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            position: 'relative',
            width: 40,
            height: 20,
            background: checked ? onColor : 'var(--glass-bg-2)',
            border: `1px solid ${checked ? onColor : 'var(--glass-border)'}`,
            boxShadow: checked ? onGlow : 'none',
            transition: 'all 150ms ease',
            clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: checked ? 22 : 2,
              width: 14,
              height: 14,
              background: checked ? 'var(--ink-900)' : 'var(--fg-3)',
              transition: 'left 150ms ease',
            }}
          />
        </span>
      </label>
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout, getFreshToken, refreshProfileStatus } = useAuth();
  const router = useRouter();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Profile settings
  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [activityLevel, setActivityLevel] = useState<UserProfile["activity_level"]>("sedentary");
  const [trainingEnvironment, setTrainingEnvironment] = useState<TrainingEnvironment>("gym");
  // BF connu — saisie directe pour bascule Mifflin-St Jeor → Katch-McArdle
  // (cf. lib/vertex/prompts/plan-generator.ts §3bis).
  const [bfPct, setBfPct] = useState("");
  const [bfMethod, setBfMethod] = useState<
    "" | "dexa" | "bodpod" | "inbody" | "caliper" | "navy" | "bia" | "photo"
  >("");

  // App preferences settings
  const [notifications, setNotifications] = useState(true);
  const [units, setUnits] = useState<UserSettings["units"]>("metric");
  const [language, setLanguage] = useState<UserSettings["language"]>("fr");

  // GDPR Actions state
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // GLP-1 Tracking state
  const [featureGlp1, setFeatureGlp1] = useState(false);
  const [glp1Active, setGlp1Active] = useState(false);
  const [glp1Molecule, setGlp1Molecule] = useState<"semaglutide" | "tirzepatide" | "liraglutide" | "other">("semaglutide");
  const [glp1Dose, setGlp1Dose] = useState("");
  const [glp1Frequency, setGlp1Frequency] = useState<"weekly" | "daily" | "other">("weekly");
  const [glp1StartDate, setGlp1StartDate] = useState("");
  const [glp1SideEffects, setGlp1SideEffects] = useState<string[]>([]);

  // Fasting Tracking state
  const [featureFasting, setFeatureFasting] = useState(false);
  const [fastingActive, setFastingActive] = useState(false);
  const [fastingType, setFastingType] = useState<"none" | "16:8" | "18:6" | "20:4" | "OMAD" | "custom">("16:8");
  const [fastingStart, setFastingStart] = useState("12:00");
  const [fastingEnd, setFastingEnd] = useState("20:00");
  const [fastingDays, setFastingDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  useEffect(() => {
    if (!user) return;

    const fetchUserSettings = async () => {
      try {
        setFeatureGlp1(flags.glp1());
        setFeatureFasting(flags.fasting());

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const uData = snap.data();
          if (uData.profile) {
            setName(uData.profile.name || "");
            setHeight(uData.profile.height ? String(uData.profile.height) : "");
            setActivityLevel(uData.profile.activity_level || "sedentary");
            setTrainingEnvironment(uData.profile.training_environment || "gym");
            // Pré-remplit la méthode BF seulement si c'est une mesure précise
            // ("photo" = mode estimation visuelle de l'onboarding → on garde
            // le sélecteur vide pour que le user puisse saisir une vraie mesure).
            const method = uData.profile.bf_method as string | undefined;
            if (method && method !== "unknown" && method !== "photo") {
              setBfMethod(method as typeof bfMethod);
            }
          }
          if (uData.baseline?.bf_pct != null) {
            setBfPct(String(uData.baseline.bf_pct));
          }
          if (uData.settings) {
            setNotifications(uData.settings.notifications !== false);
            setUnits(uData.settings.units || "metric");
            setLanguage(uData.settings.language || "fr");
          }
          if (uData.fasting_protocol) {
            setFastingActive(uData.fasting_protocol.active || false);
            setFastingType(uData.fasting_protocol.type || "16:8");
            setFastingStart(uData.fasting_protocol.eating_window_start || "12:00");
            setFastingEnd(uData.fasting_protocol.eating_window_end || "20:00");
            setFastingDays(uData.fasting_protocol.days_active || [0, 1, 2, 3, 4, 5, 6]);
          }
        }

        // Fetch GLP-1 if flag is active
        if (flags.glp1()) {
          const glp1Ref = doc(db, "users", user.uid, "medications", "glp1");
          const glp1Snap = await getDoc(glp1Ref);
          if (glp1Snap.exists()) {
            const gData = glp1Snap.data();
            setGlp1Active(gData.active || false);
            setGlp1Molecule(gData.molecule || "semaglutide");
            setGlp1Dose(gData.dose || "");
            setGlp1Frequency(gData.frequency || "weekly");
            setGlp1StartDate(gData.startDate || "");
            setGlp1SideEffects(gData.sideEffects || []);
          }
        }

        setLoadingProfile(false);
      } catch (err) {
        console.error("Error fetching settings:", err);
        setLoadingProfile(false);
      }
    };

    fetchUserSettings();
  }, [user]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const heightNum = parseFloat(height);
    if (isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
      setErrorMsg("Spécifie une taille valide en cm.");
      return;
    }

    // BF connu — optionnel. Si saisi : range strict + méthode obligatoire.
    let bfPctNum: number | null = null;
    if (bfPct.trim() !== "") {
      bfPctNum = parseFloat(bfPct);
      if (isNaN(bfPctNum) || bfPctNum < 3 || bfPctNum > 60) {
        setErrorMsg("BF doit être entre 3 et 60% (laisse vide si inconnu).");
        return;
      }
      if (!bfMethod) {
        setErrorMsg("Sélectionne la méthode utilisée pour mesurer ton BF.");
        return;
      }
    }

    setSaving(true);
    setErrorMsg("");
    setSaveSuccess(false);

    try {
      const userRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const currentData = docSnap.data();
        const updatedProfile = {
          ...currentData.profile,
          name: name.trim(),
          height: heightNum,
          activity_level: activityLevel,
          training_environment: trainingEnvironment,
          // Mémorise la méthode seulement si une mesure BF est fournie ce coup-ci
          ...(bfPctNum !== null && bfMethod ? { bf_method: bfMethod } : {}),
        };
        const updatedSettings: UserSettings = {
          notifications,
          units,
          language,
        };

        await updateDoc(userRef, {
          profile: updatedProfile,
          settings: updatedSettings,
          // Si BF saisi, met à jour baseline. Le coach lit baseline.bf_pct
          // en priorité (cf. lib/vertex/context-builder.ts profileBlock) et
          // bascule sur Katch-McArdle au lieu de Mifflin-St Jeor.
          ...(bfPctNum !== null && {
            baseline: {
              ...(currentData.baseline || {}),
              bf_pct: bfPctNum,
              bf_measured_at: new Date().toISOString(),
            },
          }),
          ...(featureFasting && {
            fasting_protocol: {
              active: fastingActive,
              type: fastingType,
              eating_window_start: fastingStart,
              eating_window_end: fastingEnd,
              days_active: fastingDays,
            }
          })
        });

        // Save GLP-1 settings if flag is active
        if (featureGlp1) {
          const glp1Ref = doc(db, "users", user.uid, "medications", "glp1");
          await setDoc(glp1Ref, {
            active: glp1Active,
            molecule: glp1Molecule,
            dose: glp1Dose,
            frequency: glp1Frequency,
            startDate: glp1StartDate,
            sideEffects: glp1SideEffects,
            updatedAt: new Date().toISOString()
          });
        }

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Error updating settings:", err);
      setErrorMsg("Impossible de sauvegarder les modifications.");
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    setErrorMsg("");

    try {
      const token = await getFreshToken();
      if (!token) throw new Error("Token d'authentification invalide.");

      const response = await fetch("/api/user/export", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erreur de serveur lors de l'exportation.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nodream_data_${user.uid}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Impossible d'exporter les données.");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteInput !== "EFFACER") return;
    setDeleting(true);
    setErrorMsg("");

    try {
      // Wave 11C — Reauth before destructive action (RGPD + matches what
      // /settings/privacy does). Server rejects with 403 if auth_time is
      // older than 5 min. Detect provider so we don't hardcode Google.
      const { reauthenticateWithPopup, GoogleAuthProvider, EmailAuthProvider, reauthenticateWithCredential } = await import("firebase/auth");
      const providerId = user.providerData[0]?.providerId;
      if (providerId === "google.com") {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      } else if (providerId === "password") {
        // Email/password reauth needs the current password — prompt the user.
        const pwd = window.prompt("Confirme ton mot de passe pour supprimer ton compte :");
        if (!pwd) {
          setDeleting(false);
          return;
        }
        const cred = EmailAuthProvider.credential(user.email ?? "", pwd);
        await reauthenticateWithCredential(user, cred);
      }
      // Other providers (apple, facebook…) fall through — the server will
      // still enforce the 5-min freshness check.

      const token = await getFreshToken();
      if (!token) throw new Error("Token d'authentification invalide.");

      // Use POST (the modern endpoint with confirmText + reauth check) —
      // same contract as /settings/privacy. The legacy DELETE method is
      // kept server-side for back-compat but no longer called from the UI.
      const response = await fetch("/api/user/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmText: "EFFACER" }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la suppression.");
      }

      // Success, signout client and redirect
      await logout();
      router.push("/login");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Une erreur est survenue pendant la suppression.");
      setDeleting(false);
    }
  };

  if (loadingProfile) {
    return (
      <Loader size="fullscreen" message="Chargement de tes préférences..." />
    );
  }

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
          [OPS-CONFIG · v1]
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
          Réglages <span style={{ color: 'var(--gold-400)' }}>opérationnels</span>
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
          Profil · préférences · confidentialité
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mono"
          style={{
            padding: '10px 14px',
            background: 'var(--alert-tint-15)',
            border: '1px solid var(--alert-500)',
            color: 'var(--alert-500)',
            fontSize: 11,
            letterSpacing: '0.1em',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
          }}
        >
          <span style={{ fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            [ERR-CONFIG]
          </span>
          {errorMsg}
        </div>
      )}

      {saveSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="mono flex items-center gap-2"
          style={{
            padding: '10px 14px',
            background: 'var(--accent-tech-tint)',
            border: '1px solid var(--accent-tech)',
            color: 'var(--accent-tech)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
            boxShadow: '0 0 10px var(--accent-tech-tint-strong)',
          }}
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span>[ACK] Modifications enregistrées</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Profile Card */}
        <HudCard accent="gold" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
          <PanelHeader
            code="PROFIL-PERSO"
            title={
              <span className="flex items-center gap-2">
                <User className="h-4 w-4" style={{ color: 'var(--gold-400)' }} aria-hidden="true" />
                Profil personnel
              </span>
            }
            accent="gold"
          />
          <p className="mono" style={{ fontSize: 10, color: 'var(--fg-5)', letterSpacing: '0.1em', marginBottom: 12 }}>
            Données métaboliques de base
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="settings-prenom-pseudo" style={labelStyle}>Prénom / Pseudo</label>
              <input
                id="settings-prenom-pseudo"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mono"
                style={inputBase}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="settings-taille-cm" style={labelStyle}>Taille (cm)</label>
                <input
                  id="settings-taille-cm"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="mono"
                  style={inputBase}
                  required
                />
              </div>
              <div>
                <label htmlFor="settings-activite" style={labelStyle}>Activité</label>
                <select
                  id="settings-activite"
                  value={activityLevel}
                  onChange={(e: any) => setActivityLevel(e.target.value)}
                  className="mono"
                  style={inputBase}
                >
                  <option value="sedentary">Sédentaire</option>
                  <option value="lightly_active">Légèrement actif</option>
                  <option value="moderately_active">Actif</option>
                  <option value="very_active">Très actif</option>
                </select>
              </div>
            </div>

            {/* Training environment — drives exercise filtering for coach + plan */}
            <div>
              <label style={labelStyle}>Lieu d&apos;entraînement</label>
              <p
                className="mono"
                style={{
                  fontSize: 9,
                  color: "var(--fg-5)",
                  letterSpacing: "0.05em",
                  marginTop: -2,
                  marginBottom: 8,
                }}
              >
                Détermine quels exercices ORACLE.IA peut prescrire
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { val: "gym", label: "Salle complète", desc: "Barres, machines, poulies" },
                  { val: "home_gym", label: "Home gym", desc: "Barre + haltères + rack" },
                  { val: "home_bodyweight", label: "Poids du corps", desc: "PDC + barre de traction" },
                  { val: "mixed", label: "Mixte", desc: "Alterne selon disponibilité" },
                ] as Array<{ val: TrainingEnvironment; label: string; desc: string }>).map((opt) => {
                  const active = trainingEnvironment === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setTrainingEnvironment(opt.val)}
                      className="mono cursor-pointer text-left transition-all"
                      style={{
                        padding: "10px 12px",
                        background: active ? "var(--gold-tint-15)" : "var(--glass-bg-2)",
                        color: active ? "var(--gold-400)" : "var(--fg-3)",
                        border: `1px solid ${active ? "var(--gold-tint-35)" : "var(--glass-border)"}`,
                        boxShadow: active ? "var(--glow-gold-soft)" : "none",
                        clipPath:
                          "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                      }}
                      aria-pressed={active}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          display: "block",
                        }}
                      >
                        {opt.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: active ? "var(--fg-3)" : "var(--fg-5)",
                          marginTop: 2,
                          display: "block",
                        }}
                      >
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BF connu — permet la saisie directe d'une mesure précise
                (DEXA/InBody/caliper/Navy). Le coach + plan-generator
                bascule alors sur Katch-McArdle au lieu de Mifflin-St Jeor. */}
            <div
              className="space-y-2 pt-3"
              style={{ borderTop: '1px solid var(--glass-border)' }}
            >
              <label style={labelStyle}>BF connu (optionnel)</label>
              <p
                className="mono"
                style={{
                  fontSize: 9,
                  color: 'var(--fg-5)',
                  letterSpacing: '0.05em',
                  marginTop: -2,
                  marginBottom: 8,
                }}
              >
                Mesure DEXA / InBody / caliper / Navy — laisse vide si tu n'as pas mesuré
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="settings-bf-pct" style={labelStyle}>BF (%)</label>
                  <input
                    id="settings-bf-pct"
                    type="number"
                    step="0.1"
                    min={3}
                    max={60}
                    placeholder="ex: 18.5"
                    value={bfPct}
                    onChange={(e) => setBfPct(e.target.value)}
                    className="mono"
                    style={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="settings-bf-method" style={labelStyle}>Méthode</label>
                  <select
                    id="settings-bf-method"
                    value={bfMethod}
                    onChange={(e: any) => setBfMethod(e.target.value)}
                    className="mono"
                    style={inputBase}
                    disabled={!bfPct.trim()}
                  >
                    <option value="">— Sélectionne —</option>
                    <option value="dexa">DEXA (±1%)</option>
                    <option value="bodpod">BodPod (±2%)</option>
                    <option value="inbody">InBody (±3%)</option>
                    <option value="caliper">Caliper (±3-5%)</option>
                    <option value="navy">Navy (±3-4%)</option>
                    <option value="bia">BIA balance (±5-8%)</option>
                    <option value="photo">Photo visuel (±5-10%)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </HudCard>

        {/* GLP-1 Medication Card */}
        {featureGlp1 && (
          <HudCard accent="gold" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
            <PanelHeader
              code="MED-GLP1"
              title={
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" style={{ color: 'var(--gold-400)' }} aria-hidden="true" />
                  Traitement GLP-1
                </span>
              }
              accent="gold"
            />
            <p className="mono" style={{ fontSize: 10, color: 'var(--fg-5)', letterSpacing: '0.1em', marginBottom: 12 }}>
              Sémaglutide / Tirzepatide / Liraglutide — adapte le plan
            </p>
            <div className="space-y-4">
              <TacticalToggle
                id="settings-glp1-toggle"
                checked={glp1Active}
                onChange={setGlp1Active}
                label="Traitement actif"
                desc="Indique si tu es sous traitement actuellement"
                accent="gold"
              />

              {glp1Active && (
                <div className="space-y-4 pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-molecule" style={labelStyle}>Molécule</label>
                      <select
                        id="settings-molecule"
                        value={glp1Molecule}
                        onChange={(e: any) => setGlp1Molecule(e.target.value)}
                        className="mono"
                        style={inputBase}
                      >
                        <option value="semaglutide">Sémaglutide (Ozempic/Wegovy)</option>
                        <option value="tirzepatide">Tirzépatide (Mounjaro/Zepbound)</option>
                        <option value="liraglutide">Liraglutide (Saxenda)</option>
                        <option value="other">Autre / Générique</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="settings-frequence" style={labelStyle}>Fréquence</label>
                      <select
                        id="settings-frequence"
                        value={glp1Frequency}
                        onChange={(e: any) => setGlp1Frequency(e.target.value)}
                        className="mono"
                        style={inputBase}
                      >
                        <option value="weekly">Hebdomadaire</option>
                        <option value="daily">Quotidien</option>
                        <option value="other">Autre</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-dose-ex-0-5mg" style={labelStyle}>Dose (ex: 0.5mg)</label>
                      <input
                        id="settings-dose-ex-0-5mg"
                        type="text"
                        placeholder="ex: 0.5mg"
                        value={glp1Dose}
                        onChange={(e) => setGlp1Dose(e.target.value)}
                        className="mono"
                        style={inputBase}
                      />
                    </div>
                    <div>
                      <label htmlFor="settings-date-de-debut" style={labelStyle}>Date de début</label>
                      <input
                        id="settings-date-de-debut"
                        type="date"
                        value={glp1StartDate}
                        onChange={(e) => setGlp1StartDate(e.target.value)}
                        className="mono"
                        style={inputBase}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label style={labelStyle}>Effets secondaires ressentis</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['nausée', 'fatigue', 'constipation', 'diarrhée', 'hypoglycémie', 'maux de tête'].map((effect) => {
                        const isChecked = glp1SideEffects.includes(effect);
                        return (
                          <label
                            key={effect}
                            className="mono flex items-center gap-2 cursor-pointer"
                            style={{
                              padding: '6px 8px',
                              fontSize: 11,
                              color: isChecked ? 'var(--gold-400)' : 'var(--fg-3)',
                              background: isChecked ? 'var(--gold-tint-08)' : 'transparent',
                              border: `1px solid ${isChecked ? 'var(--gold-tint-25)' : 'var(--glass-border)'}`,
                              clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                              textTransform: 'capitalize',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setGlp1SideEffects(prev => [...prev, effect]);
                                } else {
                                  setGlp1SideEffects(prev => prev.filter(x => x !== effect));
                                }
                              }}
                              style={{ accentColor: 'var(--gold-500)' }}
                            />
                            <span>{effect}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    className="mono"
                    style={{
                      padding: 10,
                      background: 'var(--gold-tint-08)',
                      border: '1px solid var(--gold-tint-25)',
                      fontSize: 10,
                      color: 'var(--fg-3)',
                      lineHeight: 1.5,
                      letterSpacing: '0.04em',
                      clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    }}
                  >
                    <span style={{ color: 'var(--gold-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                      [CLAUSE-MED]
                    </span>
                    {' '}
                    Cette option adapte ton plan en augmentant l&apos;apport protéique. Ce n&apos;est pas un avis médical. Consulte ton médecin.
                  </div>
                </div>
              )}
            </div>
          </HudCard>
        )}

        {/* Fasting Protocol Card */}
        {featureFasting && (
          <HudCard accent="gold" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
            <PanelHeader
              code="JEUNE-IF"
              title={
                <span className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" style={{ color: 'var(--gold-400)' }} aria-hidden="true" />
                  Jeûne intermittent
                </span>
              }
              accent="gold"
            />
            <p className="mono" style={{ fontSize: 10, color: 'var(--fg-5)', letterSpacing: '0.1em', marginBottom: 12 }}>
              Fenêtres synchro coach + dashboard
            </p>
            <div className="space-y-4">
              <TacticalToggle
                id="settings-fasting-toggle"
                checked={fastingActive}
                onChange={setFastingActive}
                label="Jeûne actif"
                desc="Suivi des fenêtres + ORACLE.IA"
                accent="gold"
              />

              {fastingActive && (
                <div className="space-y-4 pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <div>
                    <label htmlFor="settings-protocole" style={labelStyle}>Protocole</label>
                    <select
                      id="settings-protocole"
                      value={fastingType}
                      onChange={(e: any) => {
                        const val = e.target.value;
                        setFastingType(val);
                        if (val === '16:8') {
                          setFastingStart("12:00");
                          setFastingEnd("20:00");
                        } else if (val === '18:6') {
                          setFastingStart("12:00");
                          setFastingEnd("18:00");
                        } else if (val === '20:4') {
                          setFastingStart("14:00");
                          setFastingEnd("18:00");
                        } else if (val === 'OMAD') {
                          setFastingStart("17:00");
                          setFastingEnd("18:00");
                        }
                      }}
                      className="mono"
                      style={inputBase}
                    >
                      <option value="16:8">16:8 (16h jeûne / 8h repas)</option>
                      <option value="18:6">18:6 (18h jeûne / 6h repas)</option>
                      <option value="20:4">20:4 (20h jeûne / 4h repas)</option>
                      <option value="OMAD">OMAD (23:1)</option>
                      <option value="custom">Personnalisé</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-debut-repas-fenetre" style={labelStyle}>Début fenêtre</label>
                      <input
                        id="settings-debut-repas-fenetre"
                        type="time"
                        value={fastingStart}
                        onChange={(e) => setFastingStart(e.target.value)}
                        className="mono"
                        style={inputBase}
                      />
                    </div>
                    <div>
                      <label htmlFor="settings-fin-repas-fenetre" style={labelStyle}>Fin fenêtre</label>
                      <input
                        id="settings-fin-repas-fenetre"
                        type="time"
                        value={fastingEnd}
                        onChange={(e) => setFastingEnd(e.target.value)}
                        className="mono"
                        style={inputBase}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label style={labelStyle}>Jours d&apos;activation</label>
                    <div className="flex flex-wrap gap-2">
                      {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((dayName, idx) => {
                        const isChecked = fastingDays.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setFastingDays(prev => prev.filter(x => x !== idx));
                              } else {
                                setFastingDays(prev => [...prev, idx].sort());
                              }
                            }}
                            className="mono cursor-pointer transition-all"
                            style={{
                              padding: '6px 12px',
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: '0.2em',
                              textTransform: 'uppercase',
                              background: isChecked ? 'var(--gold-tint-15)' : 'var(--glass-bg-2)',
                              color: isChecked ? 'var(--gold-400)' : 'var(--fg-5)',
                              border: `1px solid ${isChecked ? 'var(--gold-tint-35)' : 'var(--glass-border)'}`,
                              boxShadow: isChecked ? 'var(--glow-gold-soft)' : 'none',
                              clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                            }}
                          >
                            {dayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </HudCard>
        )}

        {/* Preferences Card */}
        <HudCard accent="gold" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
          <PanelHeader
            code="PREF-APP"
            title={
              <span className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" style={{ color: 'var(--gold-400)' }} aria-hidden="true" />
                Préférences app
              </span>
            }
            accent="gold"
          />
          <div className="space-y-4">
            <TacticalToggle
              id="settings-notifications-toggle"
              checked={notifications}
              onChange={setNotifications}
              label="Notifications"
              desc="Rappels quotidiens de bilans"
              accent="tech"
            />

            <div
              className="flex items-center justify-between py-1"
              style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}
            >
              <div>
                <span className="mono" style={{ ...labelStyle, marginBottom: 2 }}>Système de mesure</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--fg-5)', letterSpacing: '0.05em' }}>
                  Métrique ou impérial
                </span>
              </div>
              <div
                className="inline-flex"
                style={{
                  padding: 2,
                  background: 'var(--glass-bg-2)',
                  border: '1px solid var(--glass-border)',
                  clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                }}
              >
                {[
                  { val: 'metric', label: 'Métrique' },
                  { val: 'imperial', label: 'Impérial' },
                ].map((opt) => {
                  const active = units === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setUnits(opt.val as UserSettings["units"])}
                      className="mono cursor-pointer"
                      style={{
                        padding: '4px 10px',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        background: active ? 'var(--gold-tint-15)' : 'transparent',
                        color: active ? 'var(--gold-400)' : 'var(--fg-5)',
                        border: 'none',
                        clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="flex items-center justify-between py-1"
              style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}
            >
              <div>
                <span className="mono" style={{ ...labelStyle, marginBottom: 2 }}>Langue</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--fg-5)', letterSpacing: '0.05em' }}>
                  Affichage
                </span>
              </div>
              <select
                value={language}
                onChange={(e: any) => setLanguage(e.target.value)}
                className="mono"
                style={{ ...inputBase, height: 32, width: 'auto' }}
              >
                <option value="fr">Français (tu)</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </HudCard>

        {/* Save button */}
        <button
          type="submit"
          className="btn btn-primary lg:col-span-2"
          style={{ width: '100%', height: 44 }}
          disabled={saving}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {saving ? "Sauvegarde..." : "Enregistrer les modifications"}
        </button>
      </form>

      {/* GDPR Card */}
      <HudCard accent="tech" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
        <PanelHeader
          code="RGPD · CONFID"
          title={
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" style={{ color: 'var(--accent-tech)' }} aria-hidden="true" />
              Confidentialité &amp; RGPD
            </span>
          }
          accent="tech"
          right={<Tag accent="tech">EU · FR-67</Tag>}
        />
        <div className="space-y-4">
          <p className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', letterSpacing: '0.04em', lineHeight: 1.6, margin: 0 }}>
            Tu peux récupérer l&apos;intégralité des données collectées ou demander la suppression définitive du compte.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleExportData}
              disabled={exporting}
              className="btn btn-ghost mono flex-1"
              style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {exporting ? "Exportation..." : "Exporter"}
            </button>

            <button
              type="button"
              onClick={() => setConfirmDelete(!confirmDelete)}
              className="mono flex-1 cursor-pointer"
              style={{
                padding: '0 18px',
                height: 40,
                fontSize: 10,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontWeight: 700,
                background: 'var(--alert-tint-15)',
                color: 'var(--alert-500)',
                border: '1px solid var(--alert-500)',
                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Détruire compte
            </button>
          </div>

          {/* Delete confirmation section */}
          {confirmDelete && (
            <div
              className="space-y-3"
              style={{
                padding: 12,
                background: 'var(--alert-tint-15)',
                border: '1px solid var(--alert-500)',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.25em',
                  color: 'var(--alert-500)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  display: 'block',
                }}
              >
                [WARN · IRRÉVERSIBLE]
              </span>
              <p
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--fg-3)',
                  lineHeight: 1.6,
                  margin: 0,
                  letterSpacing: '0.04em',
                }}
              >
                Toutes les collections (check-ins, plans, photos de progrès) seront purgées de manière permanente.
              </p>
              <div className="space-y-2">
                <label htmlFor="settings-saisis-supprimer-pour-confirmer" style={labelStyle}>
                  Saisis &quot;SUPPRIMER&quot; pour confirmer
                </label>
                <input
                  id="settings-saisis-supprimer-pour-confirmer"
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="EFFACER"
                  className="mono"
                  style={{
                    ...inputBase,
                    border: '1px solid var(--alert-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                  }}
                />
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteInput !== "EFFACER" || deleting}
                  className="mono cursor-pointer"
                  style={{
                    width: '100%',
                    height: 36,
                    fontSize: 10,
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    background: deleteInput === "EFFACER" ? 'var(--alert-500)' : 'var(--alert-tint-15)',
                    color: deleteInput === "EFFACER" ? 'var(--ink-900)' : 'var(--fg-5)',
                    border: '1px solid var(--alert-500)',
                    opacity: deleting ? 0.5 : 1,
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                  }}
                >
                  {deleting ? "Destruction en cours..." : "Supprimer définitivement"}
                </button>
              </div>
            </div>
          )}
        </div>
      </HudCard>

      {/* Restart onboarding — used to re-collect BF% / training history /
          environment after the wizard was extended. Plan history is preserved. */}
      <HudCard accent="tech" chamfer="sm">
        <PanelHeader code="RECALIBRATION" title="REFAIRE L'ONBOARDING" />
        <p
          className="mono"
          style={{ fontSize: 11, color: 'var(--fg-4)', letterSpacing: '0.04em', margin: '12px 0' }}
        >
          Re-saisis ton BF%, ton niveau d&apos;entraînement et ton environnement pour recalibrer
          ton plan via Katch-McArdle. L&apos;ancien plan reste archivé (active: false).
        </p>
        <button
          type="button"
          onClick={async () => {
            // Wave 11C — Replace native alert() with the page's setErrorMsg
            // tactical banner so the user sees a styled message instead of
            // a browser modal.
            try {
              setErrorMsg("");
              const token = await getFreshToken();
              if (!token) {
                setErrorMsg("Session expirée — reconnecte-toi.");
                return;
              }
              const res = await fetch("/api/onboarding/restart", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setErrorMsg(`Erreur : ${body?.error || res.statusText}`);
                return;
              }
              const data = await res.json();
              const resumeStep = typeof data?.resumeStep === "number" ? data.resumeStep : 1;
              // Bug fix 2026-05-28 : avant navigate, refresh hasProfile depuis
              // Firestore. Sinon le (app)/layout.tsx voit hasProfile === true
              // (state cached), considère que l'user est sur /onboarding par
              // erreur et redirige vers /dashboard. Le restart fonctionnait
              // côté Firestore mais l'UI rebondissait au dashboard.
              await refreshProfileStatus();
              router.push(`/onboarding/${resumeStep}`);
            } catch (err) {
              console.error("[settings] restart onboarding failed:", err);
              setErrorMsg("Erreur réseau — vérifie ta connexion.");
            }
          }}
          className="mono cursor-pointer"
          style={{
            width: '100%',
            height: 40,
            fontSize: 10,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            fontWeight: 700,
            background: 'var(--glass-bg-2)',
            color: 'var(--accent-tech)',
            border: '1px solid var(--accent-tech)',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
          }}
        >
          Refaire mon onboarding
        </button>
      </HudCard>

      {/* Logout */}
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/login");
        }}
        className="btn btn-ghost mono"
        style={{
          width: '100%',
          height: 44,
          fontSize: 11,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Déconnexion
      </button>
    </div>
  );
}
