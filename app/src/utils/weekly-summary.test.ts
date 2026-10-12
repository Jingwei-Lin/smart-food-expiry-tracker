import { FoodItem } from '@/types/food-item';
import { getStartOfWeek, getWeeklyData } from '@/utils/weekly-summary';

/* The week maths depends on the clocks changing, so it is checked in Sydney time. */
process.env.TZ = 'Australia/Sydney';

/* Wednesday 7 Oct 2026, in the week after the clocks went forward on Sunday 4 Oct. */
const NOW = new Date(2026, 9, 7, 12, 0);

function buildItem(overrides: Partial<FoodItem>): FoodItem {
  return {
    id: 'milk',
    name: 'Milk',
    quantity: '1 L',
    expiryDate: '2026-10-10',
    reminderDaysBefore: 1,
    reminderRuleVersion: 2,
    notes: '',
    createdAt: '2026-09-01T00:00:00.000Z',
    status: 'eaten',
    ...overrides,
  };
}

function resolvedAt(status: 'eaten' | 'discarded', when: Date): FoodItem {
  return buildItem({ status, statusUpdatedAt: when.toISOString() });
}

describe('getStartOfWeek', () => {
  it('starts the week on Monday at local midnight', () => {
    expect(getStartOfWeek(new Date(2026, 9, 7, 15, 30))).toEqual(new Date(2026, 9, 5));
    expect(getStartOfWeek(new Date(2026, 9, 5, 0, 0))).toEqual(new Date(2026, 9, 5));
  });

  it('puts Sunday in the week that began on the Monday before', () => {
    expect(getStartOfWeek(new Date(2026, 9, 11, 23, 59))).toEqual(new Date(2026, 9, 5));
  });
});

describe('getWeeklyData', () => {
  it('runs in a time zone where the clocks change', () => {
    expect(new Date(2026, 9, 3).getTimezoneOffset()).not.toBe(
      new Date(2026, 9, 5).getTimezoneOffset(),
    );
  });

  it('returns three empty weeks when nothing has been resolved', () => {
    expect(getWeeklyData([], NOW)).toEqual([
      { week: 'This week', eaten: 0, donated: 0, discarded: 0 },
      { week: 'Last week', eaten: 0, donated: 0, discarded: 0 },
      { week: '2 weeks ago', eaten: 0, donated: 0, discarded: 0 },
    ]);
  });

  it('counts eaten and thrown-out food in the week it was resolved', () => {
    const weeks = getWeeklyData(
      [
        resolvedAt('eaten', new Date(2026, 9, 6, 9, 0)),
        resolvedAt('discarded', new Date(2026, 9, 7, 9, 0)),
        resolvedAt('eaten', new Date(2026, 9, 1, 9, 0)),
        resolvedAt('discarded', new Date(2026, 8, 24, 9, 0)),
      ],
      NOW,
    );

    expect(weeks.map(({ eaten, discarded }) => [eaten, discarded])).toEqual([
      [1, 1],
      [1, 0],
      [0, 1],
    ]);
  });

  it('counts the last moment of Sunday in the old week and midnight Monday in the new one', () => {
    const weeks = getWeeklyData(
      [
        resolvedAt('eaten', new Date(2026, 9, 4, 23, 59, 59)),
        resolvedAt('eaten', new Date(2026, 9, 5, 0, 0, 0)),
      ],
      NOW,
    );

    expect(weeks.map(({ eaten }) => eaten)).toEqual([1, 1, 0]);
  });

  it('keeps the week the clocks went forward in as exactly one week', () => {
    /* That week is 167 hours long, so the gap to this week is not 168 hours. */
    const weeks = getWeeklyData(
      [
        resolvedAt('eaten', new Date(2026, 8, 28, 0, 0, 0)),
        resolvedAt('eaten', new Date(2026, 9, 4, 12, 0, 0)),
      ],
      NOW,
    );

    expect(weeks.map(({ eaten }) => eaten)).toEqual([0, 2, 0]);
  });

  it('counts correctly when this week is the one the clocks went forward in', () => {
    const weeks = getWeeklyData(
      [
        resolvedAt('eaten', new Date(2026, 9, 3, 12, 0)),
        resolvedAt('eaten', new Date(2026, 8, 21, 12, 0)),
        resolvedAt('eaten', new Date(2026, 8, 7, 12, 0)),
      ],
      new Date(2026, 9, 4, 20, 0),
    );

    expect(weeks.map(({ eaten }) => eaten)).toEqual([1, 1, 0]);
  });

  it('ignores active items, even with a timestamp', () => {
    const active = buildItem({ status: 'active', statusUpdatedAt: NOW.toISOString() });

    expect(
      getWeeklyData([active], NOW).every(({ eaten, discarded }) => eaten + discarded === 0),
    ).toBe(true);
  });

  it('ignores a resolved item with no timestamp or an unreadable one', () => {
    const items = [
      buildItem({ status: 'eaten', statusUpdatedAt: undefined }),
      buildItem({ status: 'discarded', statusUpdatedAt: 'not a date' }),
    ];

    expect(getWeeklyData(items, NOW).map(({ eaten, discarded }) => eaten + discarded)).toEqual([
      0, 0, 0,
    ]);
  });

  it('drops outcomes from three or more weeks ago and from the future', () => {
    const items = [
      resolvedAt('eaten', new Date(2026, 8, 20, 12, 0)),
      resolvedAt('eaten', new Date(2026, 9, 12, 12, 0)),
    ];

    expect(getWeeklyData(items, NOW).map(({ eaten }) => eaten)).toEqual([0, 0, 0]);
  });

  it('never counts a donation, because items cannot be marked donated yet', () => {
    const weeks = getWeeklyData([resolvedAt('eaten', NOW)], NOW);

    expect(weeks.every(({ donated }) => donated === 0)).toBe(true);
  });
});
