import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import RecipeDetailScreen from '@/app/recipe/[id]';
import type { FoodItem } from '@/types/food-item';
import {
  loadSavedRecipes,
  saveRecipe,
  saveRecipeSnapshot,
  type SuggestedRecipe,
} from '@/utils/recipe-storage';

/* The route's params, as a recipe card passes them. */
const mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockInventory: { activeItems: FoodItem[]; resolveItem: jest.Mock } = {
  activeItems: [],
  resolveItem: jest.fn(),
};

jest.mock('@/context/inventory-context', () => ({
  useInventory: () => mockInventory,
}));

/* Dates are relative to the day the tests run, so "expired" and "today" stay true. */
function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

function food(id: string, name: string, daysLeft: number): FoodItem {
  return {
    id,
    name,
    quantity: '1',
    expiryDate: daysFromToday(daysLeft),
    storageLocation: 'fridge',
    category: 'Others',
    reminderDaysBefore: 1,
    reminderRuleVersion: 2,
    notes: '',
    createdAt: '2026-10-01T00:00:00.000Z',
    status: 'active',
  };
}

const omelette: SuggestedRecipe = {
  id: 'omelette-1',
  title: 'Spinach omelette',
  minutes: 15,
  usesIngredients: ['Spinach', 'Eggs', 'Milk'],
  extraIngredients: ['Butter', 'Salt'],
  steps: ['Wilt the spinach.', 'Whisk the eggs with the milk.', 'Cook until set.'],
};

/** Puts the omelette in the last suggestions, as the Recipes tab does, and opens it. */
async function openOmelette() {
  await saveRecipeSnapshot({
    selectedIds: [],
    lastResult: { recipes: [omelette], forNames: ['Spinach', 'Milk'] },
  });
  mockParams.id = omelette.id;

  const view = await render(<RecipeDetailScreen />);
  await view.findByRole('header', { name: 'Spinach omelette' });

  return view;
}

beforeEach(async () => {
  jest.clearAllMocks();
  // Each test starts with nothing suggested or saved.
  await AsyncStorage.clear();

  for (const key of Object.keys(mockParams)) {
    delete mockParams[key];
  }

  // Two spinach: the one going off first is the one a recipe uses.
  mockInventory.activeItems = [
    food('spinach-soon', 'Spinach', 1),
    food('milk', 'Milk', 2),
    food('spinach-later', 'Spinach', 6),
    food('bread', 'Bread', 3),
  ];
  mockInventory.resolveItem.mockResolvedValue(undefined);
});

describe('RecipeDetailScreen', () => {
  it('shows the time, what it uses, what else it needs and the numbered steps', async () => {
    const view = await openOmelette();

    expect(view.getByText('15 min')).toBeTruthy();
    expect(view.getByText('FROM YOUR FRIDGE')).toBeTruthy();
    // In the fridge, plain; not in the fridge, labelled so.
    expect(view.getByText('Milk')).toBeTruthy();
    expect(view.getByText('Eggs · not in stock')).toBeTruthy();
    expect(view.getByText('Butter')).toBeTruthy();
    expect(view.getByText('Salt')).toBeTruthy();
    expect(view.getByText('1')).toBeTruthy();
    expect(view.getByText('Whisk the eggs with the milk.')).toBeTruthy();
    expect(view.getByText('3')).toBeTruthy();
  });

  it('opens a saved recipe after new ideas have replaced its card', async () => {
    await saveRecipe(omelette);
    await saveRecipeSnapshot({ selectedIds: [], lastResult: null });
    mockParams.id = omelette.id;

    const view = await render(<RecipeDetailScreen />);

    expect(await view.findByRole('header', { name: 'Spinach omelette' })).toBeTruthy();
    expect(view.getByLabelText('Remove Spinach omelette from saved recipes')).toBeTruthy();
  });

  it('explains when the recipe is no longer kept', async () => {
    mockParams.id = 'gone';

    const view = await render(<RecipeDetailScreen />);

    expect(await view.findByText("This recipe isn't here any more")).toBeTruthy();
  });

  it('warns about food that has expired since the recipe was suggested', async () => {
    mockInventory.activeItems = [food('milk', 'Milk', -1)];
    const view = await openOmelette();

    expect(view.getByText(/^Uses Milk, which is past its date/)).toBeTruthy();
    expect(view.getByText('Milk · expired')).toBeTruthy();
  });

  it('saves the recipe from the star, and removes it again', async () => {
    const view = await openOmelette();

    await fireEvent.press(view.getByLabelText('Save Spinach omelette'));
    await view.findByLabelText('Remove Spinach omelette from saved recipes');
    expect((await loadSavedRecipes()).map((entry) => entry.id)).toEqual(['omelette-1']);

    await fireEvent.press(view.getByLabelText('Remove Spinach omelette from saved recipes'));
    await view.findByLabelText('Save Spinach omelette');
    expect(await loadSavedRecipes()).toEqual([]);
  });

  it('goes back', async () => {
    const view = await openOmelette();

    await fireEvent.press(view.getByLabelText('Back'));

    expect(router.back).toHaveBeenCalled();
  });
});

