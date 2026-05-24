/**
 * Calculates current and longest streaks based on a list of daily check-in date strings.
 * Dates must be formatted as 'YYYY-MM-DD'.
 */
export function calculateStreak(dates: string[], todayStr: string): { currentStreak: number; longestStreak: number } {
  if (!dates || dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Remove duplicates and sort descending
  const uniqueDates = Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));

  let currentStreak = 0;
  let longestStreak = 0;

  const today = new Date(todayStr);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const hasToday = uniqueDates.includes(todayStr);
  const hasYesterday = uniqueDates.includes(yesterdayStr);

  if (!hasToday && !hasYesterday) {
    // Streak is broken (0 days)
    currentStreak = 0;
  } else {
    // Start counting from either today (if checked in) or yesterday (if today's check-in is pending)
    const checkDate = hasToday ? today : yesterday;
    let indexDateStr = checkDate.toISOString().split('T')[0];

    while (uniqueDates.includes(indexDateStr)) {
      currentStreak++;
      // Move to previous day
      checkDate.setDate(checkDate.getDate() - 1);
      indexDateStr = checkDate.toISOString().split('T')[0];
    }
  }

  // Calculate longest streak by iterating through unique sorted dates ascending
  const sortedAsc = [...uniqueDates].sort((a, b) => a.localeCompare(b));
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of sortedAsc) {
    const currentDate = new Date(dateStr);
    if (prevDate === null) {
      tempStreak = 1;
    } else {
      const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        tempStreak = 1;
      }
    }
    prevDate = currentDate;
  }

  if (tempStreak > longestStreak) {
    longestStreak = tempStreak;
  }

  // Ensure longest is at least current
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  return {
    currentStreak,
    longestStreak,
  };
}
