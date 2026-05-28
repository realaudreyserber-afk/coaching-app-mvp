"use client";

import { Loader } from "@/components/ui/loader";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/firebase/hooks";
import { db } from "@/lib/firebase/client";
import {
  Step1Identity,
  Step2AgeTimezone,
  Step3Measurements,
  Step4BodyFat,
  Step5Activity,
  Step6Lifestyle,
  Step7Goals,
  Step8Medical,
  Step9Fitness,
  Step10Nutrition,
  Step11Generate,
} from "@/components/onboarding/steps";

const TOTAL_STEPS = 8;

/**
 * Mapping étape → photo éditoriale N&B (assets dans /public).
 * Réutilise les hero images existantes du blog pour la phase 1
 * (à remplacer par des photos dédiées onboarding générées avec Nano Banana 2
 * ou une banque d'images premium plus tard).
 */
const STEP_PHOTOS: Record<number, { src: string; alt: string }> = {
  1: {
    src: "/onboarding/identity.jpg",
    alt: "Athlète concentré en salle minimaliste, lumière à contre-jour",
  },
  2: {
    src: "/onboarding/timezone.jpg",
    alt: "Horloge analogique éditoriale, accents or",
  },
  3: {
    src: "/onboarding/measurements.jpg",
    alt: "Mètre ruban enroulé sur fond charcoal, lumière dorée latérale",
  },
  4: {
    src: "/onboarding/measurements.jpg",
    alt: "Estimation visuelle du taux de masse grasse",
  },
  5: {
    src: "/onboarding/activity.jpg",
    alt: "Athlète en action, salle minimaliste",
  },
  6: {
    src: "/onboarding/activity.jpg",
    alt: "Salle de musculation tactique, racks et haltères",
  },
  7: {
    src: "/onboarding/goals.jpg",
    alt: "Athlète concentré sur son objectif, contre-jour",
  },
  8: {
    src: "/onboarding/generate.jpg",
    alt: "Horloge éditoriale, calibration en cours",
  },
};

function flattenObject(obj: Record<string, any>, prefix = ""): Record<string, any> {
  const flattened: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const prefixedKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(flattened, flattenObject(value, prefixedKey));
    } else {
      flattened[prefixedKey] = value;
    }
  }
  return flattened;
}

export default function OnboardingStepPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  
  const stepNum = parseInt(params.step as string, 10);
  const [userData, setUserData] = useState<Record<string, unknown> | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    const fetchUserData = async () => {
      try {
        // Force a fresh ID token (see onboarding/page.tsx for context)
        try {
          await user.getIdToken(true);
        } catch (refreshErr) {
          console.warn("[onboarding/step] token refresh warning:", refreshErr);
        }

        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          router.push("/onboarding");
          return;
        }

        const data = userSnap.data();
        const currentFirestoreStep = data.onboarding_step || 1;

        // Validation: prevent skipping steps
        if (stepNum > currentFirestoreStep) {
          router.push(`/onboarding/${currentFirestoreStep}`);
          return;
        }

        // Validate step index bounds (7 essentiels + 1 generate = 8)
        if (isNaN(stepNum) || stepNum < 1 || stepNum > 8) {
          router.push(`/onboarding/${currentFirestoreStep}`);
          return;
        }

        setUserData(data);
        setFetching(false);
      } catch (error) {
        console.error("Error loading user data in onboarding step:", error);
      }
    };

    fetchUserData();
  }, [user, loading, stepNum, router]);

  const handlePrev = () => {
    if (stepNum > 1) {
      router.push(`/onboarding/${stepNum - 1}`);
    }
  };

  const handleNext = async (updatedFields: Record<string, unknown>) => {
    if (!user) return;
    try {
      const nextStep = stepNum + 1;
      const userDocRef = doc(db, "users", user.uid);
      
      const payload: Record<string, unknown> = {
        ...updatedFields,
      };

      // Only increment onboarding_step if we are moving forward past our previous max
      const currentMaxStep = (userData?.onboarding_step as number) || 1;
      if (nextStep > currentMaxStep) {
        payload.onboarding_step = nextStep;
      }

      // Flatten the nested fields (e.g. profile.height) to prevent overwriting other fields in map
      const flatPayload = flattenObject(payload);
      await updateDoc(userDocRef, flatPayload);
      
      // Update local state to reflect new data without wiping out other properties
      setUserData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...payload,
          profile: { ...(prev.profile || {}), ...(updatedFields.profile as any || {}) },
          baseline: { ...(prev.baseline || {}), ...(updatedFields.baseline as any || {}) },
          goals: { ...(prev.goals || {}), ...(updatedFields.goals as any || {}) },
          medical: { ...(prev.medical || {}), ...(updatedFields.medical as any || {}) },
        };
      });

      router.push(`/onboarding/${nextStep}`);
    } catch (error) {
      console.error("Error saving onboarding step:", error);
    }
  };

  if (loading || fetching) {
    return (
      <Loader size="fullscreen" message="Chargement de l'étape..." />
    );
  }

  // Wizard 7 essentiels + 1 generate = 8 steps.
  // BF% (Step4) is critical for Katch-McArdle TDEE on overweight profiles.
  // Fitness (Step6) drives RAG exo filtering by training_history + environment.
  // Lifestyle, medical detail, nutrition habits still collected post-wizard
  // by the coach in conversation (cf. lib/vertex/prompts/coach.ts §6-§7).
  const renderStep = () => {
    switch (stepNum) {
      case 1:
        return <Step1Identity userData={userData} onNext={handleNext} />;
      case 2:
        return <Step2AgeTimezone userData={userData} onPrev={handlePrev} onNext={handleNext} />;
      case 3:
        return <Step3Measurements userData={userData} onPrev={handlePrev} onNext={handleNext} />;
      case 4:
        return <Step4BodyFat userData={userData} onPrev={handlePrev} onNext={handleNext} />;
      case 5:
        return <Step5Activity userData={userData} onPrev={handlePrev} onNext={handleNext} />;
      case 6:
        return <Step9Fitness userData={userData} onPrev={handlePrev} onNext={handleNext} />;
      case 7:
        return <Step7Goals userData={userData} onPrev={handlePrev} onNext={handleNext} />;
      case 8:
        return <Step11Generate userData={userData} onPrev={handlePrev} />;
      default:
        return null;
    }
  };

  const photo = STEP_PHOTOS[stepNum] ?? STEP_PHOTOS[1];

  return (
    <OnboardingLayout
      photoSrc={photo.src}
      photoAlt={photo.alt}
      headerRight={<StepIndicator current={stepNum} total={TOTAL_STEPS} />}
    >
      {renderStep()}
    </OnboardingLayout>
  );
}
