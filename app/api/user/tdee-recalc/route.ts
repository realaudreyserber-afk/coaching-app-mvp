import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { flags } from '@/lib/features/flags';
import { computeTDEE } from '@/lib/features/tdee-adaptive';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  // Check feature flag
  if (!flags.tdeeAdaptive()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const uid = user.uid;
      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return NextResponse.json(
          { error: 'Utilisateur non trouvé.' },
          { status: 404 }
        );
      }

      const userData = userSnap.data() || {};
      
      // Get target calories from current active plan or fallback
      let planCalories = 2000; // Default fallback
      const plansRef = userRef.collection('plans');
      const activePlansSnap = await plansRef.where('active', '==', true).limit(1).get();
      if (!activePlansSnap.empty) {
        const activePlan = activePlansSnap.docs[0].data();
        if (activePlan && activePlan.kcal) {
          planCalories = activePlan.kcal;
        }
      } else if (userData.goals && userData.goals.calories) {
        planCalories = userData.goals.calories;
      }

      // Calculate the date range for the last 14 days
      const today = new Date();
      const datesList: string[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        datesList.push(d.toISOString().split('T')[0]); // YYYY-MM-DD
      }

      const startDateStr = datesList[0];
      const endDateStr = datesList[13];

      // Fetch daily checkins in the range
      const checkinsSnap = await userRef.collection('checkins_daily')
        .where('created_at', '>=', `${startDateStr}T00:00:00.000Z`)
        .get();

      const checkinsByDate: Record<string, any> = {};
      checkinsSnap.forEach((doc) => {
        const dateStr = doc.id; // YYYY-MM-DD is the document ID
        checkinsByDate[dateStr] = doc.data();
      });

      // Fetch food logs in the range
      const foodLogsSnap = await userRef.collection('food_logs')
        .where('date', '>=', startDateStr)
        .where('date', '<=', endDateStr)
        .get();

      const foodCaloriesByDate: Record<string, number> = {};
      foodLogsSnap.forEach((doc) => {
        const data = doc.data();
        const dateStr = data.date;
        if (dateStr && data.kcal) {
          foodCaloriesByDate[dateStr] = (foodCaloriesByDate[dateStr] || 0) + Number(data.kcal);
        }
      });

      // Map days and construct inputs for TDEE calculation
      const points: { dayIndex: number; weight: number; calories: number }[] = [];
      
      datesList.forEach((dateStr, index) => {
        const checkin = checkinsByDate[dateStr];
        const weight = checkin?.weight;

        if (weight !== undefined && weight !== null) {
          // Determine calories consumed
          let calories = foodCaloriesByDate[dateStr] || 0;
          
          // If no items were logged in food_logs, estimate using adherence_nutrition from check-in
          if (calories === 0 && checkin.adherence_nutrition !== undefined) {
            const adherence = Number(checkin.adherence_nutrition);
            calories = Math.round(planCalories * (adherence / 100));
          } else if (calories === 0) {
            // Default to planCalories if no logs and no check-in exists
            calories = planCalories;
          }

          points.push({
            dayIndex: index,
            weight,
            calories,
          });
        }
      });

      // Calculate theoretical fallback TDEE (e.g. from user profile or default 2500)
      const fallbackTDEE = userData.profile?.tdee_theoretical || 2500;

      // Calculate adaptive TDEE
      const tdeeResult = computeTDEE(points, fallbackTDEE);

      // Save calculated TDEE to user profile/goals and log the calculation history
      const updateData: Record<string, any> = {};
      
      if (userData.profile) {
        updateData['profile.tdee_adaptive'] = tdeeResult.tdee;
      } else {
        updateData['profile'] = { tdee_adaptive: tdeeResult.tdee };
      }

      if (userData.goals) {
        updateData['goals.tdee_adaptive'] = tdeeResult.tdee;
      } else {
        updateData['goals'] = { tdee_adaptive: tdeeResult.tdee };
      }

      const batch = adminDb.batch();
      batch.update(userRef, updateData);

      // Save history entry
      const historyRef = userRef.collection('tdee_history').doc(today.toISOString().split('T')[0]);
      batch.set(historyRef, {
        calculatedAt: new Date().toISOString(),
        tdee: tdeeResult.tdee,
        weightSlope: tdeeResult.weightChangePerDay,
        avgCalories: tdeeResult.avgCalories,
        pointsCount: points.length,
      });

      await batch.commit();

      return NextResponse.json({
        success: true,
        tdee: tdeeResult.tdee,
        avgCalories: tdeeResult.avgCalories,
        weightChangePerDay: tdeeResult.weightChangePerDay,
        pointsUsed: points.length,
      }, { status: 200 });

    } catch (error) {
      console.error('Error recalculating adaptive TDEE:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: "Impossible de recalculer le TDEE adaptatif.", details: errMsg },
        { status: 500 }
      );
    }
  });
}
