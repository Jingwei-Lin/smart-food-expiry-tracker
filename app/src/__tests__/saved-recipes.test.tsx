import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import SavedRecipesScreen from '@/app/saved-recipes';
import { InventoryProvider } from '@/context/inventory-context';
import { FoodItem } from '@/types/food-item';
import {
  loadSavedRecipes,
  saveRecipe,
  SuggestedRecipe,
  unsaveRecipe,
} from '@/utils/recipe-storage';

jest.mock('@/services/expiry-notifications', () => ({
  cancelExpiryReminders: jest.fn().mockResolvedValue(true),
  scheduleExpiryReminders: jest.fn().mockResolvedValue({ status: 'not-needed' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

/* The latest focus effect, so a test can bring the screen back into view. */
const mockFocus: { effect: (() => void | (() => void)) | null } = { effect: null };

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');

  return {
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
    useFocusEffect: (effect: () => void | (() => void)) =>
      useEffect(() => {
        mockFocus.effect = effect;

        return effect();
      }, [effect]),
  };
});

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
    storageLocation: 'fridge',
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

async function renderScreen(items: FoodItem[] = []) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));

  return render(
    <InventoryProvider>
      <SavedRecipesScreen />
    </InventoryProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('SavedRecipesScreen', () => {
  it('explains that nothing is saved yet, without a search box', async () => {
    const view = await renderScreen();

    expect(await view.findByText('Nothing saved yet')).toBeTruthy();
    expect(view.getByText(/Saved recipes stay here until you remove them/)).toBeTruthy();
    expect(view.queryByLabelText('Search saved recipes')).toBeNull();
  });

  it('lists every saved recipe, newest first, with its time and when it was saved', async () => {
    await saveRecipe(omelette);
    await saveRecipe(pasta);

    const view = await renderScreen();

    expect(await view.findByText('Spinach pasta')).toBeTruthy();
    expect(view.getAllByRole('header').map((node) => node.props.children)).toEqual([
      'Saved recipes',
      'Spinach pasta',
      'Cheddar omelette',
    ]);
    expect(view.getByText('20 min · Saved today')).toBeTruthy();
    expect(view.getByText('Also needs Chives')).toBeTruthy();
    // The steps are on the recipe's own screen.
    expect(view.queryByText('Boil the pasta.')).toBeNull();
  });

  it("opens a recipe's own screen from its card", async () => {
    await saveRecipe(omelette);
    await saveRecipe(pasta);
    const view = await renderScreen();

    await fireEvent.press(await view.findByText('Cheddar omelette'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recipe/[id]',
      params: { id: 'omelette', tint: '1' },
    });
  });

  it('warns on the card about food that has expired since the recipe was saved', async () => {
    await saveRecipe(omelette);
    const view = await renderScreen([
      buildFood('spinach', 'Spinach', 2),
      buildFood('cheddar', 'Cheddar', -1),
    ]);

    expect(await view.findByText(/^Uses Cheddar, which is past its date/)).toBeTruthy();
  });

  it('removes a recipe with its star, and Undo puts it back', async () => {
    await saveRecipe(omelette);
    await saveRecipe(pasta);
    const view = await renderScreen();

    await fireEvent.press(await view.findByLabelText('Remove Spinach pasta from saved recipes'));

    expect(await view.findByText('Removed Spinach pasta')).toBeTruthy();
    expect(view.queryByRole('header', { name: 'Spinach pasta' })).toBeNull();
    expect((await loadSavedRecipes()).map((entry) => entry.id)).toEqual(['omelette']);

    await fireEvent.press(view.getByRole('button', { name: 'Undo' }));

    expect(await view.findByRole('header', { name: 'Spinach pasta' })).toBeTruthy();
    expect(view.queryByText('Removed Spinach pasta')).toBeNull();
    expect((await loadSavedRecipes()).map((entry) => entry.id).sort()).toEqual([
      'omelette',
      'pasta',
    ]);
  });

  it('shows the last recipe being removed as the empty state', async () => {
    await saveRecipe(pasta);
    const view = await renderScreen();

    await fireEvent.press(await view.findByLabelText('Remove Spinach pasta from saved recipes'));

    expect(await view.findByText('Nothing saved yet')).toBeTruthy();
  });

  it('finds recipes by name or by any ingredient, ignoring case', async () => {
    await saveRecipe(omelette);
    await saveRecipe(pasta);
    const view = await renderScreen();
    await view.findByText('Spinach pasta');
    const search = view.getByLabelText('Search saved recipes');

    await fireEvent.changeText(search, 'CHIVES');
    expect(view.getByText('Cheddar omelette')).toBeTruthy();
    expect(view.queryByText('Spinach pasta')).toBeNull();

    await fireEvent.changeText(search, 'spinach');
    expect(view.getByText('Cheddar omelette')).toBeTruthy();
    expect(view.getByText('Spinach pasta')).toBeTruthy();

    await fireEvent.changeText(search, 'lasagne');
    expect(view.getByText(/No saved recipes match/)).toBeTruthy();

    await fireEvent.press(view.getByLabelText('Clear search'));
    expect(view.getByText('Spinach pasta')).toBeTruthy();
  });

  it("reads the list again when it comes back into view, e.g. after a recipe's star changed", async () => {
    await saveRecipe(omelette);
    await saveRecipe(pasta);
    const view = await renderScreen();
    await view.findByText('Spinach pasta');

    /* What unstarring on the recipe's own screen does, then the student comes back. */
    await unsaveRecipe('pasta');
    await act(async () => {
      mockFocus.effect?.();
    });

    expect(await view.findByText('Cheddar omelette')).toBeTruthy();
    expect(view.queryByText('Spinach pasta')).toBeNull();
  });
});
