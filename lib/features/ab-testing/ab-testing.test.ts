import { describe, it, expect } from 'vitest';
import { hashString, getUserVariantIndex } from './framework';

describe('A/B Testing Framework Deterministic Segmentation', () => {
  it('should hash strings consistently', () => {
    const string1 = "user123:price_experiment";
    const hash1 = hashString(string1);
    const hash2 = hashString(string1);

    expect(hash1).toBe(hash2);
    expect(hash1).toBeGreaterThan(0);
  });

  it('should assign users deterministically to experimental groups', () => {
    const uid1 = "user-abc-111";
    const uid2 = "user-xyz-222";
    const expId = "pricing_experiment_v1";

    const v1 = getUserVariantIndex(uid1, expId, 2);
    const v2 = getUserVariantIndex(uid1, expId, 2);
    expect(v1).toBe(v2); // Stable for same user

    const otherExp1 = getUserVariantIndex(uid1, "other_exp", 2);
    expect(otherExp1).toBeLessThan(2);
    // Might differ for different experiments for same user
    const otherUserVal = getUserVariantIndex(uid2, expId, 2);

    expect(v1).toBeLessThan(2);
    expect(otherUserVal).toBeLessThan(2);
  });
});
