import {
  daysUntilExpiry,
  formatExpiryDate,
  formatExpiryDateInput,
  getExpiryListPresentation,
  getExpiryPresentation,
  parseExpiryDate,
} from '@/utils/expiry-date';

const today = new Date(2026, 8, 17);

describe('parseExpiryDate', () => {
  it('reads a well-formed date', () => {
    expect(parseExpiryDate('2026-09-17')).toEqual(new Date(2026, 8, 17));
  });

  it.each(['', '2026-9-17', '17-09-2026', '20260917', 'soon'])(
    'rejects %p rather than guessing at it',
    (value) => {
      expect(parseExpiryDate(value)).toBeNull();
    },
  );

  it('rejects a day that does not exist in that month', () => {
    expect(parseExpiryDate('2026-02-30')).toBeNull();
    expect(parseExpiryDate('2026-13-01')).toBeNull();
  });
});

describe('formatExpiryDateInput', () => {
  it('inserts the separators as digits are typed', () => {
    expect(formatExpiryDateInput('2026')).toBe('2026');
    expect(formatExpiryDateInput('20260')).toBe('2026-0');
    expect(formatExpiryDateInput('20260917')).toBe('2026-09-17');
  });

  it('lets a typed date be deleted a character at a time', () => {
    expect(formatExpiryDateInput('2026-09-1')).toBe('2026-09-1');
    expect(formatExpiryDateInput('2026-09')).toBe('2026-09');
    expect(formatExpiryDateInput('2026-0')).toBe('2026-0');
    expect(formatExpiryDateInput('2026')).toBe('2026');
  });

  it('ignores anything that is not a digit, and stops at eight of them', () => {
    expect(formatExpiryDateInput('2026-09-17')).toBe('2026-09-17');
    expect(formatExpiryDateInput('202609170000')).toBe('2026-09-17');
    expect(formatExpiryDateInput('abc')).toBe('');
  });
});

describe('daysUntilExpiry', () => {
  it.each([
    ['2026-09-17', 0],
    ['2026-09-18', 1],
    ['2026-09-24', 7],
    ['2026-09-15', -2],
  ])('counts %p as %p days away', (value, expected) => {
    expect(daysUntilExpiry(value, today)).toBe(expected);
  });

  it('counts whole calendar days, whatever time of day it is', () => {
    const lateEvening = new Date(2026, 8, 17, 23, 30);

    expect(daysUntilExpiry('2026-09-18', lateEvening)).toBe(1);
  });

  it('treats an unreadable date as infinitely far away, so it sorts last', () => {
    expect(daysUntilExpiry('whenever', today)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('formatExpiryDate', () => {
  it('writes a stored date the way it is shown on screen', () => {
    expect(formatExpiryDate('2026-09-17')).toBe('17 Sept 2026');
  });

  it('shows an unreadable value as it was stored, rather than inventing a date', () => {
    expect(formatExpiryDate('whenever')).toBe('whenever');
  });
});

describe('getExpiryPresentation', () => {
  it.each([
    ['2026-09-15', 'Expired 2 days ago'],
    ['2026-09-16', 'Expired 1 day ago'],
    ['2026-09-17', 'Expires today'],
    ['2026-09-18', 'Expires tomorrow'],
    ['2026-09-20', '3 days left'],
  ])('describes %p as %p', (value, label) => {
    jest.useFakeTimers().setSystemTime(today);

    expect(getExpiryPresentation(value).label).toBe(label);

    jest.useRealTimers();
  });
});

describe('getExpiryListPresentation', () => {
  it.each([
    ['2026-09-15', '2 days over'],
    ['2026-09-17', 'Today'],
    ['2026-09-18', 'Tomorrow'],
    ['2026-09-19', 'Sat'],
    ['2026-09-29', '29 Sept'],
  ])('shows %p in the list as %p', (value, meta) => {
    expect(getExpiryListPresentation(value, today).meta).toBe(meta);
  });

  it('warns rather than showing nothing when the date cannot be read', () => {
    expect(getExpiryListPresentation('whenever', today).meta).toBe('No date');
  });
});
