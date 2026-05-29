import { describe, it, expect } from 'vitest';
import {
  buildProfileForRag,
  levelFromProfile,
  equipmentFromProfile,
} from './context';
import type { NormalizedProfile } from '@/lib/features/user-profile/snapshot';

// Profil minimal — buildProfileForRag ne lit que training_level / equipment /
// training_environment ; le reste peut rester vide.
const base = {} as NormalizedProfile;

describe('buildProfileForRag — mapping NormalizedProfile -> ProfileForRag (anti-régression cast)', () => {
  it('mappe training_level -> training_history (et non level)', () => {
    const p = buildProfileForRag({ ...base, training_level: 'beginner' });
    expect(p.training_history).toBe('beginner');
    // Le bug historique : { level } => training_history undefined => 'intermediaire'.
    expect(levelFromProfile(p)).toBe('debutant');
  });

  it('mappe le niveau avancé', () => {
    const p = buildProfileForRag({ ...base, training_level: 'advanced' });
    expect(levelFromProfile(p)).toBe('avance');
  });

  it('niveau inconnu/absent -> intermediaire (fallback)', () => {
    expect(levelFromProfile(buildProfileForRag(base))).toBe('intermediaire');
  });

  it('mappe equipment -> available_equipment (liste custom prioritaire)', () => {
    const p = buildProfileForRag({ ...base, equipment: ['barre', 'halteres'] });
    expect(p.available_equipment).toEqual(['barre', 'halteres']);
    expect(equipmentFromProfile(p)).toEqual(['barre', 'halteres']);
  });

  it('sans équipement custom, filtre par training_environment (home_bodyweight)', () => {
    const p = buildProfileForRag({
      ...base,
      equipment: null,
      training_environment: 'home_bodyweight',
    });
    expect(p.training_environment).toBe('home_bodyweight');
    const eq = equipmentFromProfile(p);
    expect(eq).toBeDefined();
    expect(eq).toContain('elastique'); // présent dans le set home_bodyweight
    expect(eq).not.toContain('rack'); // absent du set home_bodyweight
  });

  it('environnement gym -> aucun filtre équipement (undefined)', () => {
    const p = buildProfileForRag({ ...base, equipment: null, training_environment: 'gym' });
    expect(equipmentFromProfile(p)).toBeUndefined();
  });
});
