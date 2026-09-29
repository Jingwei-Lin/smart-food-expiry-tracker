import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';

import SavedRecipesScreen from '@/app/saved-recipes';
import { InventoryProvider } from '@/context/inventory-context';
import { FoodItem } from '@/types/food-item';
import { loadSavedRecipes, saveRecipe, SuggestedRecipe } from '@/utils/recipe-storage';

jest.mock('@/services/expiry-notifications', () => ({
  cancelExpiryReminders: jest.fn().mockResolvedValue(true),
  scheduleExpiryReminders: jest.fn().mockResolvedValue({ status: 'not-needed' }),
}));

const STORAGE_KEY = '@smart-food-expiry-tracker/inventory-v1';

/* Dates are relative to the day the tests run, so "expired" stays true. */
function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

function buildFood(id: string, name: string, daysLeft: number): FoodItem {
  return {
    id,
    name,
    quantity: '1 item',
    expiryDate: daysFromToday(daysLeft),
    reminderDaysBefore: 1,
    reminderRuleVersion: 2,
    notes: '',
    createdAt: '2026-09-01T00:00:00.000Z',
    status: 'active',
  };
}

const omelette: SuggestedRecipe = {
  id: 'omelette',
  title: 'Cheddar omelette',
  minutes: 10,
  usesIngredients: ['Cheddar', 'Eggs', 'Spinach'],
  extraIngredients: ['Chives'],
  steps: ['Beat the eggs.', 'Fold in the cheese.'],
};

const pasta: SuggestedRecipe = {
  id: 'pasta',
  title: 'Spinach pasta',
  minutes: 20,
  usesIngredients: ['Spinach'],
  extraIngredients: ['Pasta'],
  steps: ['Boil the pasta.'],
};

async function renderScreen(items: FoodItem[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));

  const view = await render(
    <InventoryProvider>
      <SavedRecipesScreen />
    </InventoryProvider>,
  );

  await view.findByText(/stay here until you remove them/);

  return view;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('SavedRecipesScreen', () => {
  it('explains that nothing is saved yet', async () => {
    const view = await renderScreen([]);

    expect(view.getByText('Nothing saved yet')).toBeTruthy();
    expect(view.getByText('Saved recipes stay here until you remove them.')).toBeTruthy();
  });

  it('lists every saved recipe, closed, with when it was saved', async () => {
    await saveRecipe(omelette);
    await saveRecipe(pasta);

    const view = await renderScreen([]);

    expect(
      view.getByText(
        '2 recipes saved. They stay here until you remove them, even when you ask for new ideas.',
      ),
    ).toBeTruthy();
    expect(view.getByText('20 min · Saved today')).toBeTruthy();
    expect(view.getByText('Cheddar omelette')).toBeTruthy();
    expect(view.queryByText('Boil the pasta.')).toBeNull();
  });

  it('opens one card at a time', async () => {
    await saveRecipe(omelette);
    await saveRecipe(pasta);
    const view = await renderScreen([]);

    await fireEvent.press(view.getByText('Spinach pasta'));

    expect(view.getByText('Boil the pasta.')).toBeTruthy();
    expect(view.getByText('Pasta')).toBeTruthy();

    await fireEvent.press(view.getByText('Cheddar omelette'));

    expect(view.getByText('Beat the eggs.')).toBeTruthy();
    expect(view.queryByText('Boil the pasta.')).toBeNull();
  });

  it('marks each ingredient against the inventory now, and warns about expired food', async () => {
    await saveRecipe(omelette);
    const view = await renderScreen([
      buildFood('spinach', 'Spinach', 2),
      buildFood('cheddar', 'Cheddar', -1),
    ]);

    expect(view.getByText('Spinach')).toBeTruthy();
    expect(view.getByText('Cheddar · expired')).toBeTruthy();
    expect(view.getByText('Eggs · not in stock')).toBeTruthy();

    await fireEvent.press(view.getByText('Cheddar omelette'));

    expect(
      view.getByText(
        'Your Cheddar is now past its date. Check it looks and smells fine before cooking with it.',
      ),
    ).toBeTruthy();
  });

  it('removes a recipe, then updates the list and the count', async () => {
    await saveRecipe(omelette);
    await saveRecipe(pasta);
    const view = await renderScreen([]);

    await fireEvent.press(view.getByText('Spinach pasta'));
    await fireEvent.press(view.getByText('Remove from saved'));

    expect(
      await view.findByText(
        '1 recipe saved. They stay here until you remove them, even when you ask for new ideas.',
      ),
    ).toBeTruthy();
    expect(view.queryByText('Spinach pasta')).toBeNull();
    expect((await loadSavedRecipes()).map((entry) => entry.id)).toEqual(['omelette']);
  });
});
