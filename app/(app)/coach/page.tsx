/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Send, ArrowLeft, Loader2 } from 'lucide-react';
import { ChatBubble } from '@/components/coach/chat-bubble';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  timestamp?: string;
}

/**
 * Strips the <COACH_SAVE>...</COACH_SAVE> structured-data tag from the
 * coach's reply before it's shown to the user. The tag is only meant
 * for the persistence pipeline (see persistCoachSaveBlock).
 *
 * Tolerant to a partially-streamed tag (when we've received the opening
 * but not yet the closing): hides everything from the opening tag onward
 * so the user never sees the raw JSON appear mid-stream.
 */
function stripCoachSaveTag(content: string): string {
  // Closed tags → remove the whole block, including the markers.
  let out = content
    .replace(/<COACH_SAVE>[\s\S]*?<\/COACH_SAVE>/g, '')
    .replace(/<COACH_PLAN_PATCH>[\s\S]*?<\/COACH_PLAN_PATCH>/g, '');
  // Unclosed opening tags still streaming → hide from there to end.
  const openSave = out.indexOf('<COACH_SAVE>');
  const openPatch = out.indexOf('<COACH_PLAN_PATCH>');
  const open = [openSave, openPatch].filter((i) => i !== -1).sort((a, b) => a - b)[0];
  if (open !== undefined) out = out.slice(0, open);
  return out.trimEnd();
}

/**
 * Parses any <COACH_SAVE>{...}</COACH_SAVE> block from a completed
 * coach reply and POSTs the JSON payload to /api/profile/update-fields.
 * Silently no-ops if there's no tag or the JSON is malformed.
 */
async function persistCoachSaveBlock(
  fullContent: string,
  getFreshToken: () => Promise<string | null>,
): Promise<void> {
  const match = fullContent.match(/<COACH_SAVE>([\s\S]*?)<\/COACH_SAVE>/);
  if (!match) return;
  let updates: Record<string, unknown>;
  try {
    updates = JSON.parse(match[1].trim());
  } catch (err) {
    console.warn('[coach-save] invalid JSON in tag:', err);
    return;
  }
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return;
  if (Object.keys(updates).length === 0) return;

  const token = await getFreshToken();
  if (!token) {
    console.warn('[coach-save] no token, skipping persist');
    return;
  }

  const res = await fetch('/api/profile/update-fields', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn('[coach-save] API rejected:', res.status, body);
  } else {
    const data = await res.json().catch(() => ({}));
    console.log('[coach-save] persisted:', data);
  }
}

/**
 * Wave 6A : parse any <COACH_PLAN_PATCH>{...}</COACH_PLAN_PATCH> block and
 * POST it to /api/coach/apply-patch. The server whitelists + range-validates
 * + applies in a Firestore transaction (with plan history archive).
 *
 * Silently no-ops if no tag / malformed JSON. Always after the stream
 * completes (after <COACH_SAVE> processing) so chat history persisted matches
 * what was applied.
 */
async function persistCoachPlanPatchBlock(
  fullContent: string,
  getFreshToken: () => Promise<string | null>,
): Promise<void> {
  const match = fullContent.match(/<COACH_PLAN_PATCH>([\s\S]*?)<\/COACH_PLAN_PATCH>/);
  if (!match) return;
  let patch: unknown;
  try {
    patch = JSON.parse(match[1].trim());
  } catch (err) {
    console.warn('[coach-plan-patch] invalid JSON in tag:', err);
    return;
  }
  if (!patch || typeof patch !== 'object') return;
  if (Array.isArray(patch) && patch.length === 0) return;
  if (!Array.isArray(patch) && Object.keys(patch as Record<string, unknown>).length === 0) return;

  const token = await getFreshToken();
  if (!token) {
    console.warn('[coach-plan-patch] no token, skipping persist');
    return;
  }

  const res = await fetch('/api/coach/apply-patch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ patch, reason: 'coach_chat_emit' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn('[coach-plan-patch] API rejected:', res.status, body);
  } else {
    const data = await res.json().catch(() => ({}));
    console.log('[coach-plan-patch] applied:', data);
  }
}

