"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { isNativePlatform } from "@/lib/platform";
import { refreshFlags } from "@/lib/features/flags";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  hasProfile: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  getFreshToken: () => Promise<string | null>;
  refreshProfileStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const lastSessionUidRef = React.useRef<string | null>(null);

  // Check if onboarding is fully completed in Firestore users/{uid}.
  // We rely on `onboarding_completed: true` (set server-side by
  // /api/ai/generate-plan after a plan has actually been persisted) rather
  // than `profile !== undefined` — the latter flips to true at step 1, so
  // any user who abandoned mid-onboarding got incorrectly routed to dashboard.
  const checkProfileExistence = async (uid: string): Promise<boolean> => {
    try {
      const userDocRef = doc(db, "users", uid);
      const userSnap = await getDoc(userDocRef);
      const exists =
        userSnap.exists() && userSnap.data()?.onboarding_completed === true;
      setHasProfile(exists);
      return exists;
    } catch (error) {
      console.error("Error checking onboarding completion in Firestore:", error);
      setHasProfile(false);
      return false;
    }
  };

  const refreshProfileStatus = async (): Promise<boolean> => {
    if (user) {
      return await checkProfileExistence(user.uid);
    }
    return false;
  };

  useEffect(() => {
    void refreshFlags().catch(() => {
      // best-effort, sync resolution falls back to env/localStorage
    });
  }, []);

  useEffect(() => {
    const mockAuthEnabled =
      typeof window !== 'undefined' &&
      (process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === '1' ||
        window.localStorage.getItem('mock_user') !== null) &&
      process.env.NODE_ENV !== 'production';

    console.log("[AuthProvider] mockAuthEnabled:", mockAuthEnabled);
    console.log("[AuthProvider] window:", typeof window !== 'undefined');
    console.log("[AuthProvider] localStorage mock_user:", typeof window !== 'undefined' ? window.localStorage.getItem('mock_user') : null);
    console.log("[AuthProvider] process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH:", process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH);
    console.log("[AuthProvider] process.env.NODE_ENV:", process.env.NODE_ENV);

    if (mockAuthEnabled) {
      try {
        const mockUserVal = window.localStorage.getItem('mock_user');
        if (mockUserVal === 'true' || mockUserVal === 'non-admin' || mockUserVal === 'no-profile') {
          const isNonAdmin = mockUserVal === 'non-admin';
          const isNoProfile = mockUserVal === 'no-profile';
          const mockToken = isNoProfile
            ? 'mock-token-no-profile'
            : isNonAdmin
              ? 'mock-token-non-admin'
              : 'mock-token';
          const mockUser = {
            uid: isNonAdmin ? 'non-admin-user-id' : isNoProfile ? 'no-profile-user-id' : 'dev-user-id',
            email: isNonAdmin ? 'non-admin@coaching.local' : isNoProfile ? 'no-profile@coaching.local' : 'dev@coaching.local',
            displayName: isNonAdmin ? 'Non-Admin User' : isNoProfile ? 'No-Profile User' : 'Mock User',
            emailVerified: true,
            isAnonymous: false,
            metadata: {},
            providerData: [],
            providerId: 'google.com',
            refreshToken: 'mock-refresh-token',
            tenantId: null,
            delete: async () => {},
            getIdToken: async () => mockToken,
            getIdTokenResult: async () => ({ token: mockToken, signInProvider: 'google.com', claims: {}, authTime: '', expirationTime: '', issuedAtTime: '' }),
            toJSON: () => ({}),
            phoneNumber: null,
            photoURL: null,
          } as unknown as User;
          setTimeout(async () => {
            try {
              await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: mockToken }),
              });
            } catch {
              // best-effort
            }
            setUser(mockUser);
            setHasProfile(!isNoProfile);
            setLoading(false);
          }, 0);
          return;
        }
      } catch (e) {
        console.error("Error configuring mock user:", e);
      }
    }

    let anonymousAttempted = false;

    // Capture the result of any pending signInWithRedirect. This runs once on
    // mount and resolves silently with null when there's no pending redirect
    // (most page loads). When a user just came back from accounts.google.com,
    // the resolved cred lights up onAuthStateChanged with the real Google
    // user, replacing whatever anonymous session was active.
    getRedirectResult(auth).catch((err) => {
      console.error('[auth] getRedirectResult failed:', err);
    });

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        if (lastSessionUidRef.current !== currentUser.uid) {
          try {
            const idToken = await currentUser.getIdToken();
            await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            });
            lastSessionUidRef.current = currentUser.uid;
          } catch (err) {
            console.error('Failed to mint server session cookie:', err);
          }
        }
        await checkProfileExistence(currentUser.uid);
        setLoading(false);
        return;
      }

      // No user signed in. Try anonymous sign-in once so the app stays
      // accessible without an explicit login flow. Requires the Anonymous
      // provider to be enabled in Firebase Console.
      if (!anonymousAttempted) {
        anonymousAttempted = true;
        try {
          await signInAnonymously(auth);
          // onAuthStateChanged will fire again with the new anonymous user.
          return;
        } catch (err) {
          console.error('[auth] Anonymous sign-in failed:', err);
          // fall through to truly-unauthenticated state below
        }
      }

      setUser(null);
      if (lastSessionUidRef.current !== null) {
        try {
          await fetch('/api/auth/session', { method: 'DELETE' });
        } catch {
          // best-effort
        }
        lastSessionUidRef.current = null;
      }
      setHasProfile(false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      // Always use signInWithRedirect (web + native). signInWithPopup was
      // unreliable: third-party cookie restrictions on Chrome/Safari, popup
      // blockers, "popup closed prematurely" race conditions, and intermittent
      // failures inside embedded webviews. Redirect = single full-page nav to
      // accounts.google.com then auto-return — works the same everywhere.
      // void isNativePlatform — kept import in case we re-introduce a native
      // branch later.
      void isNativePlatform;
      await signInWithRedirect(auth, provider);
      // signInWithRedirect navigates away; nothing more to do here. The
      // post-redirect handler in the mount effect picks up getRedirectResult().
    } catch (error) {
      console.error("Google login failed:", error);
      setLoading(false);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged handles the rest (cookie, profile check, status).
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged handles the rest.
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setHasProfile(false);
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFreshToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken(true);
    } catch (error) {
      console.error("Error retrieving fresh ID Token:", error);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        hasProfile,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
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
