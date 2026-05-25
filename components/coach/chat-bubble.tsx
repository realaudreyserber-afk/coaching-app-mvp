"use client";

import * as React from "react";
import { MarkdownLight } from "@/components/coach/markdown-light";
import { SourcesCard, CoachSource } from "@/components/coach/sources-card";

/**
 * Chat Bubble — bulle de conversation pour le coach IA.
 *
 * - role="user" : bulle gold sur la droite, texte zinc-950 (WCAG AAA)
 * - role="assistant" : bulle blanche sur la gauche, texte zinc-900 (pattern
 *   iMessage dark, lisibilité maximale sur fond noir).
 *
 * Le contenu user est rendu en texte brut (paragraphes split sur \n).
 * Le contenu assistant passe par MarkdownLight (bold/italic/code/lists).
 *
 * Stitch ref : coach-d.jpg, coach-m.jpg
 */

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  /** Sources scientifiques citées (affichées dans la bulle assistant) */
  sources?: CoachSource[];
  className?: string;
}

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
      <div
        className={`p-3 rounded-2xl text-sm leading-relaxed shadow-lg ${
          isUser
            ? "bg-amber-500 text-zinc-950 font-semibold rounded-tr-none"
            : "bg-white text-zinc-900 border border-zinc-200 rounded-tl-none font-serif"
        }`}
      >
        {isUser ? (
          content.split("\n").map((para, i) => (
            <p key={i} className={i > 0 ? "mt-2" : ""}>
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
