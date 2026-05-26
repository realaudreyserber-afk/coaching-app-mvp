"use client";

import * as React from "react";
import { MarkdownLight } from "@/components/coach/markdown-light";
import { SourcesCard, CoachSource } from "@/components/coach/sources-card";

/**
 * Chat Bubble — NoDream Tactical OS look.
 *
 * - role="user"     : gold-tint pill with chamfer (right-aligned)
 * - role="assistant": glass + matrix-tech border with chamfer + glow-tech
 *                     (left-aligned, ORACLE.IA voice)
 */

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  sources?: CoachSource[];
  className?: string;
}

const USER_CLIP =
  "polygon(10px 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)";
const ASSISTANT_CLIP =
  "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)";

export function ChatBubble({
  role,
  content,
  sources,
  className = "",
}: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1 max-w-[85%] ${isUser ? "ml-auto" : "mr-auto"} ${className}`}
    >
      {!isUser && (
        <span
          className="mono"
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
            : "1px solid var(--accent-tech-tint-strong)",
          color: isUser ? "var(--gold-300)" : "var(--fg-1)",
          fontFamily: isUser ? "var(--font-sans)" : "var(--font-serif)",
          fontWeight: isUser ? 500 : 400,
          clipPath: isUser ? USER_CLIP : ASSISTANT_CLIP,
          boxShadow: isUser
            ? "0 0 12px var(--gold-tint-25), inset 0 1px 0 rgba(212,175,55,0.1)"
            : "0 0 16px var(--accent-tech-tint), inset 0 1px 0 rgba(0,255,102,0.08)",
        }}
      >
        {isUser ? (
          content.split("\n").map((para, i) => (
            <p key={i} className={i > 0 ? "mt-2" : ""} style={{ margin: 0 }}>
              {para}
            </p>
          ))
        ) : (
          <MarkdownLight text={content} />
        )}

        {!isUser && sources && sources.length > 0 && (
          <SourcesCard sources={sources} />
        )}
      </div>
    </div>
  );
}
