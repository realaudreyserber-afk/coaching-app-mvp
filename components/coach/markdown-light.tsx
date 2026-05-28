"use client";

import React from 'react';

/**
 * Minimal markdown renderer for coach messages.
 * Handles: **bold**, *italic*, `code`, `\n\n` paragraphs, `- ` bullets, and headings.
 * No XSS risk: all output is React text nodes (no dangerouslySetInnerHTML).
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
          className="px-1 py-0.5 rounded bg-zinc-950/60 text-green-400 text-[0.9em] font-mono border border-zinc-800/80"
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

  // Stripping TECHNICAL tags completely before parsing
  const cleanedText = text
    .replace(/<COACH_SAVE>[\s\S]*?<\/COACH_SAVE>/gi, '')
    .replace(/<COACH_PLAN_PATCH>[\s\S]*?<\/COACH_PLAN_PATCH>/gi, '')
    .trim();

  if (!cleanedText) return null;

  const lines = cleanedText.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let currentList: React.ReactNode[] = [];
  let currentParagraph: string[] = [];
  let blockKey = 0;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      elements.push(
        <p key={`p-${blockKey++}`} className="mt-2 text-foreground/90 leading-relaxed">
          {currentParagraph.map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {renderInline(line, `p-${blockKey}-${i}`)}
            </React.Fragment>
          ))}
        </p>
      );
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${blockKey++}`} className="mt-2 mb-2 list-disc pl-5 space-y-1 text-foreground/90">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Block
    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushList();
      if (inCodeBlock) {
        // End code block
        elements.push(
          <pre key={`code-${blockKey++}`} className="mt-2 mb-2 p-3 rounded bg-zinc-950/60 border border-zinc-800/80 text-green-400 text-sm font-mono overflow-x-auto leading-relaxed">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // 2. Headers
    if (trimmed.startsWith('#') && !trimmed.startsWith('**')) {
      const match = trimmed.match(/^(#{1,3})\s+(.*)$/);
      if (match) {
        flushParagraph();
        flushList();
        const level = match[1].length;
        const content = match[2];
        if (level === 1) {
          elements.push(
            <h1 key={`h1-${blockKey++}`} className="text-2xl font-serif text-primary border-b border-border/40 pb-1 mt-6 mb-3">
              {renderInline(content, `h1-${blockKey}`)}
            </h1>
          );
        } else if (level === 2) {
          elements.push(
            <h2 key={`h2-${blockKey++}`} className="text-xl font-serif text-primary mt-5 mb-2">
              {renderInline(content, `h2-${blockKey}`)}
            </h2>
          );
        } else if (level === 3) {
          elements.push(
            <h3 key={`h3-${blockKey++}`} className="text-lg font-sans font-semibold text-foreground border-b border-zinc-800/40 pb-0.5 mt-4 mb-2">
              {renderInline(content, `h3-${blockKey}`)}
            </h3>
          );
        }
        continue;
      }
    }

    // 3. Lists
    const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      const content = listMatch[2];
      currentList.push(
        <li key={`li-${blockKey++}`} className="marker:text-primary">
          {renderInline(content, `li-${blockKey}`)}
        </li>
      );
      continue;
    }

    // 4. Empty line
    if (trimmed === '') {
      flushParagraph();
      flushList();
      continue;
    }

    // 5. Normal text line -> add to paragraph
    flushList(); // list ended if we hit text
    currentParagraph.push(line);
  }

  // Flush remaining
  flushParagraph();
  flushList();

  return <>{elements}</>;
}
