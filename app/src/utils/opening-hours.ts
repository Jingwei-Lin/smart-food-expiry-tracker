/*
 * Reads the simple OpenStreetMap opening hours most donation points use
 * ("Mo-Sa 12:00-16:00; Su off", "Tu 12:00-15:30; Fr 08:30-13:30", "24/7"),
 * so the detail screen can say whether a place is open now and lay the week
 * out as a table. Anything more complicated (months, week numbers, "sunrise")
 * gives null, and the screen falls back to the hours as written.
 */

/** Minutes after midnight. `end` can pass 1440 for hours that run past midnight. */
export type TimeRange = { start: number; end: number };

/** Monday first. An empty list means closed that day. */
export type WeekHours = TimeRange[][];

export type HoursRow = {
  /** "Mon – Tue", or one day such as "Wed". */
  days: string;
  /** "9 am – 3 pm", "Closed" or "Open 24 hours". */
  hours: string;
  isToday: boolean;
};

export type OpenStatus = {
  isOpen: boolean;
  /** "Open now" or "Closed now". */
  label: string;
  /** "closes 3 pm", "opens Tue 12 pm", or '' when the place never opens. */
  detail: string;
};

const DAY_CODES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WHOLE_DAY: TimeRange = { start: 0, end: 24 * 60 };

const DAYS_PART = /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s+(.+)$/;
const TIME_RANGE = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;

/** Monday is 0, as in WeekHours. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** "Mo-We,Fr" → [0, 1, 2, 4]. A range can wrap round the weekend, e.g. "Sa-Mo". */
function parseDays(text: string): number[] {
  const days: number[] = [];

  for (const part of text.split(',').map((piece) => piece.trim())) {
    const [from, to] = part.split('-').map((piece) => DAY_CODES.indexOf(piece.trim()));

    if (to === undefined) {
      days.push(from);
      continue;
    }

    for (let day = from; ; day = (day + 1) % 7) {
      days.push(day);

      if (day === to) {
        break;
      }
    }
  }

  return days;
}

/** "09:00-12:00,13:00-16:00" → two ranges, "off" → none, anything else → null. */
function parseTimes(text: string): TimeRange[] | null {
  if (text === 'off' || text === 'closed') {
    return [];
  }

  const ranges: TimeRange[] = [];

  for (const part of text.split(',').map((piece) => piece.trim())) {
    const match = TIME_RANGE.exec(part);

    if (!match) {
      return null;
    }

    const [, startHour, startMinute, endHour, endMinute] = match.map(Number);
    const start = startHour * 60 + startMinute;
    let end = endHour * 60 + endMinute;

    // "18:00-02:00" runs into the next day.
    if (end <= start) {
      end += 24 * 60;
    }

    ranges.push({ start, end });
  }

  return ranges;
}

/**
 * The week as seven lists of opening times, or null if the hours are written
 * in a way this doesn't read. Later rules replace earlier ones for the same
 * day, as OpenStreetMap intends, and days no rule mentions are closed.
 * Public holiday rules ("PH off") are skipped, since a week view can't show them.
 */
export function parseOpeningHours(raw: string): WeekHours | null {
  const text = raw.trim();

  if (text === '24/7') {
    return DAY_CODES.map(() => [WHOLE_DAY]);
  }

  const week: WeekHours = DAY_CODES.map(() => []);
  let readAny = false;

  for (const rule of text
    .split(';')
    .map((piece) => piece.trim())
    .filter(Boolean)) {
    if (/^PH\b/.test(rule)) {
      continue;
    }

    const daysMatch = DAYS_PART.exec(rule);
    const days = daysMatch ? parseDays(daysMatch[1]) : [0, 1, 2, 3, 4, 5, 6];
    const times = parseTimes(daysMatch ? daysMatch[2].trim() : rule);

    if (!times) {
      return null;
    }

    for (const day of days) {
      week[day] = times;
    }

    readAny = true;
  }

  return readAny ? week : null;
}

/** 540 → "9 am", 930 → "3:30 pm", 720 → "12 pm". */
export function formatTime(minutes: number): string {
  const inDay = minutes % (24 * 60);
  const hour = Math.floor(inDay / 60);
  const minute = inDay % 60;
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? 'am' : 'pm';

  return minute === 0
    ? `${twelve} ${suffix}`
    : `${twelve}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function describeDay(ranges: TimeRange[]): string {
  if (ranges.length === 0) {
    return 'Closed';
  }

  if (ranges.length === 1 && ranges[0].start === 0 && ranges[0].end >= 24 * 60) {
    return 'Open 24 hours';
  }

  return ranges.map((range) => `${formatTime(range.start)} – ${formatTime(range.end)}`).join(', ');
}

/**
 * The week as table rows. Days in a row with the same hours share a row
 * ("Mon – Tue"), but today always gets a row of its own so it can be bold,
 * unless every day is the same, which is one "Every day" row.
 */
export function weekRows(week: WeekHours, today: Date): HoursRow[] {
  const todayIndex = weekdayIndex(today);
  const everyDay = describeDay(week[0]);

  // The same hours all week read better as one row than as today plus the rest.
  if (week.every((day) => describeDay(day) === everyDay)) {
    return [{ days: 'Every day', hours: everyDay, isToday: false }];
  }

  const rows: HoursRow[] = [];
  let first = 0;

  for (let day = 1; day <= 7; day += 1) {
    const sameAsBefore =
      day < 7 &&
      day !== todayIndex &&
      day - 1 !== todayIndex &&
      describeDay(week[day]) === describeDay(week[first]);

    if (sameAsBefore) {
      continue;
    }

    const last = day - 1;

    rows.push({
      days: first === last ? DAY_LABELS[first] : `${DAY_LABELS[first]} – ${DAY_LABELS[last]}`,
      hours: describeDay(week[first]),
      isToday: first === todayIndex,
    });
    first = day;
  }

  return rows;
}

/** Whether the place is open at `now`, and when it next closes or opens. */
export function openStatus(week: WeekHours, now: Date): OpenStatus {
  const today = weekdayIndex(now);
  const minute = now.getHours() * 60 + now.getMinutes();
  const yesterday = (today + 6) % 7;

  const openToday = week[today].find((range) => range.start <= minute && minute < range.end);
  // Hours from last night that run past midnight, e.g. "Fr 18:00-02:00" at 1 am on Saturday.
  const openFromYesterday = week[yesterday].find(
    (range) => range.end > 24 * 60 && minute < range.end - 24 * 60,
  );
  const current = openToday ?? openFromYesterday;

  if (current) {
    const allDay = current.start === 0 && current.end >= 24 * 60;

    return {
      isOpen: true,
      label: 'Open now',
      detail: allDay ? 'open 24 hours' : `closes ${formatTime(current.end)}`,
    };
  }

  const laterToday = week[today].find((range) => range.start > minute);

  if (laterToday) {
    return { isOpen: false, label: 'Closed now', detail: `opens ${formatTime(laterToday.start)}` };
  }

  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const day = (today + ahead) % 7;
    const [next] = week[day];

    if (next) {
      const when = ahead === 1 ? 'tomorrow' : DAY_LABELS[day];

      return {
        isOpen: false,
        label: 'Closed now',
        detail: `opens ${when} ${formatTime(next.start)}`,
      };
    }
  }

  return { isOpen: false, label: 'Closed now', detail: '' };
}
