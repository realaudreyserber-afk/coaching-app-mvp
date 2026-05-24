export function linearRegressionSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export const KCAL_PER_KG_FAT = 7700;

export function estimateAdaptiveTdee(weights: number[], kcalIngested: number[]): number | null {
  if (weights.length < 10 || weights.length !== kcalIngested.length) return null;
  const xs = weights.map((_, i) => i);
  const slopeKgPerDay = linearRegressionSlope(xs, weights);
  const energyImbalanceKcalPerDay = slopeKgPerDay * KCAL_PER_KG_FAT;
  const meanKcal = kcalIngested.reduce((a, b) => a + b, 0) / kcalIngested.length;
  const tdee = Math.round(meanKcal - energyImbalanceKcalPerDay);
  if (tdee < 1200 || tdee > 5000) return null;
  return tdee;
}
