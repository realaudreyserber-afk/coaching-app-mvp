"use client";

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

        // Validate step index bounds (reduced wizard: 5 essentiels + 1 generate = 6)
        if (isNaN(stepNum) || stepNum < 1 || stepNum > 6) {
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

      await updateDoc(userDocRef, payload);
      
      // Update local state to reflect new data
      setUserData((prev) => ({
        ...prev,
        ...payload,
      }));

      router.push(`/onboarding/${nextStep}`);
    } catch (error) {
      console.error("Error saving onboarding step:", error);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground font-serif">{"Chargement de l'étape..."}</p>
        </div>
      </div>
    );
  }

  // Reduced wizard — 5 essentiels + 1 generate.
  // Body fat, lifestyle, medical, fitness details, nutrition habits sont collectés
  // par le coach en conversation post-wizard (cf. lib/vertex/prompts/coach.ts §6-§7).
  const renderStep = () => {
    switch (stepNum) {
      case 1:
        return <Step1Identity userData={userData} onNext={handleNext} />;
      case 2:
        return <Step2AgeTimezone userData={userData} onPrev={handlePrev} onNext={handleNext} />;
      case 3:
        return <Step3Measurements userData={userData} onPrev={handlePrev} onNext={handleNext} />;
      case 4:
        return <Step5Activity userData={userData} onPrev={handlePrev} onNext={handleNext} />;
      case 5:
        return <Step7Goals userData={userData} onPrev={handlePrev} onNext={handleNext} />;
      case 6:
        return <Step11Generate userData={userData} onPrev={handlePrev} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-10 px-4 bg-background">
      {/* Step Indicator */}
      <div className="mb-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Étape {stepNum} sur 6
        </span>
        <div className="flex gap-1 mt-2 w-48 justify-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i + 1 <= stepNum ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {renderStep()}
    </div>
  );
}
