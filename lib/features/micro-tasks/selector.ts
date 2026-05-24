import { MicroTask } from './schema';
import { MICRO_TASKS_BANK, GLP1_TASKS_BANK, HIGH_BF_TASKS_BANK } from './tasks-bank';
import { ProfilePath } from '../profile-paths/schema';

/**
 * Returns a deterministic hash code for a string.
 */
function getStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Deterministically selects a daily micro-task based on the date and the user's profile path.
 */
export function getDailyTaskForUser(profilePath: ProfilePath | null | undefined, dateStr: string): MicroTask {
  const path = profilePath || 'standard';
  const hash = getStringHash(dateStr);

  let targetBank: MicroTask[] = [...MICRO_TASKS_BANK];

  if (path === 'glp1') {
    // Merge GLP-1 specific tasks with general tasks and prioritize GLP-1 ones
    targetBank = [...GLP1_TASKS_BANK, ...MICRO_TASKS_BANK];
  } else if (path === 'high-bf') {
    targetBank = [...HIGH_BF_TASKS_BANK, ...MICRO_TASKS_BANK];
  }

  const index = hash % targetBank.length;
  return targetBank[index];
}
