import {
  formatTime,
  openStatus,
  parseOpeningHours,
  weekRows,
  type WeekHours,
} from '@/utils/opening-hours';

/* Wednesday 21 October 2026, at the given time. */
function wednesdayAt(hour: number, minute = 0): Date {
  return new Date(2026, 9, 21, hour, minute);
}

function parsed(raw: string): WeekHours {
  const week = parseOpeningHours(raw);

  if (!week) {
    throw new Error(`Expected "${raw}" to parse`);
  }

  return week;
}

describe('parseOpeningHours', () => {
  it('reads a day range with a day off', () => {
    const week = parsed('Mo-Sa 12:00-16:00; Su off');

    expect(week[0]).toEqual([{ start: 720, end: 960 }]);
    expect(week[5]).toEqual([{ start: 720, end: 960 }]);
    expect(week[6]).toEqual([]);
  });

  it('treats days no rule mentions as closed', () => {
    const week = parsed('Tu 12:00-15:30; Fr 08:30-13:30');

    expect(week[0]).toEqual([]);
    expect(week[1]).toEqual([{ start: 720, end: 930 }]);
    expect(week[4]).toEqual([{ start: 510, end: 810 }]);
  });

  it('reads lists of days and of times', () => {
    const week = parsed('Mo,We 09:00-12:00,13:00-16:00');

    expect(week[0]).toHaveLength(2);
    expect(week[1]).toEqual([]);
    expect(week[2]).toHaveLength(2);
  });

  it('reads 24/7 and times with no days', () => {
    expect(parsed('24/7').every((day) => day[0].end === 1440)).toBe(true);
    expect(parsed('09:00-17:00').every((day) => day.length === 1)).toBe(true);
  });

  it('wraps a day range round the weekend', () => {
    const week = parsed('Sa-Mo 10:00-12:00');

    expect([week[5], week[6], week[0]].every((day) => day.length === 1)).toBe(true);
    expect(week[1]).toEqual([]);
  });

  it('skips public holiday rules', () => {
    expect(parsed('Mo-Fr 07:30-14:00; PH off')[0]).toEqual([{ start: 450, end: 840 }]);
  });

  it('gives null for hours it cannot read', () => {
    expect(parseOpeningHours('Jan-Mar Mo 09:00-12:00')).toBeNull();
    expect(parseOpeningHours('Mo sunrise-sunset')).toBeNull();
    expect(parseOpeningHours('PH off')).toBeNull();
    expect(parseOpeningHours('')).toBeNull();
  });
});

describe('formatTime', () => {
  it('writes times the way people say them', () => {
    expect(formatTime(540)).toBe('9 am');
    expect(formatTime(930)).toBe('3:30 pm');
    expect(formatTime(720)).toBe('12 pm');
    expect(formatTime(0)).toBe('12 am');
  });
});

describe('weekRows', () => {
  it('groups days with the same hours, and gives today its own bold row', () => {
    const rows = weekRows(parsed('Mo-Fr 09:00-15:00'), wednesdayAt(10));

    expect(rows).toEqual([
      { days: 'Mon – Tue', hours: '9 am – 3 pm', isToday: false },
      { days: 'Wed', hours: '9 am – 3 pm', isToday: true },
      { days: 'Thu – Fri', hours: '9 am – 3 pm', isToday: false },
      { days: 'Sat – Sun', hours: 'Closed', isToday: false },
    ]);
  });

  it('uses one row when every day is the same', () => {
    expect(weekRows(parsed('24/7'), wednesdayAt(10))).toEqual([
      { days: 'Every day', hours: 'Open 24 hours', isToday: false },
    ]);
  });
});

describe('openStatus', () => {
  const weekdays = parsed('Mo-Fr 09:00-15:00');

  it('says when an open place closes', () => {
    expect(openStatus(weekdays, wednesdayAt(10))).toEqual({
      isOpen: true,
      label: 'Open now',
      detail: 'closes 3 pm',
    });
  });

  it('says when a closed place opens later today, tomorrow or on another day', () => {
    expect(openStatus(weekdays, wednesdayAt(7)).detail).toBe('opens 9 am');
    expect(openStatus(weekdays, wednesdayAt(16)).detail).toBe('opens tomorrow 9 am');
    expect(openStatus(parsed('Mo 09:00-12:00'), wednesdayAt(10)).detail).toBe('opens Mon 9 am');
  });

  it('counts hours that run past midnight', () => {
    const lateTuesday = parsed('Tu 18:00-02:00');

    expect(openStatus(lateTuesday, wednesdayAt(1)).isOpen).toBe(true);
    expect(openStatus(lateTuesday, wednesdayAt(3)).isOpen).toBe(false);
  });

  it('closes on the minute the hours end', () => {
    expect(openStatus(weekdays, wednesdayAt(15)).isOpen).toBe(false);
  });
});
