import AsyncStorage from '@react-native-async-storage/async-storage';

import { Recipe } from '@/utils/recipe-prompt';
import {
  loadRecipeSnapshot,
  RecipeScreenSnapshot,
  saveRecipeSnapshot,
  SuggestedRecipe,
  toSuggestedRecipes,
} from '@/utils/recipe-storage';

const SNAPSHOT_KEY = '@smart-food-expiry-tracker/recipes-screen-v1';

const recipe: Recipe = {
  title: 'Spinach omelette',
  minutes: 10,
  usesIngredients: ['Spinach'],
  extraIngredients: ['Eggs'],
  steps: ['Wilt the spinach.', 'Add the beaten eggs.'],
};

const omelette: SuggestedRecipe = { ...recipe, id: 'r-1' };

const snapshot: RecipeScreenSnapshot = {
  selectedIds: ['spinach', 'milk'],
  lastResult: { recipes: [omelette], forNames: ['Spinach', 'Milk'] },
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('toSuggestedRecipes', () => {
  it('gives every recipe its own id and leaves the recipe itself unchanged', () => {
    const suggested = toSuggestedRecipes([recipe, { ...recipe, title: 'Spinach pasta' }]);

    expect(suggested[0]).toEqual({ ...recipe, id: expect.any(String) });
    expect(suggested[1].title).toBe('Spinach pasta');
    expect(suggested[0].id).not.toBe(suggested[1].id);
  });
});

describe('loadRecipeSnapshot and saveRecipeSnapshot', () => {
  it('reads back what was saved', async () => {
    await saveRecipeSnapshot(snapshot);

    await expect(loadRecipeSnapshot()).resolves.toEqual(snapshot);
  });

  it('keeps ticks with no result yet', async () => {
    await saveRecipeSnapshot({ selectedIds: ['spinach'], lastResult: null });

    await expect(loadRecipeSnapshot()).resolves.toEqual({
      selectedIds: ['spinach'],
      lastResult: null,
    });
  });

  it('returns null when nothing has been saved', async () => {
    await expect(loadRecipeSnapshot()).resolves.toBeNull();
  });

  it.each([
    ['broken JSON', '{ not json'],
    ['the wrong shape', JSON.stringify(['spinach'])],
    ['ticks that are not strings', JSON.stringify({ selectedIds: [1, 2], lastResult: null })],
  ])('treats %s as nothing saved', async (_, stored) => {
    await AsyncStorage.setItem(SNAPSHOT_KEY, stored);

    await expect(loadRecipeSnapshot()).resolves.toBeNull();
  });

  it('drops a malformed recipe and keeps the rest', async () => {
    await AsyncStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        selectedIds: ['spinach'],
        lastResult: {
          recipes: [omelette, { ...omelette, id: 'r-2', minutes: 'ten' }],
          forNames: ['Spinach'],
        },
      }),
    );

    const loaded = await loadRecipeSnapshot();

    expect(loaded?.lastResult?.recipes).toEqual([omelette]);
  });

  it('keeps the ticks but drops a result with no readable recipe', async () => {
    await AsyncStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        selectedIds: ['spinach'],
        lastResult: { recipes: [{ title: 'No id or steps' }], forNames: ['Spinach'] },
      }),
    );

    await expect(loadRecipeSnapshot()).resolves.toEqual({
      selectedIds: ['spinach'],
      lastResult: null,
    });
  });
});
