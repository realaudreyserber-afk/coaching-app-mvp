/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Loader } from "@/components/ui/loader";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserSettings, UserProfile } from "@/types/user";
import { User, Settings as SettingsIcon, ShieldAlert, Download, LogOut, Save, Check, ShieldCheck } from "lucide-react";
import { flags } from "@/lib/features/flags";

export default function SettingsPage() {
  const { user, logout, getFreshToken } = useAuth();
  const router = useRouter();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Profile settings
  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [activityLevel, setActivityLevel] = useState<UserProfile["activity_level"]>("sedentary");
  
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
        };
        const updatedSettings: UserSettings = {
          notifications,
          units,
          language,
        };

        await updateDoc(userRef, {
          profile: updatedProfile,
          settings: updatedSettings,
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
      a.download = `linsociable_data_${user.uid}.json`;
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
    if (!user || deleteInput !== "SUPPRIMER") return;
    setDeleting(true);
    setErrorMsg("");

    try {
      const token = await getFreshToken();
      if (!token) throw new Error("Token d'authentification invalide.");

      const response = await fetch("/api/user/delete", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
      {/* Title */}
      <div>
        <h2 className="text-3xl lg:text-4xl font-bold font-serif text-foreground">Réglages</h2>
        <p className="text-sm text-muted-foreground">
          Gère ton profil, tes préférences et la confidentialité de tes données.
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3 bg-red-950/40 text-red-300 text-xs rounded-lg border border-red-900 font-serif"
        >
          {errorMsg}
        </div>
      )}

      {saveSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 bg-emerald-950/40 text-emerald-300 text-xs rounded-lg border border-emerald-900 flex items-center gap-2 font-serif"
        >
          <Check className="h-4 w-4" aria-hidden="true" /> Modifications enregistrées avec succès.
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Profile Card */}
        <Card className="border border-border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-serif font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Profil personnel
            </CardTitle>
            <CardDescription className="text-xs">Tes informations métaboliques de base</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4 text-xs">
            <div className="space-y-1">
              <label htmlFor="settings-prenom-pseudo" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Prénom / Pseudo</label>
              <input id="settings-prenom-pseudo"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="settings-taille-cm" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Taille (cm)</label>
                <input id="settings-taille-cm"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden"
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="settings-activite" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Activité</label>
                <select id="settings-activite"
                  value={activityLevel}
                  onChange={(e: any) => setActivityLevel(e.target.value)}
                  className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden font-serif"
                >
                  <option value="sedentary">Sédentaire</option>
                  <option value="lightly_active">Légèrement actif</option>
                  <option value="moderately_active">Actif</option>
                  <option value="very_active">Très actif</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GLP-1 Medication Card */}
        {featureGlp1 && (
          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-serif font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Traitement GLP-1
              </CardTitle>
              <CardDescription className="text-xs">
                Renseigne ton traitement (Semaglutide, Tirzepatide) pour adapter ton plan
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4 text-xs">
              <div className="flex items-center justify-between py-1">
                <div>
                  <span id="settings-glp1-toggle-label" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Traitement Actif</span>
                  <span id="settings-glp1-toggle-desc" className="text-muted-foreground text-[10px]">Indique si tu es sous traitement actuellement</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-checked={glp1Active}
                    aria-labelledby="settings-glp1-toggle-label"
                    aria-describedby="settings-glp1-toggle-desc"
                    checked={glp1Active}
                    onChange={(e) => setGlp1Active(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" aria-hidden="true" />
                </label>
              </div>

              {glp1Active && (
                <div className="space-y-4 pt-3 border-t border-border/50 animate-[fadeIn_0.2s_ease-out]">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="settings-molecule" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Molécule</label>
                      <select id="settings-molecule"
                        value={glp1Molecule}
                        onChange={(e: any) => setGlp1Molecule(e.target.value)}
                        className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden font-serif"
                      >
                        <option value="semaglutide">Sémaglutide (Ozempic/Wegovy)</option>
                        <option value="tirzepatide">Tirzépatide (Mounjaro/Zepbound)</option>
                        <option value="liraglutide">Liraglutide (Saxenda)</option>
                        <option value="other">Autre / Générique</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="settings-frequence" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Fréquence</label>
                      <select id="settings-frequence"
                        value={glp1Frequency}
                        onChange={(e: any) => setGlp1Frequency(e.target.value)}
                        className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden font-serif"
                      >
                        <option value="weekly">Hebdomadaire</option>
                        <option value="daily">Quotidien</option>
                        <option value="other">Autre</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="settings-dose-ex-0-5mg" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Dose (ex: 0.5mg)</label>
                      <input id="settings-dose-ex-0-5mg"
                        type="text"
                        placeholder="ex: 0.5mg"
                        value={glp1Dose}
                        onChange={(e) => setGlp1Dose(e.target.value)}
                        className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="settings-date-de-debut" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Date de début</label>
                      <input id="settings-date-de-debut"
                        type="date"
                        value={glp1StartDate}
                        onChange={(e) => setGlp1StartDate(e.target.value)}
                        className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Effets Secondaires ressentis</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['nausée', 'fatigue', 'constipation', 'diarrhée', 'hypoglycémie', 'maux de tête'].map((effect) => {
                        const isChecked = glp1SideEffects.includes(effect);
                        return (
                          <label key={effect} className="flex items-center space-x-2 cursor-pointer p-1">
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
                              className="accent-primary"
                            />
                            <span className="capitalize">{effect}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground leading-relaxed bg-primary/5 p-2.5 rounded border border-primary/10">
                    <span className="font-bold text-primary">Clause médicale : </span>
                    Cette option adapte ton plan nutritionnel en augmentant l'apport en protéines pour minimiser la perte musculaire, mais ne constitue en aucun cas une ordonnance ou un avis médical. Consulte ton médecin pour adapter tes doses.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Fasting Protocol Card */}
        {featureFasting && (
          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-serif font-semibold flex items-center gap-2">
                <SettingsIcon className="h-4 w-4 text-primary" /> Jeûne Intermittent
              </CardTitle>
              <CardDescription className="text-xs">
                Configure tes fenêtres de jeûne pour adapter le coaching et le dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4 text-xs">
              <div className="flex items-center justify-between py-1">
                <div>
                  <span id="settings-fasting-toggle-label" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Jeûne Actif</span>
                  <span id="settings-fasting-toggle-desc" className="text-muted-foreground text-[10px]">Active le suivi des fenêtres de jeûne</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-checked={fastingActive}
                    aria-labelledby="settings-fasting-toggle-label"
                    aria-describedby="settings-fasting-toggle-desc"
                    checked={fastingActive}
                    onChange={(e) => setFastingActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" aria-hidden="true" />
                </label>
              </div>

              {fastingActive && (
                <div className="space-y-4 pt-3 border-t border-border/50 animate-[fadeIn_0.2s_ease-out]">
                  <div className="space-y-1">
                    <label htmlFor="settings-protocole" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Protocole</label>
                    <select id="settings-protocole"
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
                      className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden font-serif"
                    >
                      <option value="16:8">16:8 (16h Jeûne / 8h Repas)</option>
                      <option value="18:6">18:6 (18h Jeûne / 6h Repas)</option>
                      <option value="20:4">20:4 (20h Jeûne / 4h Repas)</option>
                      <option value="OMAD">OMAD (One Meal A Day - 23:1)</option>
                      <option value="custom">Personnalisé</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="settings-debut-repas-fenetre" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Début Repas (Fenêtre)</label>
                      <input id="settings-debut-repas-fenetre"
                        type="time"
                        value={fastingStart}
                        onChange={(e) => setFastingStart(e.target.value)}
                        className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="settings-fin-repas-fenetre" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Fin Repas (Fenêtre)</label>
                      <input id="settings-fin-repas-fenetre"
                        type="time"
                        value={fastingEnd}
                        onChange={(e) => setFastingEnd(e.target.value)}
                        className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Jours d'activation</label>
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
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold border transition-colors ${
                              isChecked
                                ? "bg-primary border-primary text-white"
                                : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            {dayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preferences Card */}
        <Card className="border border-border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-serif font-semibold flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-primary" /> Préférences de l'application
            </CardTitle>
            <CardDescription className="text-xs">Configure ton expérience utilisateur</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4 text-xs">
            <div className="flex items-center justify-between py-1">
              <div>
                <span id="settings-notifications-toggle-label" className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Notifications</span>
                <span id="settings-notifications-toggle-desc" className="text-muted-foreground text-[10px]">Rappels quotidiens de bilans</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={notifications}
                  aria-labelledby="settings-notifications-toggle-label"
                  aria-describedby="settings-notifications-toggle-desc"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" aria-hidden="true" />
              </label>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-border/50 pt-3">
              <div>
                <span className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Système de mesure</span>
                <span className="text-muted-foreground text-[10px]">Unités métriques ou impériales</span>
              </div>
              <div className="inline-flex rounded-md p-0.5 bg-muted border border-border">
                <button
                  type="button"
                  onClick={() => setUnits("metric")}
                  className={`px-2.5 py-1 text-[9px] font-bold rounded-sm uppercase transition-all ${
                    units === "metric" ? "bg-card text-primary shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  Métrique
                </button>
                <button
                  type="button"
                  onClick={() => setUnits("imperial")}
                  className={`px-2.5 py-1 text-[9px] font-bold rounded-sm uppercase transition-all ${
                    units === "imperial" ? "bg-card text-primary shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  Impérial
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-border/50 pt-3">
              <div>
                <span className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Langue</span>
                <span className="text-muted-foreground text-[10px]">Langue d'affichage</span>
              </div>
              <select
                value={language}
                onChange={(e: any) => setLanguage(e.target.value)}
                className="bg-muted border border-border text-foreground py-1 px-2 rounded-md focus:outline-hidden font-serif"
              >
                <option value="fr">Français (tu)</option>
                <option value="en">English</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <Button
          type="submit"
          className="w-full flex items-center justify-center gap-2 h-11 lg:col-span-2"
          disabled={saving}
        >
          <Save className="h-4 w-4" />
          {saving ? "Sauvegarde..." : "Enregistrer les modifications"}
        </Button>
      </form>

      {/* GDPR Card */}
      <Card className="border border-border bg-card shadow-xs">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-serif font-semibold flex items-center gap-2 text-foreground">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-500" /> Confidentialité & RGPD
          </CardTitle>
          <CardDescription className="text-xs">Exporte tes données ou supprime définitivement ton compte.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4 text-xs">
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              En conformité avec le RGPD, tu as le droit de récupérer l'intégralité des données collectées par l'application ou de demander la suppression complète de ton compte.
            </p>
            
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleExportData}
                disabled={exporting}
                className="flex-1 flex items-center justify-center gap-1.5 h-10 text-[10px] font-bold"
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                {exporting ? "Exportation..." : "Exporter les données"}
              </Button>
              
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(!confirmDelete)}
                className="flex-1 flex items-center justify-center gap-1.5 h-10 text-[10px] font-bold"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Détruire le compte
              </Button>
            </div>
          </div>

          {/* Delete confirmation section */}
          {confirmDelete && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3 rounded-lg space-y-3 mt-3">
              <span className="font-bold text-red-700 dark:text-red-400 block text-[10px] uppercase tracking-wider">⚠️ Action irréversible</span>
              <p className="text-[10px] text-red-600 dark:text-red-400 leading-relaxed">
                Toutes tes collections de bilans quotidiens, hebdomadaires, plans, et photos de progrès stockés seront supprimés de manière permanente.
              </p>
              <div className="space-y-2">
                <label htmlFor="settings-saisis-supprimer-pour-confirmer" className="text-[9px] uppercase font-semibold text-muted-foreground block">Saisis "SUPPRIMER" pour confirmer :</label>
                <input id="settings-saisis-supprimer-pour-confirmer"
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="w-full bg-card border border-red-300 dark:border-red-900 text-foreground py-1.5 px-2 rounded-md focus:outline-hidden font-mono uppercase"
                />
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteInput !== "SUPPRIMER" || deleting}
                  className="w-full h-9 text-[10px]"
                >
                  {deleting ? "Destruction en cours..." : "Supprimer définitivement"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logout Card */}
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          await logout();
          router.push("/login");
        }}
        className="w-full flex items-center justify-center gap-2 h-11 border-border/80 text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Se déconnecter
      </Button>
    </div>
  );
}
