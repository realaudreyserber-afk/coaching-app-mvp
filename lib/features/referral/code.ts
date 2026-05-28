/**
 * Générateur de code de parrainage — module pur (aucun import Firebase),
 * importable côté serveur (route /api/referral) ET en test.
 * Format : "INS" + 3 caractères alphanumériques → 6 chars.
 */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateReferralCode(): string {
  let result = 'INS';
  for (let i = 0; i < 3; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}
