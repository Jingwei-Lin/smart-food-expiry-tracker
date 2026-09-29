import AsyncStorage from '@react-native-async-storage/async-storage';

import { Recipe } from '@/utils/recipe-prompt';
import {
  loadRecipeSnapshot,
  loadSavedRecipes,
  RecipeScreenSnapshot,
  saveRecipe,
  saveRecipeSnapshot,
  SuggestedRecipe,
  toSuggestedRecipes,
  unsaveRecipe,
} from '@/utils/recipe-storage';

const SNAPSHOT_KEY = '@smart-food-expiry-tracker/recipes-screen-v1';
const SAVED_KEY = '@smart-food-expiry-tracker/recipes-saved-v1';

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

describe('saved recipes', () => {
  const pasta: SuggestedRecipe = { ...recipe, id: 'r-2', title: 'Spinach pasta' };

  it('starts empty', async () => {
    await expect(loadSavedRecipes()).resolves.toEqual([]);
  });

  it('saves a copy of the recipe, newest first, and reads it back', async () => {
    await saveRecipe(omelette, new Date('2026-09-28T09:00:00.000Z'));
    const saved = await saveRecipe(pasta, new Date('2026-09-29T09:00:00.000Z'));

    expect(saved).toEqual([
      {
        id: 'r-2',
        savedAt: '2026-09-29T09:00:00.000Z',
        recipe: { ...recipe, title: 'Spinach pasta' },
      },
      { id: 'r-1', savedAt: '2026-09-28T09:00:00.000Z', recipe },
    ]);
    await expect(loadSavedRecipes()).resolves.toEqual(saved);
  });

  it('changes nothing when a recipe is saved twice', async () => {
    await saveRecipe(omelette);
    await saveRecipe(omelette);

    await expect(loadSavedRecipes()).resolves.toHaveLength(1);
  });

  it('removes only the recipe asked for', async () => {
    await saveRecipe(omelette);
    await saveRecipe(pasta);

    const saved = await unsaveRecipe('r-1');

    expect(saved.map((entry) => entry.id)).toEqual(['r-2']);
    await expect(loadSavedRecipes()).resolves.toEqual(saved);
  });

  it('drops entries that cannot be read, and treats a broken list as empty', async () => {
    await AsyncStorage.setItem(
      SAVED_KEY,
      JSON.stringify([
        { id: 'r-1', savedAt: '2026-09-29T09:00:00.000Z', recipe },
        { id: 'r-2', savedAt: '2026-09-29T09:00:00.000Z', recipe: { title: 'No steps' } },
        { id: 'r-3', recipe },
      ]),
    );

    await expect(loadSavedRecipes()).resolves.toEqual([
      { id: 'r-1', savedAt: '2026-09-29T09:00:00.000Z', recipe },
    ]);

    await AsyncStorage.setItem(SAVED_KEY, '{ not json');

    await expect(loadSavedRecipes()).resolves.toEqual([]);
  });
});
