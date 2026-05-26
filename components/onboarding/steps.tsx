/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/firebase/hooks";

interface StepProps {
  userData: any;
  onPrev: () => void;
  onNext: (updatedData: any) => Promise<void>;
}

// ==========================================
// STEP 1: IDENTITY (Prénom & Sexe)
// ==========================================
export function Step1Identity({ userData, onNext }: Omit<StepProps, "onPrev">) {
  const [name, setName] = useState(userData?.profile?.name || "");
  const [sex, setSex] = useState(userData?.profile?.sex || "");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("S'il te plaît, écris ton prénom.");
    if (!sex) return setError("S'il te plaît, choisis ton sexe biologique.");
    
    setError("");
    await onNext({
      profile: {
        ...(userData?.profile || {}),
        name: name.trim(),
        sex: sex,
      }
    });
  };

  return (
    <Card className="max-w-md w-full mx-auto border-border">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-serif">Commençons par faire connaissance</CardTitle>
        <CardDescription>
          Ces informations permettront de calibrer ton métabolisme de base.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Comment dois-je t'appeler ?</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ton prénom"
              className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Sexe biologique</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSex("male")}
                className={`h-11 rounded-md border text-sm font-medium transition-all ${
                  sex === "male"
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                Homme
              </button>
              <button
                type="button"
                onClick={() => setSex("female")}
                className={`h-11 rounded-md border text-sm font-medium transition-all ${
                  sex === "female"
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                Femme
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <Button type="submit" className="w-full h-11">
            Continuer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ==========================================
// STEP 2: AGE & TIMEZONE (Âge & Fuseau)
// ==========================================
export function Step2AgeTimezone({ userData, onPrev, onNext }: StepProps) {
  const [dob, setDob] = useState(userData?.profile?.dob || "");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dob) return setError("S'il te plaît, renseigne ta date de naissance.");
    
    // Simple age checking (must be at least 18)
    const birthYear = new Date(dob).getFullYear();
    const currentYear = new Date().getFullYear();
    if (currentYear - birthYear < 18) {
      return setError("Tu dois avoir au moins 18 ans pour utiliser cette application.");
    }

    setError("");
    await onNext({
      profile: {
        ...(userData?.profile || {}),
        dob,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
      }
    });
  };

  return (
    <Card className="max-w-md w-full mx-auto border-border">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-serif">Quelle est ta date de naissance ?</CardTitle>
        <CardDescription>
          L'âge influence directement ta dépense énergétique quotidienne.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Date de naissance</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onPrev} className="w-1/3 h-11">
              Retour
            </Button>
            <Button type="submit" className="w-2/3 h-11">
              Continuer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ==========================================
// STEP 3: MEASUREMENTS (Poids, Taille, IMC check)
// ==========================================
export function Step3Measurements({ userData, onPrev, onNext }: StepProps) {
  const [weight, setWeight] = useState(userData?.baseline?.weight || "");
  const [height, setHeight] = useState(userData?.profile?.height || "");
  const [imcBlock, setImcBlock] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wNum = parseFloat(weight);
    const hNum = parseFloat(height);

    if (isNaN(wNum) || wNum <= 30 || wNum >= 250) {
      return setError("S'il te plaît, entre un poids valide (ex: 75).");
    }
    if (isNaN(hNum) || hNum <= 100 || hNum >= 250) {
      return setError("S'il te plaît, entre une taille valide en cm (ex: 175).");
    }

    // Safety IMC check
    const heightInMeters = hNum / 100;
    const imc = wNum / (heightInMeters * heightInMeters);

    if (imc < 18.5) {
      setImcBlock(true);
      setError("");
      return;
    }

    setError("");
    await onNext({
      profile: {
        ...(userData?.profile || {}),
        height: hNum,
      },
      baseline: {
        ...(userData?.baseline || {}),
        weight: wNum,
      }
    });
  };

  if (imcBlock) {
    return (
      <Card className="max-w-md w-full mx-auto border-red-200 dark:border-red-950">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-serif text-red-600 dark:text-red-500">Accès non autorisé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-sm leading-relaxed text-muted-foreground bg-red-50 dark:bg-red-950/20 p-4 rounded-md border border-red-100 dark:border-red-900/40">
            {"Ton Indice de Masse Corporelle (IMC) calculé est inférieur à 18.5 (situation de maigreur ou sous-poids). Notre application est exclusivement dédiée au bien-être, à la recomposition corporelle et à la perte de poids saine. Pour préserver ta santé, nous ne pouvons pas t'accompagner dans ces objectifs."}
            <br /><br />
            {"Nous t'invitons à consulter un médecin ou un diététicien-nutritionniste agréé afin de t'accompagner de façon adaptée."}
          </div>
          <Button variant="outline" onClick={() => setImcBlock(false)} className="w-full h-11">
            Modifier mes mensurations
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md w-full mx-auto border-border">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-serif">Tes mensurations</CardTitle>
        <CardDescription>
          Indique ta taille et ton poids actuel de référence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Taille (en cm)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="ex: 175"
              className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Poids actuel (en kg)</label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="ex: 78.5"
              className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onPrev} className="w-1/3 h-11">
              Retour
            </Button>
            <Button type="submit" className="w-2/3 h-11">
              Continuer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ==========================================
// STEP 4: BODY FAT (Taux de masse grasse)
// ==========================================
export function Step4BodyFat({ userData, onPrev, onNext }: StepProps) {
  const [bf, setBf] = useState(userData?.baseline?.bf_pct || 25);
  
  const bfRanges = [
    { value: 12, label: "Très Sec (< 15%)", desc: "Abdominaux très visibles, veines apparentes." },
    { value: 18, label: "Athlétique (15% - 20%)", desc: "Abdominaux dessinés en bonne lumière, athlétique." },
    { value: 24, label: "Modéré (20% - 25%)", desc: "Forme globale correcte, peu de définition musculaire." },
    { value: 30, label: "Élevé (25% - 30%)", desc: "Formes douces, graisse localisée sur la sangle abdominale." },
    { value: 36, label: "Très Élevé (> 30%)", desc: "Masse grasse importante répartie sur l'ensemble du corps." },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onNext({
      baseline: {
        ...(userData?.baseline || {}),
        bf_pct: bf,
      }
    });
  };

  return (
    <Card className="max-w-md w-full mx-auto border-border">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-serif">Estime ta masse grasse</CardTitle>
        <CardDescription>
          Une estimation approximative suffit pour démarrer la recomposition.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {bfRanges.map((range) => (
              <button
                key={range.value}
                type="button"
                onClick={() => setBf(range.value)}
                className={`w-full text-left p-4 rounded-md border transition-all ${
                  bf === range.value
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="font-medium text-sm">{range.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{range.desc}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onPrev} className="w-1/3 h-11">
              Retour
            </Button>
            <Button type="submit" className="w-2/3 h-11">
              Continuer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ==========================================
// STEP 5: ACTIVITY LEVEL (Activité)
// ==========================================
export function Step5Activity({ userData, onPrev, onNext }: StepProps) {
  const [level, setLevel] = useState(userData?.profile?.activity_level || "sedentary");

  const activities = [
    { id: "sedentary", label: "Sédentaire", desc: "Travail de bureau, très peu de déplacements ou d'exercices." },
    { id: "lightly_active", label: "Activité légère", desc: "Debout occasionnellement, marche modérée, 1 à 2 entraînements par semaine." },
    { id: "moderately_active", label: "Modérément actif", desc: "Activité physique régulière, 3 à 5 entraînements par semaine." },
    { id: "very_active", label: "Très actif", desc: "Métier physique ou entraînements quotidiens intenses." },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onNext({
      profile: {
        ...(userData?.profile || {}),
        activity_level: level,
      }
    });
  };

  return (
    <Card className="max-w-md w-full mx-auto border-border">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-serif">Niveau d'activité physique</CardTitle>
        <CardDescription>
          Sois le plus réaliste possible pour éviter une surévaluation de tes besoins.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {activities.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => setLevel(act.id)}
                className={`w-full text-left p-4 rounded-md border transition-all ${
                  level === act.id
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="font-medium text-sm">{act.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{act.desc}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onPrev} className="w-1/3 h-11">
              Retour
            </Button>
            <Button type="submit" className="w-2/3 h-11">
              Continuer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ==========================================
// STEP 6: LIFESTYLE (Métier, Sommeil, Stress)
// ==========================================
export function Step6Lifestyle({ userData, onPrev, onNext }: StepProps) {
  const [profession, setProfession] = useState(userData?.profile?.profession || "");
  const [sleep, setSleep] = useState(userData?.profile?.average_sleep || 7);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profession.trim()) return setError("Indique brièvement ton type d'activité professionnelle.");
    
    await onNext({
      profile: {
        ...(userData?.profile || {}),
        profession: profession.trim(),
        average_sleep: Number(sleep),
      }
    });
  };

  return (
    <Card className="max-w-md w-full mx-auto border-border">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-serif">Ton rythme quotidien</CardTitle>
        <CardDescription>
          Le sommeil et l'activité professionnelle dictent en grande partie ton niveau de récupération.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Quel est ton métier / activité principale ?</label>
            <input
              type="text"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="ex: Développeur assis / Serveur debout"
              className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Combien d'heures dors-tu en moyenne par nuit ?</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="4"
                max="10"
                step="0.5"
                value={sleep}
                onChange={(e) => setSleep(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <span className="font-semibold text-lg whitespace-nowrap">{sleep} h</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onPrev} className="w-1/3 h-11">
              Retour
            </Button>
            <Button type="submit" className="w-2/3 h-11">
              Continuer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ==========================================
// STEP 7: GOALS (Objectif principal & Target)
// ==========================================
export function Step7Goals({ userData, onPrev, onNext }: StepProps) {
  const [goalType, setGoalType] = useState(userData?.goals?.type || "lose_weight");
  const [targetWeight, setTargetWeight] = useState(userData?.goals?.target_weight || "");
  const [weeks, setWeeks] = useState(12);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wNum = parseFloat(targetWeight);
    if (isNaN(wNum) || wNum < 30 || wNum > 250) {
      return setError("S'il te plaît, spécifie un poids cible réaliste.");
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weeks * 7);

    await onNext({
      goals: {
        type: goalType,
        target_weight: wNum,
        target_date: targetDate.toISOString().split('T')[0],
      }
    });
  };

  return (
    <Card className="max-w-md w-full mx-auto border-border">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-serif">Quel est ton objectif ?</CardTitle>
        <CardDescription>
          Définissons la direction de ton plan nutritionnel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Type d'objectif</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setGoalType("lose_weight")}
                className={`py-3 px-1 rounded-md border text-xs font-semibold text-center transition-all ${
                  goalType === "lose_weight"
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                Perte de poids
              </button>
              <button
                type="button"
                onClick={() => setGoalType("recomposition")}
                className={`py-3 px-1 rounded-md border text-xs font-semibold text-center transition-all ${
                  goalType === "recomposition"
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                Recomposition
              </button>
              <button
                type="button"
                onClick={() => setGoalType("gain_muscle")}
                className={`py-3 px-1 rounded-md border text-xs font-semibold text-center transition-all ${
                  goalType === "gain_muscle"
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                Prise de muscle
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Poids cible (en kg)</label>
            <input
              type="number"
              step="0.1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="ex: 70"
              className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Durée estimée de la phase</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="6"
                max="24"
                step="2"
                value={weeks}
                onChange={(e) => setWeeks(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <span className="font-semibold text-lg whitespace-nowrap">{weeks} semaines</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onPrev} className="w-1/3 h-11">
              Retour
            </Button>
            <Button type="submit" className="w-2/3 h-11">
              Continuer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ==========================================
// STEP 8: MEDICAL PROFILE (Médical)
// ==========================================
export function Step8Medical({ userData, onPrev, onNext }: StepProps) {
  const [meds, setMeds] = useState(userData?.medical?.medications?.join(", ") || "");
  const [allergies, setAllergies] = useState(userData?.medical?.allergies?.join(", ") || "");
  const [conditions, setConditions] = useState(userData?.medical?.conditions?.join(", ") || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onNext({
      medical: {
        medications: meds ? meds.split(",").map((item: string) => item.trim()).filter(Boolean) : [],
        allergies: allergies ? allergies.split(",").map((item: string) => item.trim()).filter(Boolean) : [],
        conditions: conditions ? conditions.split(",").map((item: string) => item.trim()).filter(Boolean) : [],
      }
    });
  };

  return (
    <Card className="max-w-md w-full mx-auto border-border">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-serif">Profil médical & Allergies</CardTitle>
        <CardDescription>
          Aide l'IA à concevoir ton plan en toute sécurité. Laisse vide s'il n'y a rien à signaler.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Pathologies ou pépins physiques</label>
            <input
              type="text"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="ex: Tendinite épaule droite, thyroïde"
              className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Traitements ou médicaments en cours</label>
            <input
              type="text"
              value={meds}
              onChange={(e) => setMeds(e.target.value)}
              placeholder="ex: L-Thyroxin"
              className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Allergies alimentaires ou intolérances</label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="ex: Gluten, lactose, arachides"
              className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onPrev} className="w-1/3 h-11">
              Retour
            </Button>
            <Button type="submit" className="w-2/3 h-11">
              Continuer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ==========================================
// STEP 9: SPORT PROFILE (Historique sportif & Matériel)
// ==========================================
export function Step9Fitness({ userData, onPrev, onNext }: StepProps) {
  // Read from profile.training_* (the canonical fields consumed by the RAG +
  // generate-plan). Legacy `fitness.experience` / `fitness.equipment` paths
  // were never wired upstream — see lib/features/rag-coach/context.ts.
  const [level, setLevel] = useState(
    userData?.profile?.training_history || userData?.fitness?.experience || "beginner",
  );
  const [environment, setEnvironment] = useState<
    "gym" | "home_gym" | "home_bodyweight" | "mixed"
  >(
    (userData?.profile?.training_environment as "gym" | "home_gym" | "home_bodyweight" | "mixed") ||
      (userData?.fitness?.equipment === "home" ? "home_bodyweight" : "gym"),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onNext({
      profile: {
        ...(userData?.profile || {}),
        training_history: level,
        training_environment: environment,
      },
    });
  };

  return (
    <Card className="max-w-md w-full mx-auto border-border">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-serif">Ton profil sportif</CardTitle>
        <CardDescription>
          Adaptons ton plan d'entraînement physique.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Ton niveau en musculation / fitness</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLevel("beginner")}
                className={`py-3 px-1 rounded-md border text-xs font-semibold text-center transition-all ${
                  level === "beginner"
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                Débutant
              </button>
              <button
                type="button"
                onClick={() => setLevel("intermediate")}
                className={`py-3 px-1 rounded-md border text-xs font-semibold text-center transition-all ${
                  level === "intermediate"
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                Intermédiaire
              </button>
              <button
                type="button"
                onClick={() => setLevel("advanced")}
                className={`py-3 px-1 rounded-md border text-xs font-semibold text-center transition-all ${
                  level === "advanced"
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                Avancé
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Où vas-tu t'entraîner ?</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: "gym", label: "Salle complète", desc: "Barres, racks, machines, poulies." },
                { id: "home_gym", label: "Home gym", desc: "Barre + rack + haltères chez toi." },
                { id: "home_bodyweight", label: "Poids du corps", desc: "PDC + barre de traction / élastiques." },
                { id: "mixed", label: "Mixte", desc: "Alterne salle et maison selon la semaine." },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setEnvironment(opt.id)}
                  className={`text-left p-3 rounded-md border transition-all ${
                    environment === opt.id
                      ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onPrev} className="w-1/3 h-11">
              Retour
            </Button>
            <Button type="submit" className="w-2/3 h-11">
              Continuer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ==========================================
// STEP 10: NUTRITIONAL PREFERENCES (Nutrition)
// ==========================================
export function Step10Nutrition({ userData, onPrev, onNext }: StepProps) {
  const [diet, setDiet] = useState(userData?.nutrition?.diet || "omnivore");
  const [meals, setMeals] = useState(userData?.nutrition?.meals_per_day || 3);
  const [dislikes, setDislikes] = useState(userData?.nutrition?.disliked_foods?.join(", ") || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onNext({
      nutrition: {
        diet: diet,
        meals_per_day: meals,
        disliked_foods: dislikes ? dislikes.split(",").map((item: string) => item.trim()).filter(Boolean) : [],
      }
    });
  };

  return (
    <Card className="max-w-md w-full mx-auto border-border">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-serif">Préférences alimentaires</CardTitle>
        <CardDescription>
          Calibrons la structure de tes propositions de repas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Type d'alimentation</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDiet("omnivore")}
                className={`py-3 px-1 rounded-md border text-xs font-semibold text-center transition-all ${
                  diet === "omnivore"
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                Omnivore
              </button>
              <button
                type="button"
                onClick={() => setDiet("vegetarian")}
                className={`py-3 px-1 rounded-md border text-xs font-semibold text-center transition-all ${
                  diet === "vegetarian"
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                Végétarien
              </button>
              <button
                type="button"
                onClick={() => setDiet("vegan")}
                className={`py-3 px-1 rounded-md border text-xs font-semibold text-center transition-all ${
                  diet === "vegan"
                    ? "border-primary bg-orange-light text-primary dark:bg-primary/20"
                    : "border-border hover:bg-muted"
                }`}
              >
                Végan
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre de repas par jour souhaité</label>
            <select
              value={meals}
              onChange={(e) => setMeals(parseInt(e.target.value))}
              className="w-full h-11 px-3 rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="2">2 repas</option>
              <option value="3">3 repas</option>
              <option value="4">4 repas (avec collation)</option>
              <option value="5">5 repas</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Aliments rejetés ou détestés</label>
            <input
              type="text"
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
              placeholder="ex: Coriandre, brocoli, tofu"
              className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onPrev} className="w-1/3 h-11">
              Retour
            </Button>
            <Button type="submit" className="w-2/3 h-11">
              Continuer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ==========================================
// STEP 11: GENERATION (Écran de chargement IA)
// ==========================================
export function Step11Generate({ userData, onPrev }: Omit<StepProps, "onNext">) {
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [progressMsg, setProgressMsg] = useState("Prêt à lancer le calcul...");
  const { getFreshToken, refreshProfileStatus } = useAuth();
  const router = useRouter();

  const handleGeneratePlan = async () => {
    setGenerating(true);
    setGenerationError("");
    setProgressMsg("Connexion à Vertex AI...");
    
    try {
      const token = await getFreshToken();
      if (!token) throw new Error("Impossible de récupérer la session utilisateur.");

      setProgressMsg("Calcul de ta dépense énergétique (Mifflin-St Jeor)...");
      await new Promise(r => setTimeout(r, 800));

      setProgressMsg("Calibration de tes macro-nutriments (Protéines, Glucides, Lipides)...");
      await new Promise(r => setTimeout(r, 800));

      setProgressMsg("Génération de ton programme d'entraînement adapté...");

      const response = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "La génération a échoué.");
      }

      setProgressMsg("Enregistrement du plan dans Firestore...");

      // Update local profile complete marker
      await refreshProfileStatus();

      // Wave 6C : déclenche ORACLE.IA en proactif (welcome + plan_generated).
      // Fire-and-forget — pas bloquant pour la redirection, l'utilisateur verra
      // les messages la prochaine fois qu'il ouvre /coach + le badge dashboard.
      setProgressMsg("ORACLE.IA prépare ton briefing...");
      try {
        await Promise.all([
          fetch("/api/coach/proactive", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ trigger: "welcome" }),
          }),
          fetch("/api/coach/proactive", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ trigger: "plan_generated" }),
          }),
        ]);
      } catch (e) {
        console.warn("[onboarding] proactive coach trigger failed (non-blocking):", e);
      }

      setProgressMsg("Plan créé avec succès ! Préparation de ton dashboard...");
      await new Promise(r => setTimeout(r, 600));

      router.push("/dashboard");

    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || "Une erreur réseau est survenue.");
      setGenerating(false);
    }
  };

  return (
    <Card className="max-w-md w-full mx-auto border-border">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-serif">Création de ton plan</CardTitle>
        <CardDescription>
          Toutes tes informations sont prêtes. L'intelligence artificielle va maintenant calibrer ta structure nutritionnelle et physique.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {generating ? (
          <div className="text-center space-y-4 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="font-serif italic text-primary font-medium animate-pulse">{progressMsg}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md text-sm space-y-2 border border-border">
              <div><strong>Profil :</strong> {userData?.profile?.name} ({userData?.profile?.sex === "male" ? "Homme" : "Femme"})</div>
              <div><strong>Objectif :</strong> {userData?.goals?.type === "lose_weight" ? "Perte de poids" : userData?.goals?.type === "recomposition" ? "Recomposition" : "Prise de muscle"}</div>
              <div><strong>Mensurations :</strong> {userData?.baseline?.weight} kg pour {userData?.profile?.height} cm</div>
            </div>

            {generationError && (
              <p className="text-sm text-red-500 font-medium text-center bg-red-50 dark:bg-red-950/20 py-2 rounded-md border border-red-100 dark:border-red-900/40">
                {generationError}
              </p>
            )}

            <Button onClick={handleGeneratePlan} className="w-full h-12 text-base font-semibold">
              Générer mon plan personnalisé
            </Button>

            <Button type="button" variant="outline" onClick={onPrev} className="w-full h-11">
              Retour aux étapes précédentes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
