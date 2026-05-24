"use client";

import React from 'react';

/**
 * Minimal markdown renderer for coach messages.
 * Handles: **bold**, *italic*, `code`, `\n\n` paragraphs, `- ` bullets.
 * No XSS risk: all output is React text nodes (no dangerouslySetInnerHTML).
 *
 * Why not react-markdown? +120kB bundle for 5 syntax tokens used by Gemini.
 */

const TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(TOKEN);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={key}
          className="px-1 py-0.5 rounded bg-muted text-[0.85em] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function MarkdownLight({ text }: { text: string }) {
  if (!text) return null;

  // Split into paragraphs by blank line or single line break.
  const blocks = text.split(/\n\n+/);

  return (
    <>
      {blocks.map((block, bIdx) => {
        const lines = block.split('\n');

        // Bullet list detection: every non-empty line starts with "- " or "* "
        const isList =
          lines.length >= 2 &&
          lines.every((l) => /^\s*[-*]\s+/.test(l) || l.trim() === '');

        if (isList) {
          return (
            <ul key={bIdx} className={bIdx > 0 ? 'mt-2 list-disc pl-5 space-y-1' : 'list-disc pl-5 space-y-1'}>
              {lines
                .filter((l) => l.trim() !== '')
                .map((l, lIdx) => (
                  <li key={lIdx}>{renderInline(l.replace(/^\s*[-*]\s+/, ''), `${bIdx}-${lIdx}`)}</li>
                ))}
            </ul>
          );
        }

        // Otherwise: paragraph with soft line breaks
        return (
          <p key={bIdx} className={bIdx > 0 ? 'mt-2' : ''}>
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {renderInline(line, `${bIdx}-${lIdx}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
