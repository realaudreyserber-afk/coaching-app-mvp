import { ProfilePath } from './schema';

interface DetectionContext {
  profile?: {
    height?: number;
    weight?: number;
    sex?: 'male' | 'female';
    activity_level?: string;
  };
  baseline?: {
    weight?: number;
    body_fat?: number;
  };
  medical?: {
    medications?: string[];
    conditions?: string[];
  };
  glp1Active?: boolean;
}

/**
 * Automatically classifies the user into a specific coaching profile path.
 */
export function detectProfilePath(context: DetectionContext): ProfilePath {
  const meds = (context.medical?.medications || []).map(m => m.toLowerCase());
  const conds = (context.medical?.conditions || []).map(c => c.toLowerCase());

  // 1. Check GLP-1
  const hasGlp1Med = meds.some(m =>
    m.includes('ozempic') ||
    m.includes('wegovy') ||
    m.includes('mounjaro') ||
    m.includes('zepbound') ||
    m.includes('semaglutide') ||
    m.includes('tirzepatide') ||
    m.includes('liraglutide') ||
    m.includes('saxenda') ||
    m.includes('victoza') ||
    m.includes('glp1') ||
    m.includes('glp-1')
  );
  if (context.glp1Active || hasGlp1Med) {
    return 'glp1';
  }

  // 2. Check Post-Bariatric Surgery
  const hasBariatric = conds.some(c => 
    c.includes('bariatrique') || 
    c.includes('bariatric') || 
    c.includes('sleeve') || 
    c.includes('bypass') || 
    c.includes('gastroplastie') || 
    c.includes('anneau gastrique')
  ) || meds.some(m => 
    m.includes('bariatrique') || 
    m.includes('bariatric')
  );
  if (hasBariatric) {
    return 'post-bariatric';
  }

  // 3. Check High BF (Obesity / Overweight)
  const weight = context.profile?.weight || context.baseline?.weight || 0;
  const height = context.profile?.height || 0;
  const bodyFat = context.baseline?.body_fat || 0;
  const sex = context.profile?.sex || 'male';

  if (height > 0 && weight > 0) {
    const bmi = weight / ((height / 100) * (height / 100));
    if (bmi >= 30) {
      return 'high-bf';
    }
  }

  if (bodyFat > 0) {
    if (sex === 'male' && bodyFat >= 25) {
      return 'high-bf';
    }
    if (sex === 'female' && bodyFat >= 35) {
      return 'high-bf';
    }
  }

  // 4. Check Ex-Athlete
  const isVeryActive = context.profile?.activity_level === 'very_active';
  const hasAthleteKeywords = conds.some(c => 
    c.includes('athlete') || 
    c.includes('athlète') || 
    c.includes('competition') || 
    c.includes('compétition')
  );
  if (isVeryActive || hasAthleteKeywords) {
    return 'ex-athlete';
  }

  return 'standard';
}
