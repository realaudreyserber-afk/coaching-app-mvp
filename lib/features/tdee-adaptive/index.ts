/**
 * Module M8 — Adaptive TDEE
 * Computes real TDEE based on weight trends (linear regression) and calorie intake over 14 days.
 */

interface DataPoint {
  dayIndex: number; // 0 to 13 relative to the start of the 14-day window
  weight: number;
  calories: number;
}

/**
 * Performs linear regression to find the slope of weights.
 * Slope represents average daily weight change in kg/day.
 */
export function calculateWeightSlope(points: { dayIndex: number; weight: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const p of points) {
    sumX += p.dayIndex;
    sumY += p.weight;
    sumXY += p.dayIndex * p.weight;
    sumXX += p.dayIndex * p.dayIndex;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Main adaptive TDEE calculation.
 * 1 kg of weight change is assumed to be roughly 7700 kcal.
 * TDEE = Daily Avg Calorie Intake - (Weight Slope * 7700)
 */
export function computeTDEE(
  points: { dayIndex: number; weight: number; calories: number }[],
  fallbackTDEE: number
): { tdee: number; weightChangePerDay: number; avgCalories: number } {
  // We need at least 5 days of weight and calorie data to perform a reliable calculation
  if (points.length < 5) {
    return {
      tdee: Math.round(fallbackTDEE),
      weightChangePerDay: 0,
      avgCalories: points.reduce((sum, p) => sum + p.calories, 0) / (points.length || 1),
    };
  }

  // Calculate weight slope (kg/day)
  const weightPoints = points.map(p => ({ dayIndex: p.dayIndex, weight: p.weight }));
  const weightChangePerDay = calculateWeightSlope(weightPoints);

  // Calculate average daily calories consumed
  const totalCalories = points.reduce((sum, p) => sum + p.calories, 0);
  const avgCalories = totalCalories / points.length;

  // 1 kg bodyweight change ≈ 7700 kcal energy surplus or deficit
  const weightChangeKcal = weightChangePerDay * 7700;

  // TDEE = average calories consumed minus the surplus/deficit represented by weight change
  const rawTDEE = avgCalories - weightChangeKcal;

  // Constrain TDEE variations to stay within realistic human boundaries (e.g. 1000 - 5000 kcal)
  const constrainedTDEE = Math.max(1000, Math.min(5000, rawTDEE));

  return {
    tdee: Math.round(constrainedTDEE),
    weightChangePerDay,
    avgCalories: Math.round(avgCalories),
  };
}
