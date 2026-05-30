import { describe, it, expect } from 'vitest';
import { weeklyToMeasurementFields, mergeUnifiedEntries, type MeasurementEntry } from './schema';

describe('measurements / weeklyToMeasurementFields', () => {
  it('mappe neck/waist/hips et moyenne les G/D (arm, thigh)', () => {
    const out = weeklyToMeasurementFields({ neck: 38, waist: 96, hips: 100, arm_l: 35, arm_r: 36, thigh_l: 58, thigh_r: 60 });
    expect(out).toEqual({ neck_cm: 38, waist_cm: 96, hips_cm: 100, arm_cm: 35.5, thigh_cm: 59 });
  });

  it('ignore les 0 (champ non renseigné) — moyenne sur les côtés présents', () => {
    const out = weeklyToMeasurementFields({ neck: 0, waist: 96, hips: 0, arm_l: 40, arm_r: 0, thigh_l: 0, thigh_r: 0 });
    // arm : seul arm_l présent -> 40 ; thigh : aucun -> absent ; neck/hips : 0 -> absents
    expect(out).toEqual({ waist_cm: 96, arm_cm: 40 });
  });

  it('arrondit la moyenne à 0,1 cm', () => {
    const out = weeklyToMeasurementFields({ arm_l: 35, arm_r: 36.4 });
    expect(out.arm_cm).toBe(35.7); // (35 + 36.4) / 2 = 35.7
  });

  it('entrée vide / nulle -> objet vide', () => {
    expect(weeklyToMeasurementFields(undefined)).toEqual({});
    expect(weeklyToMeasurementFields(null)).toEqual({});
    expect(weeklyToMeasurementFields({})).toEqual({});
  });
});

describe('measurements / mergeUnifiedEntries', () => {
  const canonical: MeasurementEntry[] = [{ date: '2026-05-01', source: 'coach', waist_cm: 90 }];

  it('fusionne A ∪ hebdo ∪ baseline, trié par date croissante', () => {
    const out = mergeUnifiedEntries(
      canonical,
      [{ date: '2026-04-01', fields: { waist_cm: 95, neck_cm: 38 } }],
      { date: '2026-03-01', fields: { waist_cm: 100 } },
    );
    expect(out.map((e) => e.date)).toEqual(['2026-03-01', '2026-04-01', '2026-05-01']);
    expect(out[0].waist_cm).toBe(100);
    expect(out[1]).toMatchObject({ waist_cm: 95, neck_cm: 38 });
    expect(out[2].waist_cm).toBe(90);
  });

  it('la valeur canonique (A) GAGNE, l\'hebdo ne complète que les champs manquants', () => {
    const out = mergeUnifiedEntries(
      [{ date: '2026-04-01', source: 'coach', waist_cm: 90 }],
      [{ date: '2026-04-01', fields: { waist_cm: 95, neck_cm: 38 } }],
    );
    expect(out).toHaveLength(1);
    expect(out[0].waist_cm).toBe(90); // A gagne, pas écrasé par l'hebdo (95)
    expect(out[0].neck_cm).toBe(38); // champ manquant en A -> complété par l'hebdo
  });

  it('sans canonique : la série provient entièrement de l\'hebdo/baseline', () => {
    const out = mergeUnifiedEntries([], [{ date: '2026-04-01', fields: { waist_cm: 95 } }]);
    expect(out).toEqual([{ date: '2026-04-01', source: 'self', waist_cm: 95 }]);
  });
});
