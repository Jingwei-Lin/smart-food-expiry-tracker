import { describeSavedDate, stockStatus } from '@/utils/saved-recipes';

const today = new Date(2026, 8, 29, 12, 0, 0);

function item(name: string, expiryDate: string, status: 'active' | 'eaten' = 'active') {
  return { name, expiryDate, status };
}

describe('stockStatus', () => {
  it('is in stock when an active item of that name is still in date', () => {
    expect(stockStatus('Spinach', [item('Spinach', '2026-10-01')], today)).toBe('in-stock');
  });

  it('is expired when every matching item is past its date', () => {
    expect(stockStatus('Cheddar', [item('Cheddar', '2026-09-27')], today)).toBe('expired');
  });

  it('is in stock when one matching item is fresh and another has expired', () => {
    expect(
      stockStatus('Milk', [item('Milk', '2026-09-20'), item('Milk', '2026-10-02')], today),
    ).toBe('in-stock');
  });

  it('is not in stock when no active item has that name', () => {
    expect(
      stockStatus(
        'Eggs',
        [item('Spinach', '2026-10-01'), item('Eggs', '2026-10-01', 'eaten')],
        today,
      ),
    ).toBe('not-in-stock');
  });

  it('matches names without regard to case or spaces', () => {
    expect(stockStatus(' greek YOGHURT ', [item('Greek yoghurt', '2026-10-01')], today)).toBe(
      'in-stock',
    );
  });
});

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
