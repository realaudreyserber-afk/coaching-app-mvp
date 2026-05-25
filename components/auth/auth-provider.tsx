"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  AuthError,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { refreshFlags } from "@/lib/features/flags";

type AuthStatus = "loading" | "unauthenticated" | "authenticated";

interface AuthContextType {
  status: AuthStatus;
  user: User | null;
  loading: boolean;
  hasProfile: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getFreshToken: () => Promise<string | null>;
  refreshProfileStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const POPUP_FALLBACK_ERROR_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
]);

function log(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[auth]", ...args);
  }
}

function buildMockUser(variant: "true" | "non-admin" | "no-profile"): {
  user: User;
  hasProfile: boolean;
  token: string;
} {
  const isNonAdmin = variant === "non-admin";
  const isNoProfile = variant === "no-profile";
  const token = isNoProfile
    ? "mock-token-no-profile"
    : isNonAdmin
      ? "mock-token-non-admin"
      : "mock-token";
  const user = {
    uid: isNonAdmin
      ? "non-admin-user-id"
      : isNoProfile
        ? "no-profile-user-id"
        : "dev-user-id",
    email: isNonAdmin
      ? "non-admin@coaching.local"
      : isNoProfile
        ? "no-profile@coaching.local"
        : "dev@coaching.local",
    displayName: isNonAdmin
      ? "Non-Admin User"
      : isNoProfile
        ? "No-Profile User"
        : "Mock User",
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    providerId: "google.com",
    refreshToken: "mock-refresh-token",
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => token,
    getIdTokenResult: async () => ({
      token,
      signInProvider: "google.com",
      claims: {},
      authTime: "",
      expirationTime: "",
      issuedAtTime: "",
    }),
    toJSON: () => ({}),
    phoneNumber: null,
    photoURL: null,
  } as unknown as User;
  return { user, hasProfile: !isNoProfile, token };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastSessionUidRef = useRef<string | null>(null);

  const checkProfileExistence = useCallback(
    async (uid: string): Promise<boolean> => {
      try {
        const userDocRef = doc(db, "users", uid);
        const userSnap = await getDoc(userDocRef);
        const exists =
          userSnap.exists() && userSnap.data()?.profile !== undefined;
        log("checkProfileExistence", uid, "→", exists);
        setHasProfile(exists);
        return exists;
      } catch (err) {
        console.error("[auth] Error checking user profile in Firestore:", err);
        setHasProfile(false);
        return false;
      }
    },
    [],
  );

  const refreshProfileStatus = useCallback(async (): Promise<boolean> => {
    if (user) return checkProfileExistence(user.uid);
    return false;
  }, [user, checkProfileExistence]);

  const mintServerSession = useCallback(async (idToken: string) => {
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(
          "[auth] /api/auth/session POST failed",
          res.status,
          body,
        );
      } else {
        log("server session minted");
      }
    } catch (err) {
      console.error("[auth] Failed to mint server session cookie:", err);
    }
  }, []);

  const clearServerSession = useCallback(async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      log("server session cleared");
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void refreshFlags().catch(() => {});
  }, []);

  useEffect(() => {
    const mockAuthEnabled =
      process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "1" &&
      process.env.NODE_ENV !== "production";

    if (typeof window !== "undefined" && mockAuthEnabled) {
      try {
        const mockUserVal = window.localStorage.getItem("mock_user");
        if (
          mockUserVal === "true" ||
          mockUserVal === "non-admin" ||
          mockUserVal === "no-profile"
        ) {
          const {
            user: mockUser,
            hasProfile: mockHasProfile,
            token,
          } = buildMockUser(mockUserVal);
          setTimeout(async () => {
            await mintServerSession(token);
            setUser(mockUser);
            setHasProfile(mockHasProfile);
            setStatus("authenticated");
          }, 0);
          return;
        }
      } catch (err) {
        console.error("[auth] mock user setup failed:", err);
      }
    }

    // Consume any pending signInWithRedirect result.
    // No-op if user came in via popup. Safe to always call.
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) log("getRedirectResult consumed", result.user.uid);
      })
      .catch((err) => {
        console.error("[auth] getRedirectResult failed:", err);
      });

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      log("onAuthStateChanged", currentUser?.uid ?? "null");

      if (currentUser) {
        setUser(currentUser);
        if (lastSessionUidRef.current !== currentUser.uid) {
          try {
            const idToken = await currentUser.getIdToken();
            await mintServerSession(idToken);
            lastSessionUidRef.current = currentUser.uid;
          } catch (err) {
            console.error("[auth] getIdToken failed:", err);
          }
        }
        await checkProfileExistence(currentUser.uid);
        setStatus("authenticated");
      } else {
        setUser(null);
        if (lastSessionUidRef.current !== null) {
          await clearServerSession();
          lastSessionUidRef.current = null;
        }
        setHasProfile(false);
        setStatus("unauthenticated");
      }
    });

    return () => unsubscribe();
  }, [checkProfileExistence, mintServerSession, clearServerSession]);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    setStatus("loading");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      log("attempting signInWithPopup");
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will fire and set status="authenticated"
    } catch (err) {
      const authErr = err as AuthError;
      log("signInWithPopup failed", authErr.code);

      if (POPUP_FALLBACK_ERROR_CODES.has(authErr.code)) {
        // Browser blocked the popup (COOP, popup blocker, or user closed it).
        // Fall back to redirect — the user will navigate fully to Google
        // and bounce back, and getRedirectResult on next mount completes it.
        log("falling back to signInWithRedirect");
        try {
          await signInWithRedirect(auth, provider);
          // The page navigates away; nothing more to do here.
          return;
        } catch (redirectErr) {
          console.error(
            "[auth] signInWithRedirect fallback failed:",
            redirectErr,
          );
          setError("La connexion a échoué. Réessaie dans un instant.");
          setStatus("unauthenticated");
          throw redirectErr;
        }
      }

      console.error("[auth] Google login failed:", authErr);
      setError("La connexion a échoué. Réessaie dans un instant.");
      setStatus("unauthenticated");
      throw authErr;
    }
  }, []);

  const logout = useCallback(async () => {
    setStatus("loading");
    try {
      await signOut(auth);
      // onAuthStateChanged will fire with null and set status="unauthenticated"
    } catch (err) {
      console.error("[auth] signOut failed:", err);
      setStatus("unauthenticated");
    }
  }, []);

  const getFreshToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken(true);
    } catch (err) {
      console.error("[auth] getFreshToken failed:", err);
      return null;
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        loading: status === "loading",
        hasProfile,
        error,
        loginWithGoogle,
        logout,
        getFreshToken,
        refreshProfileStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
