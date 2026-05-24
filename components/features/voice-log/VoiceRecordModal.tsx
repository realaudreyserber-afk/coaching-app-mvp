/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { logFood } from '@/lib/features/food-logs/client';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, Square, X, Loader2, Check, AlertCircle, Scale, Trash2, Plus } from 'lucide-react';

interface VoiceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceRecordModal({ isOpen, onClose }: VoiceRecordModalProps) {
  const { user, getFreshToken } = useAuth();
  
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'success' | 'error'>('idle');
  const [recordTime, setRecordTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [detectedItems, setDetectedItems] = useState<any[]>([]);
  const [quantityOverrides, setQuantityOverrides] = useState<Record<number, number>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingLogs, setSavingLogs] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    audioChunksRef.current = [];
    setRecordTime(0);
    setErrorMsg(null);
    setAudioBlob(null);
    setDetectedItems([]);
    setQuantityOverrides({});

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop()); // close microphone stream
        processAudio(blob);
      };

      recorder.start();
      setStatus('recording');

      // Start recording timer
      timerRef.current = setInterval(() => {
        setRecordTime((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone access failed:', err);
      setStatus('error');
      setErrorMsg('Impossible d\'accéder au micro. Vérifie tes permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const processAudio = async (blob: Blob) => {
    setStatus('processing');
    
    try {
      const token = await getFreshToken();
      if (!token) {
        throw new Error('Authentification requise');
      }

      const formData = new FormData();
      formData.append('audio', blob, 'voice.webm');

      const res = await fetch('/api/nutrition/voice-recognize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erreur lors du décodage vocal.');
      }

      const data = await res.json();
      setDetectedItems(data.analysis.items);
      setStatus('success');
    } catch (err: any) {
      console.error('Voice processing error:', err);
      setStatus('error');
      setErrorMsg(err.message || 'Impossible d\'analyser ton enregistrement.');
    }
  };

  const handleQuantityChange = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    setQuantityOverrides(prev => ({
      ...prev,
      [index]: newQty
    }));
  };

  const handleDeleteItem = (index: number) => {
    setDetectedItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveLogs = async () => {
    if (!user || detectedItems.length === 0) return;
    setSavingLogs(true);

    try {
      await logFood(user, {
        source: 'voice',
        items: detectedItems.map((item, idx) => {
          const finalQty =
            quantityOverrides[idx] !== undefined ? quantityOverrides[idx] : item.qty_estimated_g;
          const scale = finalQty / item.qty_estimated_g;
          return {
            name: item.name,
            brand: 'Commande vocale IA',
            qty_g: finalQty,
            kcal: Math.round(item.kcal * scale),
            p: Math.round(item.p * scale * 10) / 10,
            c: Math.round(item.c * scale * 10) / 10,
            f: Math.round(item.f * scale * 10) / 10,
          };
        }),
      });
      onClose();
    } catch (err) {
      console.error('Save logs error:', err);
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : "Impossible d'enregistrer les aliments.");
    } finally {
      setSavingLogs(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-sm border-border bg-white dark:bg-anthracite shadow-2xl relative animate-[fadeIn_0.2s_ease-out]">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <CardContent className="pt-8 pb-6 flex flex-col items-center space-y-6">
          <h3 className="font-serif font-bold text-lg text-center">Dictée vocale nutrition</h3>

          {status === 'idle' && (
            <div className="flex flex-col items-center space-y-4 py-4 text-center">
              <button 
                onClick={startRecording}
                className="h-16 w-16 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                <Mic className="h-7 w-7" />
              </button>
              <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
                Appuie sur le micro et décris ce que tu as consommé (ex : "j'ai mangé un yaourt grec de 150g avec 10g de miel").
              </p>
            </div>
          )}

          {status === 'recording' && (
            <div className="flex flex-col items-center space-y-4 py-4 text-center">
              <button 
                onClick={stopRecording}
                className="h-16 w-16 bg-orange-light text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all relative"
              >
                <Square className="h-6 w-6" />
                <span className="absolute inset-0 rounded-full border-4 border-orange-light animate-ping opacity-75" />
              </button>
              <div className="space-y-1">
                <div className="text-sm font-bold font-mono text-orange-light">00:{recordTime.toString().padStart(2, '0')}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold animate-pulse">Enregistrement en cours...</div>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="flex flex-col items-center space-y-4 py-8 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-serif">Analyse audio par Gemini Flash...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center space-y-4 py-4 text-center w-full">
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-xs text-red-600 dark:text-red-400 font-serif leading-relaxed px-4">{errorMsg}</p>
              <Button size="sm" onClick={() => setStatus('idle')} className="w-1/2">Réessayer</Button>
            </div>
          )}

          {status === 'success' && detectedItems.length > 0 && (
            <div className="w-full space-y-4 max-h-[300px] overflow-y-auto pr-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aliments identifiés</div>
              
              <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
                {detectedItems.map((item, idx) => {
                  const currentQty = quantityOverrides[idx] !== undefined ? quantityOverrides[idx] : item.qty_estimated_g;
                  const scale = currentQty / item.qty_estimated_g;
                  const finalKcal = Math.round(item.kcal * scale);

                  return (
                    <div key={idx} className="p-3 flex items-center justify-between space-x-3 text-xs">
                      <div className="flex-1 space-y-0.5">
                        <div className="font-semibold truncate max-w-[150px]">{item.name}</div>
                        <div className="text-muted-foreground">{finalKcal} kcal</div>
                      </div>
                      
                      {/* Quantity input */}
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="number"
                          value={currentQty}
                          onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                          className="w-12 h-7 text-center rounded border border-border bg-transparent focus:outline-none"
                        />
                        <span className="text-muted-foreground">g</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteItem(idx)}
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex space-x-2 pt-2">
                <Button variant="outline" onClick={() => setStatus('idle')} className="flex-1">Réécouter</Button>
                <Button onClick={handleSaveLogs} disabled={savingLogs} className="flex-1">
                  {savingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer'}
                </Button>
              </div>
            </div>
          )}

          {status === 'success' && detectedItems.length === 0 && (
            <div className="flex flex-col items-center space-y-4 py-4 text-center">
              <div className="h-12 w-12 rounded-full bg-orange-light/10 flex items-center justify-center text-orange-light">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed px-4">
                Aucun aliment n'a pu être identifié dans ton message. Essaye d'articuler un peu plus.
              </p>
              <Button size="sm" onClick={() => setStatus('idle')} className="w-1/2">Réessayer</Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
