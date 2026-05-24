"use client";

import { addDoc, collection } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase/client';
import { newFoodLog, type FoodLog, type FoodLogSource } from './schema';

export interface LogFoodInput {
  source: FoodLogSource;
  items: FoodLog['items'];
  meal_slot?: FoodLog['meal_slot'];
  notes?: string;
  storage_path?: string;
  date?: string; // defaults to today YYYY-MM-DD
}

export interface LogFoodResult {
  id: string;
  log: FoodLog;
}

function todayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Persist a food log entry under users/{uid}/food_logs.
 * Centralizes the canonical schema validation + totals computation
 * across M1 photo-meal, M2 barcode, M3 voice, M14 recipe OCR, M15 micronutrients.
 *
 * @throws if user not authenticated or schema validation fails (Zod)
 */
export async function logFood(user: User | null, input: LogFoodInput): Promise<LogFoodResult> {
  if (!user) {
    throw new Error('Utilisateur non authentifié.');
  }

  const log = newFoodLog({
    date: input.date ?? todayDateStr(),
    source: input.source,
    items: input.items,
    meal_slot: input.meal_slot,
    notes: input.notes,
    storage_path: input.storage_path,
  });

  const ref = await addDoc(collection(db, 'users', user.uid, 'food_logs'), log);
  return { id: ref.id, log };
}
