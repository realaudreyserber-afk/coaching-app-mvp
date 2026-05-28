"use client";

import * as React from "react";
import { MarkdownLight } from "@/components/coach/markdown-light";
import { SourcesCard, CoachSource } from "@/components/coach/sources-card";
import { ThumbsUp, ThumbsDown, Copy, Check, Pin, PinOff } from "lucide-react";

/**
 * Chat Bubble — NoDream Tactical OS look.
 *
 * - role="user"     : gold-tint pill with chamfer (right-aligned)
 * - role="assistant": glass + matrix-tech border with chamfer + glow-tech
 *                     (left-aligned, ORACLE.IA voice)
 */

interface ChatBubbleProps {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: CoachSource[];
  className?: string;
  timestamp?: string;
  feedback?: "up" | "down" | null;
  onFeedback?: (messageId: string, type: 'up' | 'down') => void;
  /** Audit COACH 2026-05-28 #17 : épinglage messages clés */
  pinned?: boolean;
  onTogglePin?: (messageId: string, currentlyPinned: boolean) => void;
  /** Highlight d'une query de recherche (audit COACH #16) */
  searchQuery?: string;
}

const USER_CLIP =
  "polygon(10px 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)";
const ASSISTANT_CLIP =
  "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)";

const HexagonGreen = () => (
  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-zinc-950 border border-emerald-500/30 rounded-lg text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
    <span className="text-[10px] font-bold font-mono">Ω</span>
  </div>
);

const HexagonGold = () => (
  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-zinc-950 border border-amber-500/30 rounded-lg text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
    <span className="text-[10px] font-bold font-mono">U</span>
  </div>
);

export function ChatBubble({
  id,
  role,
  content,
  sources,
  className = "",
  timestamp,
  feedback,
  onFeedback,
  pinned = false,
  onTogglePin,
  searchQuery,
}: ChatBubbleProps) {
  const isUser = role === "user";
  const [copied, setCopied] = React.useState(false);

  // Highlight de la query de recherche dans le contenu user (assistant garde
  // markdown render normal — highlight inline serait conflictuel avec md parser)
  const displayContent = React.useMemo(() => {
    if (!isUser || !searchQuery || searchQuery.trim().length < 2) return null;
    const q = searchQuery.trim();
    const parts: Array<{ text: string; match: boolean }> = [];
    const lower = content.toLowerCase();
    const qLower = q.toLowerCase();
    let pos = 0;
    while (pos < content.length) {
      const idx = lower.indexOf(qLower, pos);
      if (idx === -1) {
        parts.push({ text: content.slice(pos), match: false });
        break;
      }
      if (idx > pos) parts.push({ text: content.slice(pos, idx), match: false });
      parts.push({ text: content.slice(idx, idx + q.length), match: true });
      pos = idx + q.length;
    }
    return parts;
  }, [isUser, content, searchQuery]);

  const handleCopy = () => {
    // Copy clean rendered text (no raw markdown)
    const cleanText = content
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#+\s+(.*)/g, '$1');
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex items-start gap-2.5 w-full ${isUser ? "justify-end" : "justify-start"} ${className}`}
      data-pinned={pinned ? "true" : undefined}
    >
      {!isUser && <HexagonGreen />}

      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[80%]`}>
        {!isUser && (
          <span
            className="mono mb-1 flex items-center gap-1.5"
            style={{
              fontSize: 9,
              letterSpacing: "0.3em",
              color: "var(--accent-tech)",
              textTransform: "uppercase",
              opacity: 0.85,
              padding: "0 4px",
            }}
          >
            [ORACLE.IA]
            {pinned && (
              <span
                className="inline-flex items-center gap-0.5"
                style={{ color: "var(--gold-400)", opacity: 1 }}
                aria-label="Message épinglé"
              >
                <Pin className="w-2.5 h-2.5" /> ÉPINGLÉ
              </span>
            )}
          </span>
        )}
        <div
          style={{
            position: "relative",
            padding: "12px 14px",
            fontSize: 14,
            lineHeight: 1.55,
            background: isUser ? "var(--gold-tint-15)" : "var(--glass-bg-3)",
            border: isUser
              ? "1px solid var(--gold-tint-35)"
              : pinned
                ? "1px solid var(--gold-400)"
                : "1px solid var(--accent-tech-tint-strong)",
            // Audit COACH 2026-05-28 #20 : contraste WCAG renforcé — var(--fg-1) était limite
            // sur fond glass-bg-3 + matrice derrière. Bump à #f4f4f5 explicite (zinc-100)
            color: isUser ? "var(--gold-300)" : "#f4f4f5",
            fontFamily: isUser ? "var(--font-sans)" : "var(--font-serif)",
            fontWeight: isUser ? 500 : 400,
            clipPath: isUser ? USER_CLIP : ASSISTANT_CLIP,
            boxShadow: pinned && !isUser
              ? "0 0 20px var(--gold-tint-35), inset 0 1px 0 rgba(212,175,55,0.15)"
              : isUser
                ? "0 0 12px var(--gold-tint-25), inset 0 1px 0 rgba(212,175,55,0.1)"
                : "0 0 16px var(--accent-tech-tint), inset 0 1px 0 rgba(0,255,102,0.08)",
          }}
        >
          {isUser ? (
            displayContent ? (
              <p style={{ margin: 0 }}>
                {displayContent.map((part, i) =>
                  part.match ? (
                    <mark
                      key={i}
                      style={{
                        background: "var(--accent-tech-tint-strong)",
                        color: "var(--accent-tech)",
                        padding: "0 2px",
                      }}
                    >
                      {part.text}
                    </mark>
                  ) : (
                    <React.Fragment key={i}>{part.text}</React.Fragment>
                  ),
                )}
              </p>
            ) : (
              content.split("\n").map((para, i) => (
                <p key={i} className={i > 0 ? "mt-2" : ""} style={{ margin: 0 }}>
                  {para}
                </p>
              ))
            )
          ) : (
            <MarkdownLight text={content} />
          )}

          {!isUser && sources && sources.length > 0 && (
            <SourcesCard sources={sources} />
          )}
        </div>

        <div className={`flex items-center gap-3 mt-1 px-1 text-[11px] text-zinc-500`}>
          {timestamp && (
            <span className="text-[10px] text-zinc-600 font-mono select-none">
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          <button
            onClick={handleCopy}
            className="hover:text-zinc-300 p-0.5 rounded transition-colors"
            title="Copier le message"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {id && onTogglePin && (
            <button
              onClick={() => onTogglePin(id, pinned)}
              className={`p-0.5 rounded transition-colors ${pinned ? 'text-amber-400' : 'hover:text-zinc-300'}`}
              title={pinned ? "Désépingler" : "Épingler ce message"}
              aria-pressed={pinned}
            >
              {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
          )}

          {!isUser && id && onFeedback && (
            <div className="flex items-center gap-1.5 border-l border-zinc-800/80 pl-2">
              <button
                onClick={() => onFeedback(id, 'up')}
                className={`p-0.5 rounded transition-colors ${feedback === 'up' ? 'text-emerald-400' : 'hover:text-zinc-400'}`}
                title="Utile"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onFeedback(id, 'down')}
                className={`p-0.5 rounded transition-colors ${feedback === 'down' ? 'text-red-400' : 'hover:text-zinc-400'}`}
                title="Pas utile"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {isUser && <HexagonGold />}
    </div>
  );
}
