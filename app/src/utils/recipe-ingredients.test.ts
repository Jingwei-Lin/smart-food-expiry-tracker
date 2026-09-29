import { FoodItem } from '@/types/food-item';
import {
  defaultRecipeSelection,
  listRecipeCandidates,
  MAX_RECIPE_INGREDIENTS,
  RecipeCandidate,
  selectAllRecipeCandidates,
  toggleRecipeCandidate,
  toRecipeIngredients,
} from '@/utils/recipe-ingredients';

const today = new Date(2026, 8, 17);

function buildFood(
  id: string,
  expiryDate: string,
  overrides: Partial<Pick<FoodItem, 'name' | 'status'>> = {},
): Pick<FoodItem, 'id' | 'name' | 'expiryDate' | 'status'> {
  return { id, name: id, expiryDate, status: 'active', ...overrides };
}

function buildCandidate(id: string, daysLeft: number, name = id): RecipeCandidate {
  return { id, name, daysLeft };
}

/* Twelve unexpired candidates, most urgent first: one more than the limit, and then one. */
function buildManyCandidates(): RecipeCandidate[] {
  return Array.from({ length: MAX_RECIPE_INGREDIENTS + 2 }, (_, index) =>
    buildCandidate(`food-${index}`, index),
  );
}

describe('listRecipeCandidates', () => {
  it('puts expired food first and unreadable dates last', () => {
    const candidates = listRecipeCandidates(
      [
        buildFood('next-week', '2026-09-24'),
        buildFood('mystery', 'whenever'),
        buildFood('today', '2026-09-17'),
        buildFood('overdue', '2026-09-15'),
      ],
      today,
    );

    expect(candidates).toEqual([
      { id: 'overdue', name: 'overdue', daysLeft: -2 },
      { id: 'today', name: 'today', daysLeft: 0 },
      { id: 'next-week', name: 'next-week', daysLeft: 7 },
      { id: 'mystery', name: 'mystery', daysLeft: Number.POSITIVE_INFINITY },
    ]);
  });

  it('keeps two unreadable dates in their stored order instead of scrambling the list', () => {
    const candidates = listRecipeCandidates(
      [
        buildFood('first-mystery', 'soon'),
        buildFood('today', '2026-09-17'),
        buildFood('second-mystery', 'later'),
      ],
      today,
    );

    expect(candidates.map((candidate) => candidate.id)).toEqual([
      'today',
      'first-mystery',
      'second-mystery',
    ]);
  });

  it('leaves out food that has already been eaten or thrown out', () => {
    const candidates = listRecipeCandidates(
      [
        buildFood('eaten', '2026-09-18', { status: 'eaten' }),
        buildFood('discarded', '2026-09-18', { status: 'discarded' }),
        buildFood('in-the-fridge', '2026-09-18'),
      ],
      today,
    );

    expect(candidates.map((candidate) => candidate.id)).toEqual(['in-the-fridge']);
  });

  it('gives two items with the same name a row each', () => {
    const candidates = listRecipeCandidates(
      [
        buildFood('older-milk', '2026-09-18', { name: 'Milk' }),
        buildFood('newer-milk', '2026-09-25', { name: 'Milk' }),
      ],
      today,
    );

    expect(candidates.map((candidate) => candidate.id)).toEqual(['older-milk', 'newer-milk']);
  });
});

describe('defaultRecipeSelection', () => {
  it('ticks food with zero to three days left, and not food with four', () => {
    const candidates = listRecipeCandidates(
      [
        buildFood('today', '2026-09-17'),
        buildFood('in-three-days', '2026-09-20'),
        buildFood('in-four-days', '2026-09-21'),
      ],
      today,
    );

    expect(defaultRecipeSelection(candidates)).toEqual(['today', 'in-three-days']);
  });

  it('never ticks expired food', () => {
    const candidates = listRecipeCandidates(
      [buildFood('overdue', '2026-09-16'), buildFood('today', '2026-09-17')],
      today,
    );

    expect(defaultRecipeSelection(candidates)).toEqual(['today']);
  });

  it('ticks at most the ten most urgent', () => {
    const candidates = Array.from({ length: MAX_RECIPE_INGREDIENTS + 2 }, (_, index) =>
      buildCandidate(`today-${index}`, 0),
    );

    const selected = defaultRecipeSelection(candidates);

    expect(selected).toHaveLength(MAX_RECIPE_INGREDIENTS);
    expect(selected[0]).toBe('today-0');
  });

  it('ticks nothing when nothing is close to its date', () => {
    expect(defaultRecipeSelection([buildCandidate('next-month', 30)])).toEqual([]);
  });
});

describe('selectAllRecipeCandidates', () => {
  it('skips expired food but keeps food whose date cannot be read', () => {
    const candidates = [
      buildCandidate('overdue', -1),
      buildCandidate('today', 0),
      buildCandidate('mystery', Number.POSITIVE_INFINITY),
    ];

    expect(selectAllRecipeCandidates(candidates)).toEqual(['today', 'mystery']);
  });

  it('stops at the ten most urgent', () => {
    const selected = selectAllRecipeCandidates(buildManyCandidates());

    expect(selected).toHaveLength(MAX_RECIPE_INGREDIENTS);
    expect(selected).not.toContain('food-10');
    expect(selected).not.toContain('food-11');
  });
});

describe('toggleRecipeCandidate', () => {
  it('ticks an unticked food', () => {
    expect(toggleRecipeCandidate(['milk'], 'spinach')).toEqual(['milk', 'spinach']);
  });

  it('unticks a ticked food', () => {
    expect(toggleRecipeCandidate(['milk', 'spinach'], 'milk')).toEqual(['spinach']);
  });

  it('ignores an eleventh tick but still allows unticking at the limit', () => {
    const full = selectAllRecipeCandidates(buildManyCandidates());

    expect(toggleRecipeCandidate(full, 'food-11')).toEqual(full);
    expect(toggleRecipeCandidate(full, 'food-0')).toHaveLength(MAX_RECIPE_INGREDIENTS - 1);
  });

  it('returns a new list instead of changing the one it was given', () => {
    const selected = ['milk'];

    toggleRecipeCandidate(selected, 'spinach');

    expect(selected).toEqual(['milk']);
  });
});

describe('toRecipeIngredients', () => {
  it('lists only the ticked food, most urgent first', () => {
    const candidates = [
      buildCandidate('cheddar', -2, 'Cheddar'),
      buildCandidate('spinach', 0, 'Spinach'),
      buildCandidate('eggs', 6, 'Eggs'),
    ];

    expect(toRecipeIngredients(candidates, ['eggs', 'cheddar'])).toEqual([
      { name: 'Cheddar', daysLeft: -2 },
      { name: 'Eggs', daysLeft: 6 },
    ]);
  });

  it('merges food with the same name and keeps the more urgent date', () => {
    const candidates = [
      buildCandidate('older-milk', 1, 'Milk'),
      buildCandidate('newer-milk', 8, ' milk '),
    ];

    expect(toRecipeIngredients(candidates, ['older-milk', 'newer-milk'])).toEqual([
      { name: 'Milk', daysLeft: 1 },
    ]);
  });

  it('returns nothing when nothing is ticked', () => {
    expect(toRecipeIngredients([buildCandidate('milk', 1)], [])).toEqual([]);
  });
});
