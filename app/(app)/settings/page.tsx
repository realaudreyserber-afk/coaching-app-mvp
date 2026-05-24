/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserSettings, UserProfile } from "@/types/user";
import { User, Settings as SettingsIcon, ShieldAlert, Download, LogOut, Save, Check } from "lucide-react";

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

  useEffect(() => {
    if (!user) return;

    const fetchUserSettings = async () => {
      try {
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
        });

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
      <div className="flex-1 flex items-center justify-center bg-cream px-4 dark:bg-anthracite">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground font-serif">Chargement de tes préférences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-md w-full mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold font-serif text-foreground">Réglages</h2>
        <p className="text-sm text-muted-foreground">
          Gère ton profil, tes préférences et la confidentialité de tes données.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-100 text-red-700 text-xs rounded-lg border border-red-200 font-serif">
          {errorMsg}
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 bg-green-100 text-green-700 text-xs rounded-lg border border-green-200 flex items-center gap-2 font-serif">
          <Check className="h-4 w-4" /> Modifications enregistrées avec succès.
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
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
              <label className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Prénom / Pseudo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Taille (cm)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full bg-muted border border-border text-foreground py-2 px-3 rounded-md focus:outline-hidden"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Activité</label>
                <select
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
                <span className="font-semibold text-foreground uppercase tracking-wider block text-[10px]">Notifications</span>
                <span className="text-muted-foreground text-[10px]">Rappels quotidiens de bilans</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
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
          className="w-full flex items-center justify-center gap-2 h-11"
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
                <label className="text-[9px] uppercase font-semibold text-muted-foreground block">Saisis "SUPPRIMER" pour confirmer :</label>
                <input
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
