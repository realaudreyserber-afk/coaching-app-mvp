import { describe, it, expect } from 'vitest';
import { generateReferralCode } from './referral-service';

describe('Referral Service Code Generator', () => {
  it('should generate valid 6-character codes with INS prefix', () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(6);
    expect(code.startsWith('INS')).toBe(true);
  });

  it('should generate unique codes on successive calls', () => {
    const codes = new Set();
    for (let i = 0; i < 50; i++) {
      codes.add(generateReferralCode());
    }
    // Should have generated 50 unique codes (very low collision probability for 3 random alphanumeric chars in small loops)
    expect(codes.size).toBe(50);
  });
});
