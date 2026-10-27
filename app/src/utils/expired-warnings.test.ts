import {
  describeExpiredInRecipe,
  describeExpiredTicked,
  joinNames,
} from '@/utils/expired-warnings';

describe('joinNames', () => {
  it('joins names with commas and a final "and"', () => {
    expect(joinNames(['Milk'])).toBe('Milk');
    expect(joinNames(['Milk', 'Spinach'])).toBe('Milk and Spinach');
    expect(joinNames(['Milk', 'Spinach', 'Eggs'])).toBe('Milk, Spinach and Eggs');
  });

  it('gives an empty string for no names', () => {
    expect(joinNames([])).toBe('');
  });
});

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
