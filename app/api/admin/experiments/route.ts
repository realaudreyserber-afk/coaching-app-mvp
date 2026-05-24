import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireAdmin } from '@/lib/firebase/auth-middleware';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

interface ExperimentDoc {
  id: string;
  description: string;
  variants: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (authReq, user) => {
    const forbidden = await requireAdmin(authReq, user);
    if (forbidden) return forbidden;

    try {
      const snap = await adminDb.collection('experiments').get();
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return NextResponse.json({ experiments: items });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: 'Impossible de charger les expériences.', details: errMsg },
        { status: 500 }
      );
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (authReq, user) => {
    const forbidden = await requireAdmin(authReq, user);
    if (forbidden) return forbidden;

    try {
      const body = (await req.json()) as Partial<ExperimentDoc>;
      const { id, description, variants, active } = body;
      if (!id || typeof id !== 'string') {
        return NextResponse.json({ error: 'id requis.' }, { status: 400 });
      }
      if (!Array.isArray(variants) || variants.length < 2) {
        return NextResponse.json(
          { error: 'variants[] doit contenir au moins 2 entrées.' },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const existing = await adminDb.collection('experiments').doc(id).get();
      const payload = {
        description: description ?? '',
        variants,
        active: active !== false,
        updated_at: now,
        ...(existing.exists ? {} : { created_at: now }),
      };

      await adminDb.collection('experiments').doc(id).set(payload, { merge: true });
      return NextResponse.json({ success: true, id });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Impossible de sauvegarder l'expérience.", details: errMsg },
        { status: 500 }
      );
    }
  });
}
