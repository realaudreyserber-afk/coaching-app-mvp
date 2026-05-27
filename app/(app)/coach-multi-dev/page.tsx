'use client';

/**
 * Page dev pour tester /api/ai/coach-multi en bout-en-bout.
 *
 * Page ISOLÉE, ne touche pas le coach prod (app/(app)/coach/page.tsx).
 * Une fois le multi-agent validé, à intégrer dans le coach principal (Phase 4b).
 *
 * Affiche en temps réel :
 *   - route_decided : agents que le Supervisor a décidé de consulter
 *   - agent_start / agent_finish : chaque sous-agent en parallèle
 *   - aggregate_start : début de la synthèse
 *   - chunk : réponse finale unifiée
 *   - done : session_id + cost
 */

import { useState, useRef, FormEvent } from 'react';
import { useAuth } from '@/lib/firebase/hooks';

type PhaseLogEntry = {
  id: string;
  ts: number;
  event: string;
  data: Record<string, unknown>;
};

export default function CoachMultiDevPage() {
  const { user, getFreshToken, loading: authLoading } = useAuth();
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [phases, setPhases] = useState<PhaseLogEntry[]>([]);
  const [finalText, setFinalText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function appendPhase(event: string, data: Record<string, unknown>) {
    setPhases((prev) => [
      ...prev,
      { id: `${Date.now()}_${event}_${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), event, data },
    ]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user || running) return;

    setRunning(true);
    setPhases([]);
    setFinalText(null);
    setErrorText(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const token = await getFreshToken();
      const res = await fetch('/api/ai/coach-multi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: input.trim() }],
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        setErrorText(`HTTP ${res.status} — ${body}`);
        setRunning(false);
        return;
      }

      // Si reponse JSON (cas safety flagged), pas SSE
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json();
        if (data.safety?.flagged) {
          appendPhase('safety_flagged', data.safety);
          setFinalText(data.response);
        } else if (data.error) {
          setErrorText(data.error);
        } else {
          setFinalText(JSON.stringify(data));
        }
        setRunning(false);
        return;
      }

      // SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE blocks (séparés par \n\n)
        let sep = buffer.indexOf('\n\n');
        while (sep !== -1) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const eventLine = block.split('\n').find((l) => l.startsWith('event: '));
          const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
          if (eventLine && dataLine) {
            const event = eventLine.slice(7).trim();
            try {
              const data = JSON.parse(dataLine.slice(6));
              if (event === 'chunk' && typeof data.text === 'string') {
                setFinalText((prev) => (prev ?? '') + data.text);
              } else if (event === 'error') {
                setErrorText(data.message ?? 'Erreur inconnue');
              } else {
                appendPhase(event, data);
              }
            } catch {
              appendPhase(event, { raw: dataLine.slice(6) });
            }
          }
          sep = buffer.indexOf('\n\n');
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setErrorText(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setRunning(false);
  }

  if (authLoading) return <div className="p-6">Chargement auth…</div>;
  if (!user) return <div className="p-6">Connexion requise pour utiliser cette page de dev.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Coach Multi-Agent — Dev Test</h1>
        <p className="text-sm text-gray-500">
          Page de test isolée pour <code>/api/ai/coach-multi</code>. Le coach prod n'est pas affecté.
          Nécessite <code>ENABLE_COACH_MULTI=1</code> côté serveur.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex: J'ai stagné cette semaine malgré mon plan, qu'est-ce qui cloche ?"
          className="w-full min-h-[100px] rounded-md border border-gray-300 p-3 text-sm"
          disabled={running}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={running || !input.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {running ? 'Session en cours…' : 'Lancer la session'}
          </button>
          {running && (
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      {phases.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            Phases ({phases.length})
          </h2>
          <ul className="space-y-1 rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs">
            {phases.map((p) => (
              <li key={p.id} className="border-l-2 border-blue-400 pl-2">
                <span className="font-bold text-blue-700">{p.event}</span>{' '}
                <span className="text-gray-500">
                  {new Date(p.ts).toISOString().slice(11, 23)}
                </span>
                <pre className="mt-1 whitespace-pre-wrap text-gray-700">
                  {JSON.stringify(p.data, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        </section>
      )}

      {finalText !== null && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            Réponse coach unifiée
          </h2>
          <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm whitespace-pre-wrap">
            {finalText}
          </div>
        </section>
      )}

      {errorText && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-600">Erreur</h2>
          <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm whitespace-pre-wrap font-mono">
            {errorText}
          </div>
        </section>
      )}
    </div>
  );
}
