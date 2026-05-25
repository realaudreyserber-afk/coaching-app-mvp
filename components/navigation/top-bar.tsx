"use client";

import React, { useState, useEffect } from "react";
import { LogOut, User, Mic } from "lucide-react";
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-cream/80 backdrop-blur-md dark:bg-anthracite/80">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        {/* Brand Title */}
        <div className="flex items-center gap-2">
          <span 
            onClick={() => router.push("/dashboard")}
            className="text-xl font-extrabold tracking-tight font-serif text-primary cursor-pointer select-none"
          >
            {"L'Insociable"}
          </span>
        </div>

        {/* User Actions */}
        {user && (
          <div className="flex items-center gap-4">
            {isVoiceEnabled && (
              <button
                onClick={() => setIsVoiceModalOpen(true)}
                className="flex items-center justify-center h-8 w-8 rounded-full border border-border bg-card text-primary hover:bg-muted transition-all"
                title="Dictée Vocale"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => router.push("/settings")}
              className="flex items-center justify-center h-8 w-8 rounded-full border border-border bg-card text-foreground hover:bg-muted transition-all"
              title="Profil & Paramètres"
            >
              <User className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center h-8 w-8 rounded-full border border-border bg-card text-muted-foreground hover:text-red-500 hover:bg-muted transition-all"
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
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
