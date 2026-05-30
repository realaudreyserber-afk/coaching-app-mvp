"use client";

/**
 * Widget coach flottant — ORACLE.IA accessible depuis toutes les pages (sauf Ops,
 * onboarding, séance live, et les pages coach elles-mêmes ; masquage géré par le
 * layout). Consomme le MÊME backend que la page coach (/api/ai/coach, SSE) et
 * applique les balises (COACH_ACTION côté serveur ; COACH_SAVE / COACH_PLAN_PATCH
 * côté client) pour que le coach AGISSE vraiment — pas seulement dans le widget.
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/firebase/hooks';
import { MarkdownLight } from '@/components/coach/markdown-light';
import { stripCoachTags, applyCoachSave, applyCoachPlanPatch } from '@/lib/features/coach-client/tags';

interface Msg { role: 'user' | 'assistant'; content: string; }

const GREETING =
  "Salut, c'est ORACLE.IA. Pose ta question, ou dicte une donnée (« je pèse 88 kg », « tour de taille 84 », « j'ai bu 1,5 L ») et je l'enregistre.";

export function CoachWidget() {
  const { user, getFreshToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!user) return null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    const history = [...messages, { role: 'user' as const, content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setSending(true);
    try {
      const token = await getFreshToken();
      if (!token) throw new Error('auth');
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body || !(res.headers.get('content-type') || '').includes('text/event-stream')) {
        throw new Error('Coach indisponible');
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buffer = '';
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const evt of events) {
          if (!evt.trim()) continue;
          const lines = evt.split('\n');
          const et = lines.find((l) => l.startsWith('event: '))?.slice(7).trim() ?? 'message';
          const dl = lines.find((l) => l.startsWith('data: '));
          if (!dl) continue;
          try {
            if (et === 'chunk') {
              acc += JSON.parse(dl.slice(6)).text;
              const visible = stripCoachTags(acc);
              setMessages((prev) => {
                const c = [...prev];
                const last = c[c.length - 1];
                if (last?.role === 'assistant') c[c.length - 1] = { ...last, content: visible };
                return c;
              });
            } else if (et === 'error') {
              throw new Error(JSON.parse(dl.slice(6)).error || 'Erreur');
            }
          } catch { /* parse partiel */ }
        }
      }
      await applyCoachSave(acc, getFreshToken);
      await applyCoachPlanPatch(acc, getFreshToken);
    } catch {
      setMessages((prev) => {
        const c = [...prev];
        const last = c[c.length - 1];
        if (last?.role === 'assistant' && !last.content) c[c.length - 1] = { ...last, content: 'Bug de connexion, réessaie.' };
        return c;
      });
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le coach ORACLE.IA"
        className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full bg-amber-500 text-zinc-950 shadow-xl shadow-amber-500/30 flex items-center justify-center hover:bg-amber-400 transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 26 }}>forum</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] h-[480px] max-h-[70vh] flex flex-col rounded-2xl border border-amber-500/30 bg-zinc-950/95 backdrop-blur-md shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" />
          <span className="text-sm font-bold tracking-wider text-amber-400 font-mono">ORACLE.IA</span>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-zinc-400 hover:text-zinc-100">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-amber-500/15 border border-amber-500/25 px-3 py-2 text-sm text-zinc-100'
                  : 'max-w-[90%] rounded-2xl rounded-bl-sm bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200'
              }
            >
              {m.role === 'assistant'
                ? (m.content ? <MarkdownLight text={m.content} /> : <span className="text-zinc-500">…</span>)
                : m.content}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="flex items-center gap-2 p-2 border-t border-zinc-800 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Écris au coach…"
          className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Envoyer"
          className="h-9 w-9 shrink-0 rounded-lg bg-amber-500 text-zinc-950 flex items-center justify-center disabled:opacity-40 hover:bg-amber-400 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{sending ? 'hourglass_empty' : 'send'}</span>
        </button>
      </form>
    </div>
  );
}
