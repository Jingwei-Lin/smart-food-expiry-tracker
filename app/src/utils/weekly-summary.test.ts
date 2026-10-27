import { FoodItem } from '@/types/food-item';
import {
  getDiscardedItems,
  getStartOfWeek,
  getSummaryDays,
  sumOutcomes,
} from '@/utils/weekly-summary';

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
    storageLocation: 'fridge',
    category: 'Others',
    reminderDaysBefore: 1,
    reminderRuleVersion: 2,
    notes: '',
    createdAt: '2026-09-01T00:00:00.000Z',
    status: 'eaten',
    ...overrides,
  };
}

function resolvedAt(status: 'eaten' | 'discarded' | 'donated', when: Date): FoodItem {
  return buildItem({ status, statusUpdatedAt: when.toISOString() });
}

function eatenPerDay(days: ReturnType<typeof getSummaryDays>): Record<string, number> {
  return Object.fromEntries(days.filter((day) => day.eaten > 0).map((day) => [day.key, day.eaten]));
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

describe('getSummaryDays', () => {
  it('runs in a time zone where the clocks change', () => {
    expect(new Date(2026, 9, 3).getTimezoneOffset()).not.toBe(
      new Date(2026, 9, 5).getTimezoneOffset(),
    );
  });

  describe('for a week', () => {
    it('lists the seven days from Monday to Sunday, all empty when nothing is resolved', () => {
      const days = getSummaryDays([], NOW, 'week');

      expect(days.map((day) => day.key)).toEqual([
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
        '2026-10-11',
      ]);
      expect(sumOutcomes(days)).toEqual({ eaten: 0, donated: 0, discarded: 0 });
    });

    it('counts each outcome on the day it was recorded', () => {
      const days = getSummaryDays(
        [
          resolvedAt('eaten', new Date(2026, 9, 6, 9, 0)),
          resolvedAt('eaten', new Date(2026, 9, 6, 18, 0)),
          resolvedAt('discarded', new Date(2026, 9, 7, 9, 0)),
          resolvedAt('donated', new Date(2026, 9, 7, 10, 0)),
        ],
        NOW,
        'week',
      );

      expect(days.map(({ eaten, donated, discarded }) => [eaten, donated, discarded])).toEqual([
        [0, 0, 0],
        [2, 0, 0],
        [0, 1, 1],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]);
    });

    it('counts the last moment of Sunday in the old week and midnight Monday in the new one', () => {
      const items = [
        resolvedAt('eaten', new Date(2026, 9, 4, 23, 59, 59)),
        resolvedAt('eaten', new Date(2026, 9, 5, 0, 0, 0)),
      ];

      expect(eatenPerDay(getSummaryDays(items, NOW, 'week'))).toEqual({ '2026-10-05': 1 });
      expect(eatenPerDay(getSummaryDays(items, new Date(2026, 9, 4, 20, 0), 'week'))).toEqual({
        '2026-10-04': 1,
      });
    });

    it('keeps every day of the week the clocks went forward in, though it is 167 hours long', () => {
      const monday = new Date(2026, 8, 28);
      const nextMonday = new Date(2026, 9, 5);
      expect((nextMonday.getTime() - monday.getTime()) / (60 * 60 * 1000)).toBe(167);

      const items = [
        resolvedAt('eaten', new Date(2026, 8, 28, 0, 0, 0)),
        resolvedAt('eaten', new Date(2026, 9, 4, 12, 0, 0)),
        resolvedAt('eaten', new Date(2026, 9, 4, 23, 59, 59)),
        resolvedAt('eaten', new Date(2026, 9, 5, 0, 0, 0)),
      ];
      const days = getSummaryDays(items, new Date(2026, 9, 4, 20, 0), 'week');

      expect(days.map((day) => day.key)).toEqual([
        '2026-09-28',
        '2026-09-29',
        '2026-09-30',
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
      ]);
      expect(eatenPerDay(days)).toEqual({ '2026-09-28': 1, '2026-10-04': 2 });
    });

    it('starts each day at local midnight even after the clocks changed', () => {
      const days = getSummaryDays([], NOW, 'week');

      expect(days.every(({ date }) => date.getHours() === 0 && date.getMinutes() === 0)).toBe(true);
    });

    it('treats Sunday as the end of the week it is in', () => {
      const days = getSummaryDays([], new Date(2026, 9, 11, 23, 59), 'week');

      expect(days[0].key).toBe('2026-10-05');
      expect(days[6].key).toBe('2026-10-11');
    });

    it('drops outcomes from other weeks', () => {
      const items = [
        resolvedAt('eaten', new Date(2026, 8, 20, 12, 0)),
        resolvedAt('eaten', new Date(2026, 9, 12, 12, 0)),
      ];

      expect(sumOutcomes(getSummaryDays(items, NOW, 'week'))).toEqual({
        eaten: 0,
        donated: 0,
        discarded: 0,
      });
    });
  });

  describe('for a month', () => {
    it('runs from the 1st to the last day of the month', () => {
      const days = getSummaryDays([], NOW, 'month');

      expect(days).toHaveLength(31);
      expect(days[0].key).toBe('2026-10-01');
      expect(days[30].key).toBe('2026-10-31');
    });

    it('has 30 days in September, 28 in February and 29 in a leap February', () => {
      expect(getSummaryDays([], new Date(2026, 8, 15), 'month')).toHaveLength(30);
      expect(getSummaryDays([], new Date(2026, 1, 15), 'month')).toHaveLength(28);
      expect(getSummaryDays([], new Date(2028, 1, 15), 'month')).toHaveLength(29);
    });

    it('counts the first and last moments of the month and nothing just outside it', () => {
      const days = getSummaryDays(
        [
          resolvedAt('eaten', new Date(2026, 8, 30, 23, 59, 59)),
          resolvedAt('eaten', new Date(2026, 9, 1, 0, 0, 0)),
          resolvedAt('eaten', new Date(2026, 9, 31, 23, 59, 59)),
          resolvedAt('eaten', new Date(2026, 10, 1, 0, 0, 0)),
        ],
        NOW,
        'month',
      );

      expect(eatenPerDay(days)).toEqual({ '2026-10-01': 1, '2026-10-31': 1 });
    });

    it('counts the day the clocks went forward as one day', () => {
      const days = getSummaryDays(
        [
          resolvedAt('eaten', new Date(2026, 9, 4, 12, 0)),
          resolvedAt('eaten', new Date(2026, 9, 4, 3, 30)),
        ],
        NOW,
        'month',
      );

      expect(days.filter((day) => day.key === '2026-10-04')).toHaveLength(1);
      expect(eatenPerDay(days)).toEqual({ '2026-10-04': 2 });
    });
  });

  it('ignores active items, even with a timestamp', () => {
    const active = buildItem({ status: 'active', statusUpdatedAt: NOW.toISOString() });

    expect(sumOutcomes(getSummaryDays([active], NOW, 'week'))).toEqual({
      eaten: 0,
      donated: 0,
      discarded: 0,
    });
  });

  it('ignores a resolved item with no timestamp or an unreadable one', () => {
    const items = [
      buildItem({ status: 'eaten', statusUpdatedAt: undefined }),
      buildItem({ status: 'discarded', statusUpdatedAt: 'not a date' }),
    ];

    expect(sumOutcomes(getSummaryDays(items, NOW, 'month'))).toEqual({
      eaten: 0,
      donated: 0,
      discarded: 0,
    });
  });
});

describe('sumOutcomes', () => {
  it('adds up each kind of outcome across the days', () => {
    const days = getSummaryDays(
      [
        resolvedAt('eaten', new Date(2026, 9, 6, 9, 0)),
        resolvedAt('eaten', new Date(2026, 9, 9, 9, 0)),
        resolvedAt('donated', new Date(2026, 9, 7, 9, 0)),
        resolvedAt('discarded', new Date(2026, 9, 8, 9, 0)),
      ],
      NOW,
      'week',
    );

    expect(sumOutcomes(days)).toEqual({ eaten: 2, donated: 1, discarded: 1 });
  });
});

describe('getDiscardedItems', () => {
  it('lists only food thrown out on one of the days given', () => {
    const inWeek = resolvedAt('discarded', new Date(2026, 9, 6, 9, 0));
    const items = [
      inWeek,
      buildItem({
        id: 'old',
        status: 'discarded',
        statusUpdatedAt: new Date(2026, 8, 1).toISOString(),
      }),
      resolvedAt('eaten', new Date(2026, 9, 6, 9, 0)),
      buildItem({ id: 'no-date', status: 'discarded', statusUpdatedAt: undefined }),
      buildItem({ id: 'bad-date', status: 'discarded', statusUpdatedAt: 'not a date' }),
    ];

    expect(getDiscardedItems(items, getSummaryDays(items, NOW, 'week'))).toEqual([inWeek]);
  });

  it('lists the newest first, whatever order the inventory holds them in', () => {
    const monday = buildItem({
      id: 'monday',
      status: 'discarded',
      statusUpdatedAt: new Date(2026, 9, 5, 8, 0).toISOString(),
    });
    const tuesdayEvening = buildItem({
      id: 'tuesday-evening',
      status: 'discarded',
      statusUpdatedAt: new Date(2026, 9, 6, 20, 0).toISOString(),
    });
    const tuesdayMorning = buildItem({
      id: 'tuesday-morning',
      status: 'discarded',
      statusUpdatedAt: new Date(2026, 9, 6, 7, 0).toISOString(),
    });
    const items = [monday, tuesdayEvening, tuesdayMorning];

    expect(
      getDiscardedItems(items, getSummaryDays(items, NOW, 'week')).map((item) => item.id),
    ).toEqual(['tuesday-evening', 'tuesday-morning', 'monday']);
  });

  it('leaves the inventory it was given in its original order', () => {
    const older = buildItem({
      id: 'older',
      status: 'discarded',
      statusUpdatedAt: new Date(2026, 9, 5, 8, 0).toISOString(),
    });
    const newer = buildItem({
      id: 'newer',
      status: 'discarded',
      statusUpdatedAt: new Date(2026, 9, 6, 8, 0).toISOString(),
    });
    const items = [older, newer];

    getDiscardedItems(items, getSummaryDays(items, NOW, 'week'));

    expect(items).toEqual([older, newer]);
  });
});
