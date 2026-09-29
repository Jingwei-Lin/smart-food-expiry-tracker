import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import RecipesScreen from '@/app/(tabs)/recipes';
import { InventoryProvider } from '@/context/inventory-context';
import { FoodItem } from '@/types/food-item';
import { fetchRecipeSuggestions } from '@/utils/recipe-client';
import { saveRecipeCredentials } from '@/utils/recipe-credentials';
import { RECIPE_PROVIDERS } from '@/utils/recipe-providers';

jest.mock('@/services/expiry-notifications', () => ({
  cancelExpiryReminders: jest.fn().mockResolvedValue(true),
  scheduleExpiryReminders: jest.fn().mockResolvedValue({ status: 'not-needed' }),
}));

/*
 * Only one screen is rendered, so mounting it is the same as it coming into
 * focus. The latest effect is kept so a test can focus the tab again, as
 * coming back from recipe settings does.
 */
const mockFocus: { effect: (() => void | (() => void)) | null } = { effect: null };

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');

  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => void | (() => void)) =>
      useEffect(() => {
        mockFocus.effect = effect;

        return effect();
      }, [effect]),
  };
});

async function returnFromSettings() {
  await act(async () => {
    mockFocus.effect?.();
  });
}

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/utils/recipe-client', () => ({ fetchRecipeSuggestions: jest.fn() }));

const fetchSuggestionsMock = jest.mocked(fetchRecipeSuggestions);
const STORAGE_KEY = '@smart-food-expiry-tracker/inventory-v1';
const API_KEY = 'sk-test-key-a1B2c3d4';

/* Dates are relative to the day the tests run, so "expires today" stays true. */
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

/* Expired, today, tomorrow, and next week: two start ticked, two do not. */
const fridge = [
  buildFood('cheddar', 'Cheddar', -2),
  buildFood('spinach', 'Spinach', 0),
  buildFood('milk', 'Milk', 1),
  buildFood('eggs', 'Eggs', 6),
];

async function renderScreen(items: FoodItem[], { withKey = true } = {}) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));

  if (withKey) {
    await saveRecipeCredentials('openai', API_KEY);
  }

  return render(
    <InventoryProvider>
      <RecipesScreen />
    </InventoryProvider>,
  );
}

type View = Awaited<ReturnType<typeof render>>;

function checkbox(view: View, name: string) {
  return view.getByRole('checkbox', { name: new RegExp(`^${name},`) });
}

function isChecked(view: View, name: string): boolean {
  return checkbox(view, name).props.accessibilityState?.checked === true;
}

beforeEach(async () => {
  fetchSuggestionsMock.mockReset();
  jest.mocked(router.push).mockReset();
  await AsyncStorage.clear();
});

describe('RecipesScreen before a request', () => {
  it('asks for a key first, and makes no request without one', async () => {
    const view = await renderScreen(fridge, { withKey: false });

    expect(await view.findByText('Set up recipe suggestions')).toBeTruthy();

    await fireEvent.press(view.getByText('Set up'));

    expect(router.push).toHaveBeenCalledWith('/recipe-settings');
    expect(fetchSuggestionsMock).not.toHaveBeenCalled();
  });

  it('explains an empty inventory instead of offering to ask', async () => {
    const view = await renderScreen([]);

    expect(await view.findByText('Nothing to cook with yet')).toBeTruthy();
    expect(view.queryByText(/Suggest recipes/)).toBeNull();
  });

  it('ticks food that needs eating soon, but never expired food', async () => {
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    expect(isChecked(view, 'Spinach')).toBe(true);
    expect(isChecked(view, 'Milk')).toBe(true);
    expect(isChecked(view, 'Cheddar')).toBe(false);
    expect(isChecked(view, 'Eggs')).toBe(false);
    expect(view.getByText('2 of 10')).toBeTruthy();
  });

  it('shows the red warning once expired food is ticked', async () => {
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(checkbox(view, 'Cheddar'));

    expect(
      view.getByText(
        'Cheddar is past its date. Check it looks and smells fine before cooking with it.',
      ),
    ).toBeTruthy();
  });

  it('stops at ten ticks and disables the rest', async () => {
    const eleven = Array.from({ length: 11 }, (_, index) =>
      buildFood(`food-${index}`, `Food ${index}`, index + 1),
    );
    const view = await renderScreen(eleven);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Select all'));

    expect(view.getByText('10 of 10')).toBeTruthy();
    expect(checkbox(view, 'Food 10').props.accessibilityState?.disabled).toBe(true);
  });

  it('cannot ask for recipes with nothing ticked', async () => {
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Clear'));
    await fireEvent.press(view.getByText('Tick at least one food'));

    expect(fetchSuggestionsMock).not.toHaveBeenCalled();
  });
});

