import { addDaysToToday, estimateShelfLife } from '@/utils/shelf-life';

describe('estimateShelfLife', () => {
  it('matches a category whatever language prefix its tag carries', () => {
    expect(estimateShelfLife(['fr:produits-laitiers', 'en:milks'])).toEqual({
      days: 7,
      label: 'milk',
    });
  });

  it('prefers the more perishable category when a product sits in several', () => {
    expect(estimateShelfLife(['en:groceries', 'en:fresh-vegetables'])).toEqual({
      days: 5,
      label: 'fresh vegetables',
    });
  });

  it.each([
    [['en:fresh-meats'], 3],
    [['en:seafood'], 2],
    [['en:frozen-foods'], 90],
    [['en:canned-foods'], 365],
  ])('estimates %p as %p days', (tags, days) => {
    expect(estimateShelfLife(tags)?.days).toBe(days);
  });

  it('returns nothing for a product with no categories, so no date is invented', () => {
    expect(estimateShelfLife([])).toBeNull();
    expect(estimateShelfLife(['en:something-we-do-not-know'])).toBeNull();
  });
});

describe('addDaysToToday', () => {
  it('writes the date in the format the add form expects', () => {
    expect(addDaysToToday(7, new Date(2026, 8, 17))).toBe('2026-09-24');
  });

  it('rolls over the end of a month and a year', () => {
    expect(addDaysToToday(5, new Date(2026, 8, 29))).toBe('2026-10-04');
    expect(addDaysToToday(30, new Date(2026, 11, 20))).toBe('2027-01-19');
  });
});
