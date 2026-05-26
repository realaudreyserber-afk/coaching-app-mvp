/**
 * Utility to map generated exercise images to exercise names.
 */
export function getExercisePosterUrl(exerciseName: string): string | undefined {
  if (!exerciseName) return undefined;

  const normalized = exerciseName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove accents

  if (normalized.includes("squat")) {
    return "/exercises/squat.jpg";
  }
  if (normalized.includes("developpe couche") || normalized.includes("bench")) {
    return "/exercises/bench-press.jpg";
  }
  if (normalized.includes("souleve de terre") || normalized.includes("deadlift")) {
    return "/exercises/deadlift.jpg";
  }
  if (
    normalized.includes("developpe militaire") ||
    normalized.includes("overhead") ||
    normalized.includes("shoulder press") ||
    normalized.includes("developpe assis")
  ) {
    return "/exercises/overhead-press.jpg";
  }
  if (normalized.includes("traction") || normalized.includes("pull up")) {
    return "/exercises/pull-up.jpg";
  }
  if (normalized.includes("rowing") || normalized.includes("tirage") || normalized.includes("row")) {
    return "/exercises/rowing.jpg";
  }
  if (normalized.includes("pompe") || normalized.includes("push up") || normalized.includes("push-up")) {
    return "/exercises/push-up.jpg";
  }
  if (normalized.includes("dip")) {
    return "/exercises/dips.jpg";
  }
  if (normalized.includes("curl")) {
    return "/exercises/biceps-curl.jpg";
  }
  if (normalized.includes("extension triceps") || normalized.includes("triceps")) {
    return "/exercises/triceps-extension.jpg";
  }
  if (normalized.includes("fente") || normalized.includes("lunge")) {
    return "/exercises/lunge.jpg";
  }
  if (normalized.includes("presse") || normalized.includes("leg press")) {
    return "/exercises/leg-press.jpg";
  }
  if (normalized.includes("leg extension") || normalized.includes("extension jambe")) {
    return "/exercises/leg-extension.jpg";
  }
  if (normalized.includes("leg curl") || normalized.includes("flexion jambe")) {
    return "/exercises/leg-curl.jpg";
  }
  if (
    normalized.includes("elevation") ||
    normalized.includes("lateral raise") ||
    normalized.includes("ecarte lateral")
  ) {
    return "/exercises/lateral-raise.jpg";
  }
  if (normalized.includes("gainage") || normalized.includes("plank") || normalized.includes("planche")) {
    return "/exercises/plank.jpg";
  }
  if (
    normalized.includes("crunch") ||
    normalized.includes("abdominaux") ||
    normalized.includes("sit-up") ||
    normalized.includes("releve de jambe")
  ) {
    return "/exercises/crunch.jpg";
  }

  // Fallback to undefined so it shows the letter placeholder
  return undefined;
}
