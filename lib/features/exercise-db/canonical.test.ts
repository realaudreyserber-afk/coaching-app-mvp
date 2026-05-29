import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { matchFrExercise, canonicalSocle, CANONICAL_FR } from './canonical';

describe('match canonique FR -> exercice propre', () => {
  it('pompe -> push up (propre, pas incliné)', () => {
    const ex = matchFrExercise('pompe');
    expect(ex).not.toBeNull();
    expect(ex!.name.toLowerCase()).toContain('push up');
    expect(ex!.name.toLowerCase()).not.toContain('incline');
  });

  it('développé couché -> bench press (pas incliné/floor)', () => {
    const ex = matchFrExercise('développé couché');
    expect(ex!.name.toLowerCase()).toContain('bench press');
    expect(ex!.name.toLowerCase()).not.toContain('incline');
  });

  it('squat -> back squat, JAMAIS variante haltéro/jump/front', () => {
    const ex = matchFrExercise('squat');
    const n = ex!.name.toLowerCase();
    expect(n).toContain('squat');
    expect(n).not.toMatch(/jerk|clean|snatch|jump|front|pistol|sumo/);
  });

  it('"squat gobelet" -> goblet (alias le plus spécifique gagne)', () => {
    expect(matchFrExercise('squat gobelet')!.name.toLowerCase()).toContain('goblet');
  });

  it('soulevé de terre -> conventional deadlift (pas roumain/suitcase)', () => {
    const ex = matchFrExercise('soulevé de terre');
    expect(ex!.name.toLowerCase()).toContain('deadlift');
    expect(ex!.name.toLowerCase()).not.toContain('romanian');
  });

  it('tractions -> pull up ; dips -> dips', () => {
    expect(matchFrExercise('tractions')!.name.toLowerCase()).toContain('pull up');
    expect(matchFrExercise('dips')!.name.toLowerCase()).toContain('dip');
  });

  it('gaps machines -> fallback hand-authored', () => {
    expect(matchFrExercise('front squat')!.name_fr.toLowerCase()).toContain('front squat');
    expect(matchFrExercise('leg press')!.equipment).toBe('machine');
    expect(matchFrExercise('leg curl')!.muscle).toBe('ischio_jambiers');
    expect(matchFrExercise('leg extension')!.equipment).toBe('machine');
  });

  it('socle complet : chaque entrée canonique résout (DB ou fallback)', () => {
    expect(canonicalSocle().length).toBe(CANONICAL_FR.length);
  });

  it('requête inconnue -> null', () => {
    expect(matchFrExercise('xyzzy truc inexistant')).toBeNull();
  });
});
