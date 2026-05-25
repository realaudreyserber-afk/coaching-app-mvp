"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { refreshFlags } from "@/lib/features/flags";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  hasProfile: boolean;
  loginWithGoogle: () => Promise<void>;
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

  // Check if profile exists in Firestore users/{uid}
  const checkProfileExistence = async (uid: string): Promise<boolean> => {
    try {
      const userDocRef = doc(db, "users", uid);
      const userSnap = await getDoc(userDocRef);
      const exists = userSnap.exists() && userSnap.data()?.profile !== undefined;
      setHasProfile(exists);
      return exists;
    } catch (error) {
      console.error("Error checking user profile in Firestore:", error);
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
      process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === '1' &&
      process.env.NODE_ENV !== 'production';

    if (typeof window !== 'undefined' && mockAuthEnabled) {
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

    // Finalize signInWithRedirect: the SDK needs an explicit getRedirectResult
    // call on mount to consume the redirect token, otherwise onAuthStateChanged
    // never fires and the user appears not-logged-in after Google bounces back.
    getRedirectResult(auth).catch((err) => {
      console.error("getRedirectResult failed:", err);
    });

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
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
      } else {
        if (lastSessionUidRef.current !== null) {
          try {
            await fetch('/api/auth/session', { method: 'DELETE' });
          } catch {
            // best-effort
          }
          lastSessionUidRef.current = null;
        }
        setHasProfile(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Google login failed:", error);
      setLoading(false);
      throw error;
    }
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
