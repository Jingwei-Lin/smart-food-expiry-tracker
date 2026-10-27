import type { FoodItem } from '@/types/food-item';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/* Shared with recipe suggestions, so "eat soon" means the same thing on every screen. */
export const EAT_SOON_DAYS = 3;

/**
 * Parses a date written as YYYY-MM-DD.
 */
export function parseExpiryDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  const isSameDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isSameDate ? date : null;
}

/**
 * Writes a calendar day as the YYYY-MM-DD the inventory stores, in local time.
 */
export function toExpiryDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Formats digits typed into the expiry field as YYYY-MM-DD.
 *
 * Only the web build types the date, because the phone calendar picker has no
 * web version. The digits-only keypad has no hyphen key, so the separators are
 * inserted as the student types.
 */
export function formatExpiryDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);

  return [year, month, day].filter((part) => part.length > 0).join('-');
}

/**
 * Writes a date the way every screen shows a full date, e.g. 15 Sept 2026.
 */
export function formatDayMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Writes a chosen date with its weekday, e.g. "Sun, 20 Sept 2026", so the
 * student can check it against the packet at a glance.
 */
export function formatWeekdayDate(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Converts YYYY-MM-DD into a readable Australian date.
 *
 * Example:
 * 2026-09-15 becomes 15 Sept 2026.
 */
export function formatExpiryDate(value: string): string {
  const date = parseExpiryDate(value);

  if (!date) {
    return value;
  }

  return formatDayMonthYear(date);
}

/**
 * Calculates the number of calendar days between today and the expiry date.
 *
 * Negative: already expired
 * Zero: expires today
 * Positive: expires in the future
 */
export function daysUntilExpiry(value: string, today = new Date()): number {
  const expiryDate = parseExpiryDate(value);

  if (!expiryDate) {
    return Number.POSITIVE_INFINITY;
  }

  /*
   * UTC calendar values avoid daylight-saving changes producing a result
   * such as 0.958 or 1.042 days.
   */
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  const expiryUtc = Date.UTC(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());

  return Math.round((expiryUtc - todayUtc) / MILLISECONDS_PER_DAY);
}

/**
 * What an active item's reminders actually are, for the item screen.
 *
 * Read from the reminders that were scheduled rather than from the chosen
 * notice, because nothing is scheduled when notifications are off or
 * scheduling failed, and an item saved on its expiry day gets only the
 * expiry-day reminder. An edit reschedules an item that has none, even when
 * nothing else changes, which is why the hint points to Edit.
 */
export function describeReminders(
  item: Pick<FoodItem, 'expiryDate' | 'reminderDaysBefore' | 'notificationIds'>,
  today = new Date(),
): string {
  if (daysUntilExpiry(item.expiryDate, today) < 0) {
    return 'None, it has expired';
  }

  const scheduled = item.notificationIds?.length ?? 0;

  if (scheduled >= 2) {
    const dayWord = item.reminderDaysBefore === 1 ? 'day' : 'days';

    return `${item.reminderDaysBefore} ${dayWord} before and on expiry day`;
  }

  if (scheduled === 1) {
    return 'On expiry day';
  }

  return 'Not set. Turn on notifications, then save the item again from Edit';
}

export type ExpiryPresentation = {
  label: string;
  foreground: string;
  background: string;
};

/**
 * Creates the label and colours displayed in an expiry badge.
 */
export function getExpiryPresentation(value: string, today = new Date()): ExpiryPresentation {
  const days = daysUntilExpiry(value, today);

  if (!Number.isFinite(days)) {
    return {
      label: 'Invalid expiry date',
      foreground: '#5e6260',
      background: '#eceeed',
    };
  }

  if (days < 0) {
    const elapsedDays = Math.abs(days);

    return {
      label: `Expired ${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} ago`,
      foreground: '#9f2420',
      background: '#fde7e5',
    };
  }

  if (days === 0) {
    return {
      label: 'Expires today',
      foreground: '#9f2420',
      background: '#fde7e5',
    };
  }

  if (days === 1) {
    return {
      label: 'Expires tomorrow',
      foreground: '#a14f00',
      background: '#fff0d5',
    };
  }

  if (days <= 3) {
    return {
      label: `${days} days left`,
      foreground: '#a14f00',
      background: '#fff0d5',
    };
  }

  return {
    label: `${days} days left`,
    foreground: '#27652a',
    background: '#e7f4e8',
  };
}

export type ExpiryListPresentation = {
  /** The right-hand column of an inventory row: a weekday nearby, a date later on. */
  meta: string;
};

/**
 * Describes when an item expires, the way an inventory row shows it.
 *
 * The row's badge already says how urgent the item is, so this answers
 * "when?" — the weekday while that still means something to a student
 * planning their week, and a date once it does not.
 */
export function getExpiryListPresentation(
  value: string,
  today = new Date(),
): ExpiryListPresentation {
  const expiryDate = parseExpiryDate(value);

  if (!expiryDate) {
    return { meta: 'No date' };
  }

  const days = daysUntilExpiry(value, today);

  if (days < 0) {
    const elapsedDays = Math.abs(days);

    return { meta: `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} over` };
  }

  if (days === 0) {
    return { meta: 'Today' };
  }

  if (days === 1) {
    return { meta: 'Tomorrow' };
  }

  if (days < 7) {
    return { meta: new Intl.DateTimeFormat('en-AU', { weekday: 'short' }).format(expiryDate) };
  }

  return {
    meta: new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(expiryDate),
  };
}
