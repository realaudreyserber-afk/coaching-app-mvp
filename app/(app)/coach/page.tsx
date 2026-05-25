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
  // Closed tag → remove the whole block, including the markers.
  let out = content.replace(/<COACH_SAVE>[\s\S]*?<\/COACH_SAVE>/g, '');
  // Unclosed opening tag still streaming → hide from there to end.
  const openIdx = out.indexOf('<COACH_SAVE>');
  if (openIdx !== -1) out = out.slice(0, openIdx);
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

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Load last 10 messages from user's chat history in Firestore if available
  useEffect(() => {
    if (loading || !user) return;

    const loadChatHistory = async () => {
      try {
        const chatRef = collection(db, 'users', user.uid, 'coach_messages');
        const q = query(chatRef, orderBy('timestamp', 'asc'), limit(30));
        const snap = await getDocs(q);

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
          setMessages(loadedHistory);
        }
      } catch (err) {
        console.error('Error loading chat history:', err);
      }
    };

    loadChatHistory();
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

      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ messages: chatContext })
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

      // Backend now persists assistant message via streaming placeholder.
      // No client-side write needed.

    } catch (err: any) {
      console.error('Chat error:', err);
      const msg = (err instanceof Error && err.message) ? err.message : "Bug de connexion. Réessaye dans un instant.";
      setError(msg);
      setMessages(prev => prev.slice(0, -1));
      setInputMessage(userText);
    } finally {
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
    <div className="flex-1 flex flex-col bg-zinc-950 max-w-3xl mx-auto w-full h-[calc(100vh-4rem)] relative pb-20">

      {/* Header */}
      <div className="flex items-center space-x-3 p-4 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-md sticky top-0 z-30">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard')}
          aria-label="Retour au tableau de bord"
          className="h-11 w-11 text-zinc-100 hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-serif font-bold text-zinc-50">Coach NoDream</h1>
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold flex items-center">
            <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" aria-hidden="true" />
            <span><span className="sr-only">Statut : </span>En ligne</span>
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
            className="flex items-center space-x-2 text-zinc-600 mr-auto bg-white border border-zinc-200 p-3 rounded-2xl rounded-tl-none max-w-[85%] shadow-lg"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" aria-hidden="true" />
            <span className="text-xs font-serif italic">NoDream réfléchit...</span>
          </div>
        )}

        {error && (
          <div
            className="text-xs text-red-300 bg-red-950/40 border border-red-900 p-3 rounded-xl text-center max-w-[85%] mx-auto"
            role="alert"
          >
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <form
        onSubmit={handleSendMessage}
        className="absolute bottom-0 left-0 right-0 p-4 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 flex items-center space-x-2 z-30"
        aria-label="Envoyer un message au coach"
      >
        <label htmlFor="coach-message-input" className="sr-only">
          Message à envoyer au coach
        </label>
        <input
          id="coach-message-input"
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Pose ta question (ex: pates crues vs cuites ?)"
          disabled={sending}
          className="flex-1 h-11 px-4 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !inputMessage.trim()}
          aria-label="Envoyer le message"
          className="h-11 w-11 rounded-full flex-shrink-0"
        >
          <Send className="h-4.5 w-4.5" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
