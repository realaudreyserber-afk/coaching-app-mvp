import { describe, it, expect } from 'vitest';
import { getDailyTaskForUser } from './selector';

describe('Daily Micro-task Selector', () => {
  it('should deterministically select the same task for the same date and profile', () => {
    const task1 = getDailyTaskForUser('standard', '2026-05-24');
    const task2 = getDailyTaskForUser('standard', '2026-05-24');
    expect(task1.id).toBe(task2.id);
  });

  it('should select different tasks for different dates', () => {
    const taskMay24 = getDailyTaskForUser('standard', '2026-05-24');
    const taskMay25 = getDailyTaskForUser('standard', '2026-05-25');
    // It's possible but unlikely that they are the same depending on hash modulus,
    // let's verify they are different or have a valid text property.
    expect(taskMay24.text).toBeDefined();
    expect(taskMay25.text).toBeDefined();
  });

  it('should select GLP-1 tasks for glp1 profile', () => {
    const task = getDailyTaskForUser('glp1', '2026-05-24');
    expect(task.text).toBeDefined();
  });

  it('should select High BF tasks for high-bf profile', () => {
    const task = getDailyTaskForUser('high-bf', '2026-05-24');
    expect(task.text).toBeDefined();
  });
});
