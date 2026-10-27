import type { FoodItem } from '@/types/food-item';
import { toExpiryDateString } from '@/utils/expiry-date';

export type SummaryPeriod = 'week' | 'month';

/** What happened to food on one local calendar day. */
export type DayOutcomes = {
  /** The day as YYYY-MM-DD, which is also how an outcome is matched to it. */
  key: string;
  date: Date;
  eaten: number;
  donated: number;
  discarded: number;
};

export type OutcomeTotals = Pick<DayOutcomes, 'eaten' | 'donated' | 'discarded'>;

/** Midnight at the start of the Monday of the week containing `date`, in local time. */
export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);

  return result;
}

/**
 * The local day an item was eaten, thrown out or donated on, or null for an
 * item that has not been resolved or whose timestamp cannot be read.
 */
function getOutcomeDayKey(item: FoodItem): string | null {
  if (item.status === 'active' || !item.statusUpdatedAt) {
    return null;
  }

  const outcomeDate = new Date(item.statusUpdatedAt);

  return Number.isNaN(outcomeDate.getTime()) ? null : toExpiryDateString(outcomeDate);
}

/**
 * Counts what happened to food on each day of the week or month containing
 * `today`: Monday to Sunday, or the 1st to the last day of the month.
 *
 * Active items have not been resolved, so they are not outcomes.
 */
export function getSummaryDays(
  items: FoodItem[],
  today: Date,
  period: SummaryPeriod,
): DayOutcomes[] {
  const firstDay =
    period === 'week' ? getStartOfWeek(today) : new Date(today.getFullYear(), today.getMonth(), 1);

  const dayCount =
    period === 'week' ? 7 : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  /*
   * Each day is built from the first one with setDate, which keeps midnight as
   * midnight. Adding 24 hours would land an hour off after the clocks change.
   */
  const days = Array.from({ length: dayCount }, (_, index): DayOutcomes => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);

    return { key: toExpiryDateString(date), date, eaten: 0, donated: 0, discarded: 0 };
  });

  const daysByKey = new Map(days.map((day) => [day.key, day]));

  for (const item of items) {
    const key = getOutcomeDayKey(item);
    const day = key ? daysByKey.get(key) : undefined;

    if (!day) {
      continue;
    }

    if (item.status === 'eaten') {
      day.eaten += 1;
    } else if (item.status === 'donated') {
      day.donated += 1;
    } else if (item.status === 'discarded') {
      day.discarded += 1;
    }
  }

  return days;
}

export function sumOutcomes(days: DayOutcomes[]): OutcomeTotals {
  return days.reduce<OutcomeTotals>(
    (totals, day) => ({
      eaten: totals.eaten + day.eaten,
      donated: totals.donated + day.donated,
      discarded: totals.discarded + day.discarded,
    }),
    { eaten: 0, donated: 0, discarded: 0 },
  );
}

/** The items thrown out on any of the given days, so the summary can list them. */
export function getDiscardedItems(items: FoodItem[], days: DayOutcomes[]): FoodItem[] {
  const keys = new Set(days.map((day) => day.key));

  return items.filter((item) => {
    const key = getOutcomeDayKey(item);

    return item.status === 'discarded' && key !== null && keys.has(key);
  });
}
