import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { adminDb } from '@/lib/firebase/admin';
import { flags } from '@/lib/features/flags';
import { getDailyTaskForUser } from '@/lib/features/micro-tasks/selector';
import type { ProfilePath } from '@/lib/features/profile-paths/schema';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!flags.microTasks()) {
    return NextResponse.json({ error: "Ce module n'est pas actif." }, { status: 403 });
  }

  return withAuth(req, async (_authReq, user) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const userSnap = await adminDb.collection('users').doc(user.uid).get();
      const profilePath = (userSnap.data()?.profile_path ?? 'standard') as ProfilePath;
      const task = getDailyTaskForUser(profilePath, today);

      const validationSnap = await adminDb
        .collection('users').doc(user.uid)
        .collection('daily_tasks').doc(today)
        .get();

      return NextResponse.json({
        task,
        date: today,
        completed: validationSnap.exists && validationSnap.data()?.completed === true,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: 'Impossible de récupérer la micro-tâche.', details: errMsg },
        { status: 500 }
      );
    }
  });
}

export async function POST(req: NextRequest) {
  if (!flags.microTasks()) {
    return NextResponse.json({ error: "Ce module n'est pas actif." }, { status: 403 });
  }

  return withAuth(req, async (_authReq, user) => {
    try {
      const { taskId, completed } = await req.json();
      if (typeof completed !== 'boolean' || !taskId) {
        return NextResponse.json(
          { error: 'taskId + completed (bool) requis.' },
          { status: 400 }
        );
      }

      const today = new Date().toISOString().split('T')[0];
      await adminDb
        .collection('users').doc(user.uid)
        .collection('daily_tasks').doc(today)
        .set({
          task_id: taskId,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        }, { merge: true });

      return NextResponse.json({ success: true, date: today, completed });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Impossible d'enregistrer la validation.", details: errMsg },
        { status: 500 }
      );
    }
  });
}
