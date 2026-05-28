/**
 * M17 — Referral service (client wrappers).
 *
 * Audit 2026-05-28 #2 : toute la logique d'écriture est passée côté serveur
 * (/api/referral) — voir le commentaire de la route. Ce module n'est plus
 * qu'un client HTTP fin : aucune écriture Firestore directe, aucune
 * énumération de codes côté client, aucun self-grant possible.
 *
 * Schema (snake_case, ADR-006) géré serveur :
 *   users/{uid}.referral = { code, referred_by?, referred_users[], premium_credits, updated_at }
 */

export interface ReferralData {
  code: string;
  referred_count: number;
  premium_credits: number;
  referred_by: string | null;
}

/**
 * Garantit qu'un code de parrainage existe pour l'utilisateur courant et
 * retourne ses statistiques. Idempotent (le serveur ne régénère pas un code
 * existant).
 */
export async function ensureReferralData(token: string): Promise<ReferralData> {
  const res = await fetch('/api/referral', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Impossible de charger le parrainage.');
  }
  return (await res.json()) as ReferralData;
}

/**
 * Applique un code de parrain. Le serveur valide (pas de self-parrainage, pas
 * de double parrainage) et crédite atomiquement les deux comptes.
 */
export async function applyReferralCode(
  token: string,
  code: string,
): Promise<{ success: boolean; referrer_name: string }> {
  const res = await fetch('/api/referral', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Impossible de valider ce code de parrainage.');
  }
  return data as { success: boolean; referrer_name: string };
}
