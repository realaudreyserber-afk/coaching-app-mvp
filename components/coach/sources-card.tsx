import * as React from "react";
import { BookOpen, ExternalLink } from "lucide-react";

/**
 * Sources Card — affiche la liste des sources scientifiques citées par le coach
 * dans sa réponse. Rendu à l'intérieur de la bulle assistant.
 *
 * Stitch ref : coach-d.jpg (boîtes amber light avec FR/EN badges)
 */

export interface CoachSource {
  url: string;
  authors: string;
  year: string | number;
  title: string;
  language?: "fr" | "en";
}

interface SourcesCardProps {
  sources: CoachSource[];
  className?: string;
}

export function SourcesCard({ sources, className = "" }: SourcesCardProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className={`mt-4 pt-3 border-t border-zinc-200 space-y-2 ${className}`}>
      <div className="flex items-center space-x-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          Sources scientifiques ({sources.length})
        </span>
      </div>
      <div className="grid gap-1.5 pt-1">
        {sources.map((src, idx) => (
          <a
            key={idx}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-2 rounded bg-amber-50 border border-amber-200 hover:border-amber-500 hover:bg-amber-100 transition-all text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            aria-label={`Source ${src.authors} ${src.year} : ${src.title} (s'ouvre dans un nouvel onglet)`}
          >
            <div className="truncate pr-2 flex items-center gap-1.5">
              {src.language && (
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-1 rounded ${
                    src.language === "fr"
                      ? "bg-amber-200 text-amber-900"
                      : "bg-zinc-200 text-zinc-700"
                  }`}
                  aria-label={src.language === "fr" ? "Source en français" : "Source en anglais"}
                >
                  {src.language === "fr" ? "FR" : "EN"}
                </span>
              )}
              <span className="font-semibold text-amber-800">
                {src.authors} ({src.year})
              </span>
              <span className="text-zinc-400" aria-hidden="true">
                •
              </span>
              <span className="italic truncate text-zinc-700">{src.title}</span>
            </div>
            <ExternalLink
              className="h-3 w-3 text-zinc-500 flex-shrink-0"
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
