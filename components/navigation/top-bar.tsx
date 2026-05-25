"use client";

import React, { useState, useEffect } from "react";
import { LogOut, User, Mic, BookOpen, Users } from "lucide-react";
import { useAuth } from "@/lib/firebase/hooks";
import { useRouter } from "next/navigation";
import { flags } from "@/lib/features/flags";
import VoiceRecordModal from "@/components/features/voice-log/VoiceRecordModal";

export default function TopBar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);

  useEffect(() => {
    setIsVoiceEnabled(flags.voiceLog());
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const iconBtn = "flex items-center justify-center h-11 w-11 rounded-full border border-border bg-card hover:bg-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Brand Title */}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          aria-label="Aller au tableau de bord NoDream"
          className="text-xl font-extrabold tracking-tight font-serif text-primary select-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          NoDream
        </button>

        {/* User Actions */}
        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => router.push("/blog")}
              aria-label="Ouvrir le journal"
              className={`${iconBtn} text-foreground`}
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => router.push("/community")}
              aria-label="Ouvrir la communauté"
              className={`${iconBtn} text-foreground`}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
            </button>
            {isVoiceEnabled && (
              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                aria-label="Démarrer la dictée vocale"
                className={`${iconBtn} text-primary`}
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push("/settings")}
              aria-label="Ouvrir les réglages du profil"
              className={`${iconBtn} text-foreground`}
            >
              <User className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Se déconnecter"
              className={`${iconBtn} text-muted-foreground hover:text-red-500`}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <VoiceRecordModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />
    </header>
  );
}