describe('RecipesScreen asking for recipes', () => {
  it('sends exactly the ticked food and shows the recipes, warning about expired food', async () => {
    fetchSuggestionsMock.mockResolvedValue({
      outcome: 'ok',
      recipes: [
        {
          title: 'Spinach and cheddar quesadillas',
          minutes: 20,
          usesIngredients: ['cheddar', 'Spinach'],
          extraIngredients: ['Tortillas'],
          steps: ['Wilt the spinach.', 'Fill the tortillas and toast them.'],
        },
      ],
    });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(checkbox(view, 'Cheddar'));
    await fireEvent.press(view.getByText('Suggest recipes (3)'));

    expect(fetchSuggestionsMock).toHaveBeenCalledWith(
      { provider: RECIPE_PROVIDERS.openai, apiKey: API_KEY },
      [
        { name: 'Cheddar', daysLeft: -2 },
        { name: 'Spinach', daysLeft: 0 },
        { name: 'Milk', daysLeft: 1 },
      ],
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(await view.findByText('Spinach and cheddar quesadillas')).toBeTruthy();
    expect(
      view.getByText(
        'Uses Cheddar, which is past its date. Check it looks and smells fine before cooking with it.',
      ),
    ).toBeTruthy();
    expect(view.getByText('COOKING WITH')).toBeTruthy();
    expect(view.getByText('Cheddar · expired')).toBeTruthy();
  });

  it('offers to try again when the provider cannot be reached', async () => {
    fetchSuggestionsMock.mockResolvedValue({ outcome: 'unavailable' });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    expect(await view.findByText("Couldn't reach OpenAI")).toBeTruthy();

    await fireEvent.press(view.getByText('Try again'));

    expect(fetchSuggestionsMock).toHaveBeenCalledTimes(2);
  });

  it('says the provider is busy, not unreachable, and offers to try again', async () => {
    fetchSuggestionsMock.mockResolvedValue({ outcome: 'busy' });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    expect(await view.findByText('OpenAI is busy right now')).toBeTruthy();
    expect(view.queryByText("Couldn't reach OpenAI")).toBeNull();

    await fireEvent.press(view.getByText('Try again'));

    expect(fetchSuggestionsMock).toHaveBeenCalledTimes(2);
  });

  it('says the provider refused the request instead of blaming the connection', async () => {
    fetchSuggestionsMock.mockResolvedValue({ outcome: 'request-refused' });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));

    expect(await view.findByText("OpenAI couldn't process the request")).toBeTruthy();
    expect(view.queryByText("Couldn't reach OpenAI")).toBeNull();
    expect(view.getByText('Try again')).toBeTruthy();
  });

  it('sends the student to settings when the key is rejected', async () => {
    fetchSuggestionsMock.mockResolvedValue({ outcome: 'rejected' });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    expect(await view.findByText('Your API key was rejected')).toBeTruthy();

    await fireEvent.press(view.getByText('Update key'));

    expect(router.push).toHaveBeenCalledWith('/recipe-settings');
  });
});

describe('RecipesScreen after the key changes in settings', () => {
  const SECOND_KEY = 'sk-second-test-key-9z8Y';

  it('drops an out-of-credit card instead of blaming the newly chosen provider', async () => {
    fetchSuggestionsMock.mockResolvedValue({ outcome: 'out-of-credit' });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    expect(await view.findByText('Your OpenAI account is out of credit')).toBeTruthy();

    await saveRecipeCredentials('deepseek', SECOND_KEY);
    await returnFromSettings();

    expect(view.queryByText('Your DeepSeek account is out of credit')).toBeNull();
    expect(view.queryByText('Your OpenAI account is out of credit')).toBeNull();
    expect(view.getByText('Suggest recipes (2)')).toBeTruthy();
  });

  it('drops a rejected-key card once a new key for the same model is saved', async () => {
    fetchSuggestionsMock.mockResolvedValue({ outcome: 'rejected' });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    expect(await view.findByText('Your API key was rejected')).toBeTruthy();

    await saveRecipeCredentials('openai', SECOND_KEY);
    await returnFromSettings();

    expect(view.queryByText('Your API key was rejected')).toBeNull();
  });

  it('keeps the recipes on screen when the model changes', async () => {
    fetchSuggestionsMock.mockResolvedValue({
      outcome: 'ok',
      recipes: [
        {
          title: 'Spinach omelette',
          minutes: 10,
          usesIngredients: ['Spinach'],
          extraIngredients: ['Eggs'],
          steps: ['Wilt the spinach.', 'Add the beaten eggs.'],
        },
      ],
    });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    expect(await view.findByText('Spinach omelette')).toBeTruthy();

    await saveRecipeCredentials('deepseek', SECOND_KEY);
    await returnFromSettings();

    expect(view.getByText('Spinach omelette')).toBeTruthy();
  });

  it('keeps an error when the student comes back without changing anything', async () => {
    fetchSuggestionsMock.mockResolvedValue({ outcome: 'unavailable' });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    expect(await view.findByText("Couldn't reach OpenAI")).toBeTruthy();

    await returnFromSettings();

    expect(view.getByText("Couldn't reach OpenAI")).toBeTruthy();
  });
});
