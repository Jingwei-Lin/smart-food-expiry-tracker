import { describeSavedDate } from '@/utils/saved-recipes';

const today = new Date(2026, 8, 29, 12, 0, 0);

describe('describeSavedDate', () => {
  it('says "today" for a recipe saved today', () => {
    expect(describeSavedDate(new Date(2026, 8, 29, 8, 0, 0).toISOString(), today)).toBe(
      'Saved today',
    );
  });

  it('names the day for an earlier save', () => {
    expect(describeSavedDate(new Date(2026, 8, 25, 18, 0, 0).toISOString(), today)).toMatch(
      /^Saved 25 Sept?$/,
    );
  });
});
