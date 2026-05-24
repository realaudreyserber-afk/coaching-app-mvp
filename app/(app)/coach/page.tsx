/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Send, ArrowLeft, Loader2, BookOpen, ExternalLink } from 'lucide-react';
import { MarkdownLight } from '@/components/coach/markdown-light';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  timestamp?: string;
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
            loadedHistory.push({
              id: doc.id,
              role: data.role,
              content: data.content,
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
                  copy[copy.length - 1] = { ...last, content: accumulated };
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
      <div className="flex-1 flex items-center justify-center bg-cream px-4 dark:bg-anthracite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-cream dark:bg-anthracite max-w-md mx-auto w-full h-[calc(100vh-4rem)] relative pb-20">
      
      {/* Header */}
      <div className="flex items-center space-x-3 p-4 border-b border-border bg-white/80 dark:bg-anthracite/80 backdrop-blur-md sticky top-0 z-30">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-serif font-bold text-foreground">Coach NoDream</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center">
            <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
            En ligne
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          return (
            <div 
              key={idx} 
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1 max-w-[85%] ${isUser ? 'ml-auto' : 'mr-auto'}`}
            >
              <div 
                className={`p-3 rounded-2xl text-sm leading-relaxed ${
                  isUser 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-white dark:bg-black/20 text-foreground border border-border rounded-tl-none font-serif'
                }`}
              >
                {/* Markdown-light renderer: **bold**, *italic*, `code`, paragraphs, lists */}
                {isUser ? (
                  m.content.split('\n').map((para, i) => (
                    <p key={i} className={i > 0 ? 'mt-2' : ''}>
                      {para}
                    </p>
                  ))
                ) : (
                  <MarkdownLight text={m.content} />
                )}

                {/* Render Scientific Sources/Citations inside message card if present */}
                {!isUser && m.sources && m.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
                    <div className="flex items-center space-x-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Sources scientifiques ({m.sources.length})</span>
                    </div>
                    <div className="grid gap-1.5 pt-1">
                      {m.sources.map((src: any, sIdx: number) => (
                        <a
                          key={sIdx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2 rounded bg-cream/50 dark:bg-anthracite/50 border border-border hover:border-primary/30 transition-all text-xs text-foreground/95"
                        >
                          <div className="truncate pr-2 flex items-center gap-1.5">
                            {src.language && (
                              <span
                                className={`text-[9px] font-bold uppercase tracking-wider px-1 rounded ${
                                  src.language === 'fr'
                                    ? 'bg-primary/15 text-primary'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {src.language === 'fr' ? 'FR' : 'EN'}
                              </span>
                            )}
                            <span className="font-semibold text-primary">{src.authors} ({src.year})</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="italic truncate">{src.title}</span>
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex items-center space-x-2 text-muted-foreground mr-auto bg-white/50 dark:bg-black/10 border border-border p-3 rounded-2xl rounded-tl-none max-w-[85%]">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs font-serif italic">NoDream réfléchit...</span>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center max-w-[85%] mx-auto">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <form 
        onSubmit={handleSendMessage} 
        className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-anthracite/80 backdrop-blur-md border-t border-border flex items-center space-x-2 z-30"
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Pose ta question (ex: pates crues vs cuites ?)"
          disabled={sending}
          className="flex-1 h-11 px-4 rounded-full border border-border bg-white dark:bg-black/20 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
        />
        <Button 
          type="submit" 
          size="icon" 
          disabled={sending || !inputMessage.trim()} 
          className="h-11 w-11 rounded-full flex-shrink-0"
        >
          <Send className="h-4.5 w-4.5" />
        </Button>
      </form>
    </div>
  );
}
