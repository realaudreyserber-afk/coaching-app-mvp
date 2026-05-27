/**
 * Registry des sous-agents. Le Supervisor utilise `getSubAgent(name)` pour
 * instancier un agent par son nom canonique. Ajouter un sous-agent =
 * ajouter une entrée dans FACTORIES.
 */

import type { SubAgentName } from '../types';
import { BaseAgent } from './base';
import { NutritionCoach } from './nutrition';
import { AnalyticsCoach } from './analytics';
import { TrainingCoach } from './training';
import { SafetyCoach } from './safety';
import { MentalCoach } from './mental';
import { SocialCoach } from './social';
import { EducationCoach } from './education';

const FACTORIES: Record<SubAgentName, () => BaseAgent> = {
  nutrition: () => new NutritionCoach(),
  analytics: () => new AnalyticsCoach(),
  training: () => new TrainingCoach(),
  safety: () => new SafetyCoach(),
  mental: () => new MentalCoach(),
  social: () => new SocialCoach(),
  education: () => new EducationCoach(),
};

export function getSubAgent(name: SubAgentName): BaseAgent {
  const factory = FACTORIES[name];
  if (!factory) {
    throw new Error(`[agents/registry] Unknown sub-agent: ${name}`);
  }
  return factory();
}

export { BaseAgent };
