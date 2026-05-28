"use client";

/**
 * Panneau "Historique des sessions" du coach (lecture seule).
 *
 * Liste les sessions archivées (users/{uid}/coach_sessions, doc parent meta)
 * et permet d'en rouvrir une en lecture seule (réutilise ChatBubble sans
 * handlers → pas de feedback/pin, juste lecture). Les écritures sont
 * impossibles (rules server-only) ; ce composant ne fait que lire.
 */

import * as React from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ChatBubble } from "@/components/coach/chat-bubble";
import { X, ChevronLeft, MessageSquare, Clock, History } from "lucide-react";

interface SessionMeta {
  id: string;
  created_at?: string;
  message_count?: number;
  preview?: string;
  title?: string;
}

interface ArchivedMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export function SessionHistory({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [sessions, setSessions] = React.useState<SessionMeta[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<SessionMeta | null>(null);
  const [messages, setMessages] = React.useState<ArchivedMsg[]>([]);
  const [msgLoading, setMsgLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, "users", uid, "coach_sessions"));
        if (cancelled) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<SessionMeta, "id">) }))
          .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
        setSessions(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const openSession = async (s: SessionMeta) => {
    setSelected(s);
    setMsgLoading(true);
    setMessages([]);
    try {
      const snap = await getDocs(
        collection(db, "users", uid, "coach_sessions", s.id, "messages"),
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ArchivedMsg, "id">) }))
        .sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));
      setMessages(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setMsgLoading(false);
    }
  };

  const fmtDate = (iso?: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Historique des sessions coach"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(6,3,15,0.78)",
        backdropFilter: "blur(4px)",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--glass-bg-3)",
          border: "1px solid var(--accent-tech-tint-strong)",
          boxShadow: "0 0 40px var(--accent-tech-tint)",
          clipPath:
            "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "14px 18px", borderBottom: "1px solid var(--glass-border)" }}
        >
          <span
            className="mono flex items-center gap-2"
            style={{ fontSize: 11, letterSpacing: "0.25em", color: "var(--accent-tech)", textTransform: "uppercase" }}
          >
            {selected ? (
              <button
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1 hover:opacity-80"
                style={{ color: "var(--accent-tech)" }}
                aria-label="Retour à la liste"
              >
                <ChevronLeft className="w-4 h-4" /> Retour
              </button>
            ) : (
              <>
                <History className="w-4 h-4" /> Historique des sessions
              </>
            )}
          </span>
          <button onClick={onClose} aria-label="Fermer" className="p-1 rounded hover:bg-white/5" style={{ color: "var(--fg-3)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: 16 }}>
          {error && (
            <p className="mono" style={{ fontSize: 11, color: "var(--alert-500)", padding: "8px 0" }}>
              {error}
            </p>
          )}

          {/* Vue lecture seule d'une session */}
          {selected ? (
            msgLoading ? (
              <p className="mono text-center" style={{ fontSize: 11, color: "var(--fg-4)", padding: 24, letterSpacing: "0.2em" }}>
                CHARGEMENT…
              </p>
            ) : messages.length === 0 ? (
              <p className="mono text-center" style={{ fontSize: 11, color: "var(--fg-5)", padding: 24 }}>
                Session vide.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--fg-5)", textTransform: "uppercase" }}>
                  {selected.title ?? "Session"} · {fmtDate(selected.created_at)} · lecture seule
                </p>
                {messages.map((m) => (
                  <ChatBubble key={m.id} role={m.role} content={m.content} timestamp={m.timestamp} />
                ))}
              </div>
            )
          ) : /* Liste des sessions */ loading ? (
            <p className="mono text-center" style={{ fontSize: 11, color: "var(--fg-4)", padding: 24, letterSpacing: "0.2em" }}>
              CHARGEMENT…
            </p>
          ) : sessions.length === 0 ? (
            <div
              className="mono text-center"
              style={{
                fontSize: 11,
                color: "var(--fg-5)",
                padding: "28px 16px",
                border: "1px dashed var(--glass-border)",
                letterSpacing: "0.1em",
              }}
            >
              Aucune session archivée. Une session est archivée quand tu cliques sur « Nouvelle session ».
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }} className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => openSession(s)}
                    className="w-full text-left transition-colors hover:bg-white/5"
                    style={{
                      padding: "12px 14px",
                      background: "var(--glass-bg-2)",
                      border: "1px solid var(--glass-border)",
                      clipPath:
                        "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono flex items-center gap-1.5" style={{ fontSize: 10, color: "var(--accent-tech)", letterSpacing: "0.1em" }}>
                        <Clock className="w-3 h-3" /> {fmtDate(s.created_at)}
                      </span>
                      <span className="mono flex items-center gap-1" style={{ fontSize: 10, color: "var(--fg-4)" }}>
                        <MessageSquare className="w-3 h-3" /> {s.message_count ?? 0}
                      </span>
                    </div>
                    <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.4 }}>
                      {s.preview || <span style={{ color: "var(--fg-5)" }}>(pas d'aperçu)</span>}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
