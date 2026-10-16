import type { FoodItem } from '@/types/food-item';

export type WeeklyData = {
  week: string;
  eaten: number;
  donated: number;
  discarded: number;
};

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Midnight at the start of the Monday of the week containing `date`, in local time. */
export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);

  return result;
}

/**
 * Counts what happened to food in this week, last week and the week before.
 *
 * Active items have not been resolved, so they are not outcomes.
 */
export function getWeeklyData(items: FoodItem[], now: Date): WeeklyData[] {
  const currentWeekStart = getStartOfWeek(now);

  const weeks: WeeklyData[] = [
    { week: 'This week', eaten: 0, donated: 0, discarded: 0 },
    { week: 'Last week', eaten: 0, donated: 0, discarded: 0 },
    { week: '2 weeks ago', eaten: 0, donated: 0, discarded: 0 },
  ];

  for (const item of items) {
    if (item.status === 'active' || !item.statusUpdatedAt) {
      continue;
    }

    const outcomeDate = new Date(item.statusUpdatedAt);

    if (Number.isNaN(outcomeDate.getTime())) {
      continue;
    }

    /*
     * Rounded because the week in which the clocks change is an hour longer or
     * shorter than 7 x 24 hours, so the difference is not a whole number of weeks.
     */
    const weekIndex = Math.round(
      (currentWeekStart.getTime() - getStartOfWeek(outcomeDate).getTime()) / MS_PER_WEEK,
    );

    if (weekIndex < 0 || weekIndex >= weeks.length) {
      continue;
    }

    if (item.status === 'eaten') {
      weeks[weekIndex].eaten += 1;
    } else if (item.status === 'donated') {
      weeks[weekIndex].donated += 1;
    } else if (item.status === 'discarded') {
      weeks[weekIndex].discarded += 1;
    }
  }

  return weeks;
}