export default function CoachPage() {
  const router = useRouter();
  const { user, getFreshToken, loading } = useAuth();
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Salut. Je suis NoDream, ton coach IA. Pose-moi tes questions sur ta nutrition, ton entraînement ou ta récupération. Pas de promesse facile, pas de blabla — on va droit au but. Qu'est-ce qui te bloque aujourd'hui ?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Wave 11D — AbortController kept in a ref so we can cancel the in-flight
  // SSE stream when the user navigates away (prevents "setState on unmounted
  // component" warnings + frees the server stream early). Also lets us cancel
  // on a 2nd submit if the user wants to interrupt the IA.
  const abortRef = useRef<AbortController | null>(null);
  // Hard timeout watchdog — if the IA hangs for 90s, we kill the stream and
  // restore the user input so they can retry.
  const STREAM_TIMEOUT_MS = 90_000;

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Wave 11D — Cleanup any in-flight stream on unmount. Without this, the
  // reader keeps consuming chunks and the inner setMessages calls trigger
  // React's "Can't perform a state update on an unmounted component" warning.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Wave 6C : mark proactive interventions as read when user opens /coach
  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      try {
        const token = await getFreshToken();
        if (!token) return;
        await fetch('/api/coach/mark-read', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        console.warn('[coach] mark-read failed:', e);
      }
    })();
  }, [user, loading, getFreshToken]);

  // Load last 30 messages from user's chat history in Firestore if available
  useEffect(() => {
    if (loading || !user) return;

    // Wave 12 — `cancelled` guard prevents the loaded history from
    // overwriting messages the user just sent between mount and fetch
    // completion. If a message went out while we were fetching, the
    // setMessages from this effect would erase it. Same flag covers
    // unmount cleanup.
    let cancelled = false;

    const loadChatHistory = async () => {
      try {
        const chatRef = collection(db, 'users', user.uid, 'coach_messages');
        const q = query(chatRef, orderBy('timestamp', 'asc'), limit(30));
        const snap = await getDocs(q);
        if (cancelled) return;

        if (!snap.empty) {
          const loadedHistory: ChatMessage[] = [];
          snap.forEach((doc) => {
            const data = doc.data();
            // Strip any leftover <COACH_SAVE> blocks from legacy messages
            // persisted before the backend started cleaning them.
            const rawContent = data.content ?? '';
            const cleanContent =
              data.role === 'assistant'
                ? stripCoachSaveTag(rawContent)
                : rawContent;
            loadedHistory.push({
              id: doc.id,
              role: data.role,
              content: cleanContent,
              sources: data.sources || [],
              timestamp: data.timestamp
            });
          });
          // Merge instead of overwrite: keep any local message whose
          // timestamp is more recent than the last loaded one (user typed
          // before history arrived). Defensive on undefined timestamps —
          // legacy docs may lack the field.
          setMessages((prev) => {
            if (loadedHistory.length === 0) return prev;
            const lastLoadedTs = loadedHistory[loadedHistory.length - 1].timestamp ?? '';
            const newer = prev.filter((m) => (m.timestamp ?? '') > lastLoadedTs);
            return [...loadedHistory, ...newer];
          });
        }
      } catch (err) {
        if (!cancelled) console.error('Error loading chat history:', err);
      }
    };

    loadChatHistory();
    return () => { cancelled = true; };
  }, [user, loading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !user || sending) return;

    const userText = inputMessage.trim();
    setInputMessage('');
    setError(null);
    setSending(true);

    // 1. Add user message locally
    const userMsg: ChatMessage = {
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);

    // Wave 11D — Declared at the function scope so the finally block can
    // always clear it (it's assigned inside try once fetch fires).
    let watchdog: ReturnType<typeof setTimeout> | undefined;

    try {
      // Save user message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'coach_messages'), {
        role: 'user',
        content: userText,
        timestamp: userMsg.timestamp
      });

      // 2. Prepare payload for the API
      // Send the last 6 messages to API for conversation context
      const chatContext = messages
        .concat(userMsg)
        .slice(-8)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const token = await getFreshToken();
      if (!token) {
        throw new Error('Authentification requise');
      }

      // Wave 11D — abort any prior in-flight stream before starting a new one,
      // then attach a fresh AbortController whose signal both fetch + the
      // reader loop respect. A setTimeout watchdog aborts at 90s as a safety
      // net against server hangs.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      watchdog = setTimeout(() => {
        controller.abort(new Error('stream_timeout_90s'));
      }, STREAM_TIMEOUT_MS);

      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ messages: chatContext }),
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') || '';
      const isSse = contentType.includes('text/event-stream');

      if (!res.ok || !isSse || !res.body) {
        let serverMessage = 'Impossible de contacter le Coach IA.';
        try {
          const errData = await res.clone().json();
          if (errData?.error) serverMessage = errData.error;
        } catch {
          // body not JSON
        }
        throw new Error(serverMessage);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let sources: any[] = [];

      const placeholder: ChatMessage = {
        role: 'assistant',
        content: '',
        sources: [],
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, placeholder]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          if (!evt.trim()) continue;
          const lines = evt.split('\n');
          const eventLine = lines.find(l => l.startsWith('event: '));
          const dataLine = lines.find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          const eventType = eventLine?.slice(7).trim() ?? 'message';
          const payload = dataLine.slice(6);

          try {
            if (eventType === 'sources') {
              sources = JSON.parse(payload);
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, sources };
                }
                return copy;
              });
            } else if (eventType === 'chunk') {
              const { text } = JSON.parse(payload);
              accumulated += text;
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') {
                  // Hide the <COACH_SAVE>...</COACH_SAVE> tag while streaming.
                  // We still keep the full accumulated string for post-stream parsing.
                  const visible = stripCoachSaveTag(accumulated);
                  copy[copy.length - 1] = { ...last, content: visible };
                }
                return copy;
              });
            } else if (eventType === 'error') {
              const { error: errMsg } = JSON.parse(payload);
              throw new Error(errMsg);
            }
          } catch (parseErr) {
            console.warn('SSE parse error:', parseErr);
          }
        }
      }

      // Stream complete: parse <COACH_SAVE>{...}</COACH_SAVE>, push to API.
      await persistCoachSaveBlock(accumulated, getFreshToken).catch((err) =>
        console.warn('[coach-save] persist failed:', err),
      );
      // Wave 6A: same for <COACH_PLAN_PATCH>{...}</COACH_PLAN_PATCH>
      await persistCoachPlanPatchBlock(accumulated, getFreshToken).catch((err) =>
        console.warn('[coach-plan-patch] persist failed:', err),
      );

      // Backend now persists assistant message via streaming placeholder.
      // No client-side write needed.

    } catch (err: any) {
      // Wave 11D — Distinguish "user navigated away / cancelled" (AbortError)
      // from real errors. AbortError on unmount must NOT touch state (component
      // is gone) nor restore inputMessage.
      const isAbort = err?.name === 'AbortError' || err?.message === 'stream_timeout_90s';
      if (isAbort && err?.message === 'stream_timeout_90s') {
        setError("Le coach n'a pas répondu (timeout 90s). Réessaye.");
        setMessages(prev => prev.slice(0, -1));
        setInputMessage(userText);
      } else if (!isAbort) {
        console.error('Chat error:', err);
        const msg = (err instanceof Error && err.message) ? err.message : "Bug de connexion. Réessaye dans un instant.";
        setError(msg);
        setMessages(prev => prev.slice(0, -1));
        setInputMessage(userText);
      }
    } finally {
      // Wave 11D — clear the watchdog whatever happened.
      if (watchdog) clearTimeout(watchdog);
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col max-w-3xl mx-auto w-full h-[calc(100vh-4rem)] relative pb-20"
      style={{ background: 'transparent' }}
    >

      {/* Tactical Header — ORACLE.IA terminal */}
      <div
        className="flex items-center space-x-3 p-4 sticky top-0 z-30"
        style={{
          background: 'rgba(6, 3, 15, 0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--gold-tint-15)',
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard')}
          aria-label="Retour au tableau de bord"
          className="h-11 w-11"
          style={{ color: 'var(--fg-2)' }}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="flex-1">
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.3em',
              color: 'var(--accent-tech)',
              opacity: 0.85,
            }}
          >
            [ORACLE.IA · TERMINAL-04]
          </span>
          <h1
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: 'var(--gold-400)',
              textShadow: '0 0 12px rgba(212, 175, 55, 0.4)',
              margin: 0,
            }}
          >
            Coach NoDream
          </h1>
          <p
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.18em',
              color: 'var(--fg-4)',
              textTransform: 'uppercase',
              margin: '2px 0 0 0',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span className="status-dot" style={{ marginRight: 6 }} aria-hidden="true" />
            <span><span className="sr-only">Statut : </span>Active · Streaming</span>
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 pb-24"
        role="log"
        aria-live="polite"
        aria-label="Conversation avec le coach"
      >
        {messages.map((m, idx) => (
          <ChatBubble
            key={idx}
            role={m.role}
            content={m.content}
            sources={m.sources}
          />
        ))}

        {sending && (
          <div
            className="mono flex items-center gap-2 mr-auto p-3 max-w-[85%]"
            role="status"
            style={{
              background: 'var(--accent-tech-tint)',
              border: '1px solid var(--accent-tech)',
              boxShadow: '0 0 12px var(--accent-tech-tint-strong)',
              clipPath:
                'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
              fontSize: 11,
              letterSpacing: '0.15em',
              color: 'var(--accent-tech)',
              textTransform: 'uppercase',
            }}
          >
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            <span>ORACLE.IA · analyse en cours</span>
          </div>
        )}

        {error && (
          <div
            className="mono text-center max-w-[85%] mx-auto"
            role="alert"
            style={{
              fontSize: 11,
              color: 'var(--alert-500)',
              background: 'var(--alert-tint-15)',
              border: '1px solid var(--alert-500)',
              padding: '10px 12px',
              letterSpacing: '0.1em',
              clipPath:
                'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
            }}
          >
            <span style={{ fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              [ERR-COMM]
            </span>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input box — terminal prompt */}
      <form
        onSubmit={handleSendMessage}
        className="absolute bottom-0 left-0 right-0 p-3 flex items-center space-x-2 z-30"
        aria-label="Envoyer un message au coach"
        style={{
          background: 'rgba(6, 3, 15, 0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--gold-tint-15)',
        }}
      >
        <label htmlFor="coach-message-input" className="sr-only">
          Message à envoyer au coach
        </label>
        <span
          className="mono"
          style={{
            color: 'var(--accent-tech)',
            fontSize: 14,
            paddingLeft: 4,
            textShadow: '0 0 6px var(--accent-tech)',
          }}
          aria-hidden="true"
        >
          &gt;
        </span>
        <input
          id="coach-message-input"
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Saisis ta requête..."
          disabled={sending}
          className="mono flex-1 h-11 px-3 text-sm focus:outline-none"
          style={{
            background: 'var(--glass-bg-2)',
            border: '1px solid var(--glass-border)',
            color: 'var(--fg-1)',
            letterSpacing: '0.02em',
            clipPath:
              'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-tech)';
            e.currentTarget.style.boxShadow = '0 0 12px var(--accent-tech-tint-strong)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--glass-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          type="submit"
          disabled={sending || !inputMessage.trim()}
          aria-label="Envoyer le message"
          className="btn btn-primary flex-shrink-0"
          style={{ height: 44, padding: '0 18px' }}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
