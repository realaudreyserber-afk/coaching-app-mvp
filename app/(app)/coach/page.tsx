/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs, addDoc, doc, getDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Send, Search, Pin, Download, X } from 'lucide-react';
import { ChatBubble } from '@/components/coach/chat-bubble';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  timestamp?: string;
  feedback?: 'up' | 'down' | null;
  /** Audit COACH 2026-05-28 #17 : épinglage messages clés */
  pinned?: boolean;
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
      id: '__initial_greeting__',
      role: 'assistant',
      content: "Salut. Je suis NoDream, ton coach IA. Pose-moi tes questions sur ta nutrition, ton entraînement ou ta récupération. Pas de promesse facile, pas de blabla — on va droit au but. Qu'est-ce qui te bloque aujourd'hui ?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audit COACH 2026-05-28 — #16 recherche, #17 pinning, #19 export RGPD
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyPinned, setShowOnlyPinned] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Client context states for personalized suggestions
  const [profileData, setProfileData] = useState<any>(null);
  const [weeksInCut, setWeeksInCut] = useState<number>(0);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);

  // Disclaimer Modal states
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [showContextualWarning, setShowContextualWarning] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const STREAM_TIMEOUT_MS = 90_000;
  const lastScrollAtRef = useRef(0);

  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (sending) {
      const now = Date.now();
      if (now - lastScrollAtRef.current > 160) {
        lastScrollAtRef.current = now;
        scrollToBottom('auto');
      }
    } else {
      scrollToBottom('smooth');
    }
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Check disclaimer acceptance
  useEffect(() => {
    const accepted = localStorage.getItem('coach_disclaimer_accepted') === 'true';
    if (!accepted) {
      setShowDisclaimerModal(true);
    }
  }, []);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('coach_disclaimer_accepted', 'true');
    setShowDisclaimerModal(false);
  };

  // Real-time Medical Disclaimer check
  useEffect(() => {
    const medicalRegex = /\b(trt|glp1|glp-1|bloodwork|bilan\s+sanguin|médicament|traitement|prescription|hormon|testostérone|insuline|médical)\b/i;
    if (medicalRegex.test(inputMessage)) {
      setShowContextualWarning(true);
    } else {
      setShowContextualWarning(false);
    }
  }, [inputMessage]);

  // Fetch client profile and settings for dynamic suggestions
  useEffect(() => {
    if (loading || !user) return;
    const fetchContext = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          setProfileData(uData);

          // Fetch active plan to calculate weeks in cut
          const plansSnap = await getDocs(
            query(
              collection(db, 'users', user.uid, 'plans'),
              where('active', '==', true),
              limit(1)
            )
          );
          if (!plansSnap.empty) {
            const plan = plansSnap.docs[0].data();
            if (plan?.date_start) {
              const diffMs = Date.now() - new Date(plan.date_start).getTime();
              const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
              setWeeksInCut(weeks);
            }
          }
        }

        // Fetch menstrual cycle settings & cycles
        const settingsSnap = await getDoc(doc(db, 'users', user.uid, 'cycle_settings', 'main'));
        if (settingsSnap.exists()) {
          const settings = settingsSnap.data();
          const cyclesSnap = await getDocs(
            query(
              collection(db, 'users', user.uid, 'cycles'),
              orderBy('date', 'desc'),
              limit(60)
            )
          );
          if (!cyclesSnap.empty) {
            const entries = cyclesSnap.docs.map(d => d.data());
            const sorted = entries.sort((a: any, b: any) => (a.date < b.date ? -1 : 1));
            let lastPeriodStart: string | null = null;
            let inSeq = false;
            for (const e of sorted) {
              if (e.flow_intensity > 0) {
                if (!inSeq) {
                  lastPeriodStart = e.date;
                  inSeq = true;
                }
              } else {
                inSeq = false;
              }
            }

            if (lastPeriodStart) {
              const todayIso = new Date().toISOString().slice(0, 10);
              const avgCycle = settings.avg_cycle_length_days ?? 28;
              const avgPeriod = settings.avg_period_length_days ?? 5;
              const dayDiff = Math.floor(
                (new Date(todayIso).getTime() - new Date(lastPeriodStart).getTime()) /
                  (24 * 60 * 60 * 1000)
              );
              const dayInCycle = dayDiff % avgCycle;
              
              let computedPhase: string = 'follicular';
              if (dayInCycle < avgPeriod) {
                computedPhase = 'menstrual';
              } else if (dayInCycle >= avgCycle - 14) {
                computedPhase = 'luteal';
              } else if (dayInCycle >= 11 && dayInCycle <= 15) {
                computedPhase = 'ovulatory';
              }
              setCurrentPhase(computedPhase);
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching client context for suggestions:', err);
      }
    };
    fetchContext();
  }, [user, loading]);

  // Dynamic context-aware suggestions
  const suggestions = useMemo(() => {
    const list: string[] = [];
    const goalType = profileData?.goals?.type;
    const trainingHistory = profileData?.profile?.training_history;

    if (goalType === 'lose_weight' && weeksInCut > 8) {
      list.push("Comment sortir de cut ?");
    }
    if (trainingHistory === 'beginner') {
      list.push("Comment savoir si je fais bien mon squat ?");
    }
    if (currentPhase === 'luteal') {
      list.push("Pourquoi j'ai si faim aujourd'hui ?");
    }

    if (list.length < 3) {
      const fallbacks = [
        "Quelle quantité de protéines dois-je viser ?",
        "Comment optimiser ma récupération ?",
        "Comment gérer ma fatigue aujourd'hui ?",
        "Que manger avant ma séance ?"
      ];
      for (const fallback of fallbacks) {
        if (!list.includes(fallback) && list.length < 3) {
          list.push(fallback);
        }
      }
    }
    return list;
  }, [profileData, weeksInCut, currentPhase]);

  // Mark proactive interventions as read
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

  // Load chat history
  useEffect(() => {
    if (loading || !user) return;

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
              timestamp: data.timestamp,
              feedback: data.feedback ?? null,
            });
          });
          setMessages((prev) => {
            if (loadedHistory.length === 0) return prev;
            const lastLoadedTs = loadedHistory[loadedHistory.length - 1].timestamp ?? '';
            const newer = prev.filter(
              (m) =>
                m.id !== '__initial_greeting__' &&
                (m.timestamp ?? '') > lastLoadedTs,
            );
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

    const userMsg: ChatMessage = {
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);

    let watchdog: ReturnType<typeof setTimeout> | undefined;

    try {
      // Save user message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'coach_messages'), {
        role: 'user',
        content: userText,
        timestamp: userMsg.timestamp
      });

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
        } catch {}
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

      // Stream complete: parse tags
      await persistCoachSaveBlock(accumulated, getFreshToken).catch((err) =>
        console.warn('[coach-save] persist failed:', err),
      );
      await persistCoachPlanPatchBlock(accumulated, getFreshToken).catch((err) =>
        console.warn('[coach-plan-patch] persist failed:', err),
      );

    } catch (err: any) {
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
      if (watchdog) clearTimeout(watchdog);
      setSending(false);
    }
  };

  // Submit Feedback thumbs-up/down
  const handleFeedback = async (messageId: string, type: 'up' | 'down') => {
    if (!user || !messageId) return;
    try {
      const { updateDoc, runTransaction } = await import('firebase/firestore');
      const msgRef = doc(db, 'users', user.uid, 'coach_messages', messageId);
      
      // Update message feedback field
      await updateDoc(msgRef, { feedback: type });

      // Aggregate in coach_state global stats
      const stateRef = doc(db, 'users', user.uid, 'coach_state', 'main');
      await runTransaction(db, async (transaction) => {
        const stateSnap = await transaction.get(stateRef);
        const stateData = stateSnap.data() || {};
        const currentStats = stateData.feedback_stats || { up: 0, down: 0 };
        const newStats = {
          up: currentStats.up + (type === 'up' ? 1 : 0),
          down: currentStats.down + (type === 'down' ? 1 : 0),
        };
        transaction.set(stateRef, { feedback_stats: newStats }, { merge: true });
      });

      // Update local UI state
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback: type } : m));
    } catch (err) {
      console.error('Error saving feedback:', err);
    }
  };

  // Audit COACH #17 : toggle épinglage d'un message
  const handleTogglePin = async (messageId: string, currentlyPinned: boolean) => {
    if (!user || !messageId || messageId === '__initial_greeting__') return;
    const newPinned = !currentlyPinned;
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', user.uid, 'coach_messages', messageId), {
        pinned: newPinned,
      });
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pinned: newPinned } : m));
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  // Audit COACH #19 : export RGPD de la conversation en cours (markdown)
  const handleExportConversation = () => {
    setExporting(true);
    try {
      const lines: string[] = [
        `# Conversation Coach NoDream`,
        `Export du ${new Date().toLocaleString('fr-FR')}`,
        ``,
        `---`,
        ``,
      ];
      messages.forEach((m) => {
        const ts = m.timestamp ? new Date(m.timestamp).toLocaleString('fr-FR') : '';
        const role = m.role === 'user' ? '👤 Toi' : '🤖 ORACLE.IA';
        lines.push(`## ${role}${ts ? ` — ${ts}` : ''}${m.pinned ? ' 📌' : ''}`);
        lines.push('');
        lines.push(m.content);
        lines.push('');
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `coach-nodream-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      setError("Échec de l'export. Réessaie.");
    } finally {
      setExporting(false);
    }
  };

  // Audit COACH #16 + #17 : filtres affichés
  const filteredMessages = React.useMemo(() => {
    let filtered = messages;
    if (showOnlyPinned) {
      filtered = filtered.filter(m => m.pinned === true);
    }
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(m => m.content.toLowerCase().includes(q));
    }
    return filtered;
  }, [messages, showOnlyPinned, searchQuery]);

  // Archive and trigger a New Session
  const handleNewSession = async () => {
    if (!user || sending) return;
    const confirm = window.confirm("Commencer une nouvelle session ? Vos messages actuels seront archivés.");
    if (!confirm) return;

    setSending(true);
    try {
      const sessionId = 'session_' + Math.random().toString(36).substring(2, 15);
      const chatRef = collection(db, 'users', user.uid, 'coach_messages');
      const snap = await getDocs(chatRef);

      if (!snap.empty) {
        const { writeBatch } = await import('firebase/firestore');
        const batch = writeBatch(db);

        snap.forEach((chatDoc) => {
          const backupDocRef = doc(db, 'users', user.uid, 'agent_memory_backup', sessionId, 'messages', chatDoc.id);
          batch.set(backupDocRef, chatDoc.data());
          batch.delete(chatDoc.ref);
        });

        await batch.commit();
      }

      setMessages([
        {
          id: '__initial_greeting__',
          role: 'assistant',
          content: "Salut. Je suis NoDream, ton coach IA. Pose-moi tes questions sur ta nutrition, ton entraînement ou ta récupération. Pas de promesse facile, pas de blabla — on va droit au but. Qu'est-ce qui te bloque aujourd'hui ?",
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (err) {
      console.error('Error starting new session:', err);
      setError('Impossible de démarrer une nouvelle session.');
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
    <div
      className="flex-1 flex flex-col max-w-3xl mx-auto w-full h-[calc(100dvh-4rem)] relative pb-[136px]"
      style={{ background: 'transparent' }}
    >
      {/* Disclaimer Modal */}
      {showDisclaimerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md px-4">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-6 rounded-lg shadow-2xl relative overflow-hidden"
               style={{
                 clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)'
               }}>
            <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
            <h2 className="text-xl font-bold text-amber-500 mb-3 uppercase tracking-wide">
              Avertissement Médical Important
            </h2>
            <div className="text-zinc-300 text-sm space-y-3 leading-relaxed mb-6">
              <p>
                NoDream OS et son module d'accompagnement <strong>ORACLE.IA</strong> fournissent des conseils d'entraînement et de nutrition à but de bien-être uniquement.
              </p>
              <p className="text-amber-400 font-semibold">
                Nous ne sommes pas des professionnels de santé. Ce service n'est pas destiné à diagnostiquer, traiter ou remplacer un avis médical.
              </p>
              <p>
                En particulier, tout sujet concernant les traitements médicamenteux (ex: GLP-1) ou hormonaux (ex: TRT) doit faire l'objet d'une consultation et d'un suivi régulier auprès de votre médecin spécialiste ou d'un endocrinologue agréé.
              </p>
            </div>
            <Button
              onClick={handleAcceptDisclaimer}
              className="w-full bg-primary hover:bg-primary/95 text-zinc-950 font-bold"
            >
              J'ai compris
            </Button>
          </div>
        </div>
      )}

      {/* Tactical Header — ORACLE.IA terminal */}
      <div
        className="flex items-center justify-between p-4 sticky top-0 z-30"
        style={{
          background: 'rgba(6, 3, 15, 0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--gold-tint-15)',
        }}
      >
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
            aria-label="Retour au tableau de bord"
            className="h-11 w-11 text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div>
            <span
              className="mono flex items-center gap-1.5"
              style={{
                fontSize: 10,
                letterSpacing: '0.3em',
                color: 'var(--accent-tech)',
                opacity: 0.85,
              }}
            >
              [ORACLE.IA · TERMINAL-04]{' '}
              <span
                className="font-bold uppercase select-none inline-flex items-center gap-1"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.15em',
                  color: '#fca5a5',
                  background: 'rgba(220, 38, 38, 0.18)',
                  border: '1px solid rgba(220, 38, 38, 0.7)',
                  padding: '2px 6px',
                  marginLeft: 4,
                  clipPath:
                    'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                  boxShadow: '0 0 8px rgba(220, 38, 38, 0.35)',
                  textShadow: '0 0 4px rgba(252, 165, 165, 0.5)',
                }}
                title="Oracle.IA n'est pas un avis médical — consulte un professionnel de santé pour tout traitement"
                aria-label="Avertissement : Oracle.IA n'est pas un avis médical"
              >
                ⚠ NON MÉDICAL
              </span>
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

        {/* Toolbar Actions — Audit COACH 2026-05-28 : #16 search, #17 pin filter, #19 export */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowOnlyPinned(!showOnlyPinned)}
            className={`mono h-9 px-2.5 text-[10px] flex items-center gap-1.5 border ${
              showOnlyPinned
                ? 'border-amber-500 text-amber-400 bg-amber-950/20'
                : 'border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
            style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
            title={showOnlyPinned ? 'Tout afficher' : 'Filtrer épinglés uniquement'}
            aria-pressed={showOnlyPinned}
          >
            <Pin className="w-3 h-3" /> {showOnlyPinned ? 'Épinglés' : 'Filtre'}
          </button>

          <button
            type="button"
            onClick={handleExportConversation}
            disabled={exporting || messages.length === 0}
            className="mono h-9 px-2.5 text-[10px] flex items-center gap-1.5 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 disabled:opacity-50"
            style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
            title="Exporter la conversation (RGPD)"
          >
            <Download className="w-3 h-3" /> Export
          </button>

          {/* New Session Action */}
          <Button
            onClick={handleNewSession}
            disabled={sending}
            variant="outline"
            className="mono border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 text-[10px] h-9 px-3"
            style={{
              clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
            }}
          >
            Nouvelle session
          </Button>
        </div>
      </div>

      {/* Search bar — Audit COACH #16 : se déploie sous le header si query active */}
      <div className="px-4 py-2 border-b border-zinc-900/50 bg-zinc-950/60">
        <div className="relative max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans la conversation…"
            className="mono w-full pl-8 pr-8 h-8 bg-zinc-900/70 border border-zinc-800 text-zinc-300 placeholder-zinc-600 text-[11px] focus:outline-none focus:border-zinc-700"
            style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
            aria-label="Rechercher dans la conversation"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              aria-label="Effacer la recherche"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 pb-28"
        role="log"
        aria-live="polite"
        aria-label="Conversation avec le coach"
      >
        {filteredMessages.length === 0 && (showOnlyPinned || searchQuery.trim().length >= 2) && (
          <div
            className="mono text-center text-zinc-500 py-8"
            style={{ fontSize: 11, letterSpacing: '0.1em' }}
          >
            {showOnlyPinned ? 'Aucun message épinglé.' : `Aucun message ne contient « ${searchQuery} ».`}
          </div>
        )}
        {filteredMessages.map((m, idx) => (
          <ChatBubble
            key={m.id || idx}
            id={m.id}
            role={m.role}
            content={m.content}
            sources={m.sources}
            timestamp={m.timestamp}
            feedback={m.feedback}
            onFeedback={handleFeedback}
            pinned={m.pinned}
            onTogglePin={handleTogglePin}
            searchQuery={searchQuery.trim().length >= 2 ? searchQuery.trim() : undefined}
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

      {/* Floating Actions Input Panel */}
      <div
        className="absolute bottom-0 left-0 right-0 p-3 z-30 flex flex-col gap-2"
        style={{
          background: 'rgba(6, 3, 15, 0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--gold-tint-15)',
        }}
      >
        {/* Contextual Medical Disclaimer */}
        {showContextualWarning && (
          <div
            className="p-3 bg-red-950/40 border border-red-900/60 text-red-400 text-[11px] rounded leading-relaxed flex items-start gap-2 animate-pulse"
            style={{
              clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
            }}
          >
            <span className="font-bold select-none text-red-500 shrink-0">[CADRE MÉDICAL]</span>
            <span>
              Tu mentionnes un traitement ou examen médical (TRT, GLP-1, bilan sanguin, etc.). Rappel : Oracle.IA ne remplace pas ton médecin spécialiste. Consulte un professionnel de santé pour tout traitement.
            </span>
          </div>
        )}

        {/* Dynamic Quick Suggestions */}
        {!sending && suggestions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none select-none">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInputMessage(sug)}
                className="mono text-[10px] px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors whitespace-nowrap"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {/* Input box — terminal prompt */}
        <form
          onSubmit={handleSendMessage}
          className="flex items-center space-x-2"
          aria-label="Envoyer un message au coach"
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
    </div>
  );
}
