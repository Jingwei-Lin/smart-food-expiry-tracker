import { describeExpiredInRecipe, describeExpiredTicked } from '@/utils/expired-warnings';

describe('describeExpiredTicked', () => {
  it('names one expired food', () => {
    expect(describeExpiredTicked(['Cheddar'])).toBe(
      'Cheddar is past its date. Check it looks and smells fine before cooking with it.',
    );
  });

  it('names several expired foods in one sentence', () => {
    expect(describeExpiredTicked(['Cheddar', 'Milk', 'Ham'])).toBe(
      'Cheddar, Milk and Ham are past their date. Check they look and smell fine before cooking with them.',
    );
  });
});

describe('describeExpiredInRecipe', () => {
  it('names the expired food a recipe uses', () => {
    expect(describeExpiredInRecipe(['Cheddar'])).toBe(
      'Uses Cheddar, which is past its date. Check it looks and smells fine before cooking with it.',
    );
  });

  it('names two expired foods with "and"', () => {
    expect(describeExpiredInRecipe(['Cheddar', 'Milk'])).toBe(
      'Uses Cheddar and Milk, which are past their date. Check they look and smell fine before cooking with them.',
    );
  });
});
