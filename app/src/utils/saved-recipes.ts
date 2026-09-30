import { FoodItem } from '@/types/food-item';
import { daysUntilExpiry } from '@/utils/expiry-date';

export type StockStatus = 'in-stock' | 'expired' | 'not-in-stock';

/**
 * How one ingredient of a saved recipe stands against the inventory now,
 * matched by name without regard to case. One in-date item is enough to call
 * it in stock, even if another of the same name has expired; it is only
 * "expired" when every matching item is past its date.
 */
export function stockStatus(
  name: string,
  items: Pick<FoodItem, 'name' | 'expiryDate' | 'status'>[],
  today = new Date(),
): StockStatus {
  const key = name.trim().toLowerCase();
  const matches = items.filter(
    (item) => item.status === 'active' && item.name.trim().toLowerCase() === key,
  );

  if (matches.length === 0) {
    return 'not-in-stock';
  }

  /* An unreadable date counts as in date, as it does on the checklist. */
  return matches.some((item) => daysUntilExpiry(item.expiryDate, today) >= 0)
    ? 'in-stock'
    : 'expired';
}

/** "Saved today", or the day it was saved, e.g. "Saved 25 Sept". */
export function describeSavedDate(savedAt: string, today = new Date()): string {
  const saved = new Date(savedAt);

  if (Number.isNaN(saved.getTime())) {
    return 'Saved';
  }

  const isToday =
    saved.getFullYear() === today.getFullYear() &&
    saved.getMonth() === today.getMonth() &&
    saved.getDate() === today.getDate();

  return isToday
    ? 'Saved today'
    : `Saved ${new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(saved)}`;
}
