const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

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
 * Formats digits typed into the expiry field as YYYY-MM-DD.
 *
 * The field uses a digits-only keypad, which has no hyphen key on either iOS
 * or Android, so the separators are inserted as the student types.
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

export type ExpiryPresentation = {
  label: string;
  foreground: string;
  background: string;
};

/**
 * Creates the label and colours displayed in an expiry badge.
 */
export function getExpiryPresentation(value: string): ExpiryPresentation {
  const days = daysUntilExpiry(value);

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
  /** The colour rail down the left of an inventory row. */
  railColor: string;
};

/**
 * Describes an item the way the grouped inventory list shows it.
 *
 * The section heading already says how urgent the item is, so the row itself
 * answers "when?" — the weekday while that still means something to a student
 * planning their week, and a date once it does not.
 */
export function getExpiryListPresentation(
  value: string,
  today = new Date(),
): ExpiryListPresentation {
  const expiryDate = parseExpiryDate(value);

  if (!expiryDate) {
    return { meta: 'No date', railColor: '#c2cbc3' };
  }

  const days = daysUntilExpiry(value, today);

  if (days < 0) {
    const elapsedDays = Math.abs(days);

    return {
      meta: `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} over`,
      railColor: '#c8352c',
    };
  }

  if (days === 0) {
    return { meta: 'Today', railColor: '#c8352c' };
  }

  if (days === 1) {
    return { meta: 'Tomorrow', railColor: '#d9922f' };
  }

  const railColor = days <= 3 ? '#d9922f' : '#7fb183';

  if (days < 7) {
    return {
      meta: new Intl.DateTimeFormat('en-AU', { weekday: 'short' }).format(expiryDate),
      railColor,
    };
  }

  return {
    meta: new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(expiryDate),
    railColor,
  };
}
