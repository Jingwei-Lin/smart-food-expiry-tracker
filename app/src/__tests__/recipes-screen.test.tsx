import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import RecipesScreen from '@/app/(tabs)/recipes';
import { InventoryProvider } from '@/context/inventory-context';
import { FoodItem } from '@/types/food-item';
import { fetchRecipeSuggestions } from '@/utils/recipe-client';
import { saveRecipeCredentials } from '@/utils/recipe-credentials';
import { RECIPE_PROVIDERS } from '@/utils/recipe-providers';
import { loadSavedRecipes, saveRecipe, unsaveRecipe } from '@/utils/recipe-storage';

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

/** Leaves the screen and opens it again over the given inventory, as reopening the app does. */
async function restart(view: View, items: FoodItem[] = fridge) {
  await view.unmount();

  const reopened = await renderScreen(items);
  await reopened.findByText('Recipes');

  return reopened;
}

/** A successful reply carrying one recipe per title, each using the given food. */
function recipesReply(titles: string[], uses = ['Spinach']) {
  return {
    outcome: 'ok' as const,
    recipes: titles.map((title) => ({
      title,
      minutes: 15,
      usesIngredients: uses,
      extraIngredients: [],
      steps: ['Cook it.'],
    })),
  };
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

describe('RecipesScreen states from the hi-fi design', () => {
  it('shows the food that was asked for above an error, and Change reopens the checklist', async () => {
    fetchSuggestionsMock.mockResolvedValue({ outcome: 'unavailable' });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    expect(await view.findByText("Couldn't reach OpenAI")).toBeTruthy();

    expect(view.getByText('COOKING WITH')).toBeTruthy();
    expect(view.queryByText('YOUR FOOD')).toBeNull();

    await fireEvent.press(view.getByText('Change'));

    expect(view.getByText('YOUR FOOD')).toBeTruthy();
  });

  it('disables the model button while recipes are being found', async () => {
    fetchSuggestionsMock.mockReturnValue(new Promise(() => undefined));
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    await view.findByText('Finding recipes…');

    expect(
      view.getByLabelText('Recipe settings, using GPT-5.4 mini').props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it.each([
    [1, 'One idea for the food you ticked.'],
    [2, 'Two ideas for the food you ticked.'],
  ])('counts %i idea(s) in the subtitle', async (count, subtitle) => {
    fetchSuggestionsMock.mockResolvedValue({
      outcome: 'ok',
      recipes: ['Spinach omelette', 'Creamy spinach pasta'].slice(0, count).map((title) => ({
        title,
        minutes: 15,
        usesIngredients: ['Spinach'],
        extraIngredients: [],
        steps: ['Cook it.'],
      })),
    });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));

    expect(await view.findByText(subtitle)).toBeTruthy();
  });
});

describe('RecipesScreen asking for different recipes', () => {
  it('asks again for the same food, avoiding every title shown so far', async () => {
    fetchSuggestionsMock
      .mockResolvedValueOnce(recipesReply(['Spinach omelette']))
      .mockResolvedValueOnce(recipesReply(['Creamy spinach pasta']))
      .mockResolvedValueOnce(recipesReply(['Spinach fritters']));
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    expect(await view.findByText('Spinach omelette')).toBeTruthy();
    expect(view.getByText("New ideas replace the ones you haven't saved.")).toBeTruthy();

    await fireEvent.press(view.getByText('Suggest different recipes'));
    expect(await view.findByText('Creamy spinach pasta')).toBeTruthy();
    expect(view.queryByText('Spinach omelette')).toBeNull();

    await fireEvent.press(view.getByText('Suggest different recipes'));
    expect(await view.findByText('Spinach fritters')).toBeTruthy();

    const [first, second, third] = fetchSuggestionsMock.mock.calls;
    expect(first[2]?.avoidTitles).toEqual([]);
    expect(second[1]).toEqual(first[1]);
    expect(second[2]?.avoidTitles).toEqual(['Spinach omelette']);
    expect(third[2]?.avoidTitles).toEqual(['Spinach omelette', 'Creamy spinach pasta']);
  });

  it('tries a failed request for different recipes again exactly as it was', async () => {
    fetchSuggestionsMock
      .mockResolvedValueOnce(recipesReply(['Spinach omelette']))
      .mockResolvedValueOnce({ outcome: 'unavailable' })
      .mockResolvedValueOnce(recipesReply(['Creamy spinach pasta']));
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    await view.findByText('Spinach omelette');
    await fireEvent.press(view.getByText('Suggest different recipes'));
    await view.findByText("Couldn't reach OpenAI");

    await fireEvent.press(view.getByText('Try again'));
    expect(await view.findByText('Creamy spinach pasta')).toBeTruthy();

    const [first, , retry] = fetchSuggestionsMock.mock.calls;
    expect(retry[1]).toEqual(first[1]);
    expect(retry[2]?.avoidTitles).toEqual(['Spinach omelette']);
  });
});

describe('RecipesScreen after the app restarts', () => {
  it('shows the last suggestions again without asking the provider', async () => {
    fetchSuggestionsMock.mockResolvedValue(recipesReply(['Spinach omelette']));
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    await view.findByText('Spinach omelette');

    const reopened = await restart(view);

    expect(await reopened.findByText('Spinach omelette')).toBeTruthy();
    expect(reopened.getByText('COOKING WITH')).toBeTruthy();
    expect(fetchSuggestionsMock).toHaveBeenCalledTimes(1);
  });

  it('still avoids the restored titles when asked for different recipes', async () => {
    fetchSuggestionsMock
      .mockResolvedValueOnce(recipesReply(['Spinach omelette']))
      .mockResolvedValueOnce(recipesReply(['Creamy spinach pasta']));
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');
    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    await view.findByText('Spinach omelette');

    const reopened = await restart(view);
    await fireEvent.press(await reopened.findByText('Suggest different recipes'));

    expect(await reopened.findByText('Creamy spinach pasta')).toBeTruthy();
    expect(fetchSuggestionsMock.mock.calls[1][2]?.avoidTitles).toEqual(['Spinach omelette']);
  });

  it('warns about food that has expired since the suggestions were made', async () => {
    fetchSuggestionsMock.mockResolvedValue(recipesReply(['Milk pudding'], ['Milk']));
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');
    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    await view.findByText('Milk pudding');

    /* A day later the milk is past its date. */
    const reopened = await restart(view, [
      buildFood('spinach', 'Spinach', 0),
      buildFood('milk', 'Milk', -1),
    ]);

    expect(
      await reopened.findByText(
        'Uses Milk, which is past its date. Check it looks and smells fine before cooking with it.',
      ),
    ).toBeTruthy();
  });

  it('keeps the ticks the student chose', async () => {
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');
    await fireEvent.press(checkbox(view, 'Eggs'));

    const reopened = await restart(view);
    await reopened.findByText('YOUR FOOD');

    expect(isChecked(reopened, 'Eggs')).toBe(true);
    expect(reopened.getByText('Suggest recipes (3)')).toBeTruthy();
  });

  it('drops ticks for food that has been eaten or deleted since', async () => {
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');
    await fireEvent.press(checkbox(view, 'Eggs'));

    const reopened = await restart(
      view,
      fridge.filter((item) => item.id !== 'eggs'),
    );
    await reopened.findByText('YOUR FOOD');

    expect(reopened.getByText('Suggest recipes (2)')).toBeTruthy();
  });

  it('starts from the checklist after a failed request, not the error', async () => {
    fetchSuggestionsMock.mockResolvedValue({ outcome: 'unavailable' });
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');
    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    await view.findByText("Couldn't reach OpenAI");

    const reopened = await restart(view);

    expect(await reopened.findByText('YOUR FOOD')).toBeTruthy();
    expect(reopened.queryByText("Couldn't reach OpenAI")).toBeNull();
  });
});

describe('RecipesScreen saving recipes', () => {
  /** Asks for recipes and waits for the first title to show. */
  async function showRecipes(title: string) {
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');
    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    await view.findByText(title);

    return view;
  }

  async function savedTitles() {
    return (await loadSavedRecipes()).map((entry) => entry.recipe.title);
  }

  it('fills the star once the recipe is saved, and keeps it after a restart', async () => {
    fetchSuggestionsMock.mockResolvedValue(recipesReply(['Spinach omelette']));
    const view = await showRecipes('Spinach omelette');

    await fireEvent.press(view.getByLabelText('Save Spinach omelette'));

    const star = await view.findByLabelText('Remove Spinach omelette from saved recipes');
    expect(star.props.accessibilityState).toMatchObject({ selected: true });
    await expect(savedTitles()).resolves.toEqual(['Spinach omelette']);

    const reopened = await restart(view);

    expect(
      await reopened.findByLabelText('Remove Spinach omelette from saved recipes'),
    ).toBeTruthy();
  });

  it('empties the star and forgets the recipe on a second tap', async () => {
    fetchSuggestionsMock.mockResolvedValue(recipesReply(['Spinach omelette']));
    const view = await showRecipes('Spinach omelette');

    await fireEvent.press(view.getByLabelText('Save Spinach omelette'));
    await fireEvent.press(await view.findByLabelText('Remove Spinach omelette from saved recipes'));

    expect(await view.findByLabelText('Save Spinach omelette')).toBeTruthy();
    await expect(savedTitles()).resolves.toEqual([]);
  });

  it('keeps a saved recipe when new ideas replace its card, and avoids it', async () => {
    fetchSuggestionsMock
      .mockResolvedValueOnce(recipesReply(['Spinach omelette']))
      .mockResolvedValueOnce(recipesReply(['Creamy spinach pasta']));
    const view = await showRecipes('Spinach omelette');

    await fireEvent.press(view.getByLabelText('Save Spinach omelette'));
    await view.findByLabelText('Remove Spinach omelette from saved recipes');
    await fireEvent.press(view.getByText('Suggest different recipes'));

    expect(await view.findByText('Creamy spinach pasta')).toBeTruthy();
    expect(view.queryByText('Spinach omelette')).toBeNull();
    await expect(savedTitles()).resolves.toEqual(['Spinach omelette']);
    expect(fetchSuggestionsMock.mock.calls[1][2]?.avoidTitles).toEqual(['Spinach omelette']);
  });

  it('asks the model to avoid recipes saved earlier, even on the first request', async () => {
    await saveRecipe({
      id: 'saved-before',
      title: 'Milk pudding',
      minutes: 25,
      usesIngredients: ['Milk'],
      extraIngredients: ['Sugar'],
      steps: ['Warm the milk.'],
    });
    fetchSuggestionsMock.mockResolvedValue(recipesReply(['Spinach omelette']));

    await showRecipes('Spinach omelette');

    expect(fetchSuggestionsMock.mock.calls[0][2]?.avoidTitles).toEqual(['Milk pudding']);
  });
});

describe('RecipesScreen saved box', () => {
  it('counts the saved recipes and opens them', async () => {
    fetchSuggestionsMock.mockResolvedValue(recipesReply(['Spinach omelette']));
    const view = await renderScreen(fridge);

    expect(await view.findByLabelText('Saved recipes, Nothing saved yet')).toBeTruthy();

    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    await view.findByText('Spinach omelette');
    await fireEvent.press(view.getByLabelText('Save Spinach omelette'));
    await fireEvent.press(await view.findByLabelText('Saved recipes, 1 saved'));

    expect(router.push).toHaveBeenCalledWith('/saved-recipes');
  });

  it('is there before a key is set up, above the set-up card and its three promises', async () => {
    const view = await renderScreen(fridge, { withKey: false });
    await view.findByText('Set up recipe suggestions');

    expect(view.getByLabelText('Saved recipes, Nothing saved yet')).toBeTruthy();
    expect(view.getByText('Ideas for the food you already have.')).toBeTruthy();
    expect(view.getByText('Your key stays on this phone.')).toBeTruthy();
    expect(view.getByText('Only the names and dates of the food you tick are sent.')).toBeTruthy();
    expect(view.getByText('Any charges go to your provider account.')).toBeTruthy();
  });

  it('is there with an empty inventory', async () => {
    const view = await renderScreen([]);
    await view.findByText('Nothing to cook with yet');

    expect(view.getByLabelText('Saved recipes, Nothing saved yet')).toBeTruthy();
  });

  it('empties a star once its recipe is removed on the Saved recipes screen', async () => {
    fetchSuggestionsMock.mockResolvedValue(recipesReply(['Spinach omelette']));
    const view = await renderScreen(fridge);
    await view.findByText('YOUR FOOD');
    await fireEvent.press(view.getByText('Suggest recipes (2)'));
    await view.findByText('Spinach omelette');
    await fireEvent.press(view.getByLabelText('Save Spinach omelette'));
    await view.findByLabelText('Remove Spinach omelette from saved recipes');

    /* What the Saved recipes screen does, then the tab comes back into view. */
    const [saved] = await loadSavedRecipes();
    await unsaveRecipe(saved.id);
    await returnFromSettings();

    expect(await view.findByLabelText('Save Spinach omelette')).toBeTruthy();
    expect(view.getByLabelText('Saved recipes, Nothing saved yet')).toBeTruthy();
  });
});