describe('RecipeDetailScreen marking the food', () => {
  it('shows just the two buttons, and changes nothing until one is pressed', async () => {
    const view = await openOmelette();

    expect(view.getByText('Mark as wasted')).toBeTruthy();
    expect(view.getByText('Mark as consumed')).toBeTruthy();
    expect(view.queryByText(/in your fridge\./)).toBeNull();
    expect(mockInventory.resolveItem).not.toHaveBeenCalled();
  });

  it('marks the soonest matching food as eaten, skipping food not in the fridge', async () => {
    const view = await openOmelette();

    await fireEvent.press(view.getByText('Mark as consumed'));

    expect(mockInventory.resolveItem.mock.calls).toEqual([
      ['spinach-soon', 'eaten'],
      ['milk', 'eaten'],
    ]);
    expect(await view.findByText(/Spinach and Milk are marked as eaten/)).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Done' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('marks the fresh milk, not an expired carton, and does not warn about it', async () => {
    mockInventory.activeItems = [
      food('old-milk', 'Milk', -2),
      food('spinach-soon', 'Spinach', 1),
      food('new-milk', 'Milk', 4),
    ];
    const view = await openOmelette();

    expect(view.queryByText('Milk · expired')).toBeNull();
    expect(view.getByRole('button', { name: 'Mark Spinach and Milk as eaten' })).toBeTruthy();

    await fireEvent.press(view.getByText('Mark as consumed'));

    expect(mockInventory.resolveItem.mock.calls).toEqual([
      ['spinach-soon', 'eaten'],
      ['new-milk', 'eaten'],
    ]);
  });

  it('says "Saving…" only on the button that was pressed', async () => {
    mockInventory.resolveItem.mockReturnValue(new Promise(() => undefined));
    const view = await openOmelette();

    await fireEvent.press(view.getByText('Mark as wasted'));

    expect(view.getByText('Mark as consumed')).toBeTruthy();
    expect(view.queryByText('Mark as wasted')).toBeNull();
    expect(view.getByText('Saving…')).toBeTruthy();
  });

  it('marks the food as thrown out when it was wasted', async () => {
    const view = await openOmelette();

    await fireEvent.press(view.getByText('Mark as wasted'));

    expect(mockInventory.resolveItem.mock.calls).toEqual([
      ['spinach-soon', 'discarded'],
      ['milk', 'discarded'],
    ]);
    expect(await view.findByText(/Spinach and Milk are marked as thrown out/)).toBeTruthy();
  });

  it('says so and keeps the buttons when saving fails', async () => {
    mockInventory.resolveItem.mockRejectedValue(new Error('Unable to save inventory.'));
    const view = await openOmelette();

    await fireEvent.press(view.getByText('Mark as consumed'));

    expect(await view.findByText("Some food couldn't be updated. Please try again.")).toBeTruthy();
    expect(view.getByText('Mark as consumed')).toBeTruthy();
  });

  it('offers no buttons when none of the food is in the fridge', async () => {
    mockInventory.activeItems = [food('bread', 'Bread', 3)];
    const view = await openOmelette();

    expect(view.getByText("None of this recipe's food is in your fridge now.")).toBeTruthy();
    expect(view.queryByText('Mark as consumed')).toBeNull();
  });
});
