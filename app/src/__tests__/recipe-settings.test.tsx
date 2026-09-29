import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import RecipeSettingsScreen from '@/app/recipe-settings';
import { checkRecipeKey } from '@/utils/recipe-client';
import {
  getRecipeCredentials,
  getSavedKeyHint,
  saveRecipeCredentials,
} from '@/utils/recipe-credentials';
import { RECIPE_PROVIDERS } from '@/utils/recipe-providers';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/utils/recipe-client', () => ({ checkRecipeKey: jest.fn() }));

const checkRecipeKeyMock = jest.mocked(checkRecipeKey);
const OPENAI_KEY = 'sk-proj-openai-test-key-a1B2';
const DEEPSEEK_KEY = 'sk-deepseek-test-key-9z8Y';
const GEMINI_KEY = 'AIza-gemini-test-key-5x6W';
const GEMINI_NOTE =
  "Gemini's free tier costs nothing, but Google may use what you send to improve its products.";

async function renderScreen() {
  const view = await render(<RecipeSettingsScreen />);

  await view.findByText('MODEL');

  return view;
}

beforeEach(() => {
  checkRecipeKeyMock.mockReset();
  jest.mocked(router.back).mockReset();
});

describe('RecipeSettingsScreen', () => {
  it('checks a pasted key, saves it once the provider accepts it, and goes back', async () => {
    checkRecipeKeyMock.mockResolvedValue('valid');
    const view = await renderScreen();

    await fireEvent.press(view.getByText('GPT-5.4 mini'));
    await fireEvent.changeText(view.getByLabelText('OpenAI API key'), ` ${OPENAI_KEY}\n`);
    await fireEvent.press(view.getByText('Save and check'));

    expect(checkRecipeKeyMock).toHaveBeenCalledWith(RECIPE_PROVIDERS.openai, OPENAI_KEY);
    await expect(getRecipeCredentials()).resolves.toEqual({
      provider: RECIPE_PROVIDERS.openai,
      apiKey: OPENAI_KEY,
    });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('keeps a rejected key off the phone and says why', async () => {
    checkRecipeKeyMock.mockResolvedValue('invalid-key');
    const view = await renderScreen();

    await fireEvent.press(view.getByText('GPT-5.4 mini'));
    await fireEvent.changeText(view.getByLabelText('OpenAI API key'), OPENAI_KEY);
    await fireEvent.press(view.getByText('Save and check'));

    expect(
      await view.findByText('OpenAI did not accept this key. Check that you copied all of it.'),
    ).toBeTruthy();
    await expect(getRecipeCredentials()).resolves.toBeNull();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('does not blame the key when the provider cannot be reached', async () => {
    checkRecipeKeyMock.mockResolvedValue('unavailable');
    const view = await renderScreen();

    await fireEvent.press(view.getByText('DeepSeek Flash'));
    await fireEvent.changeText(view.getByLabelText('DeepSeek API key'), DEEPSEEK_KEY);
    await fireEvent.press(view.getByText('Save and check'));

    expect(
      await view.findByText(
        "Couldn't reach DeepSeek to check the key. Check your connection and try again. Nothing was saved.",
      ),
    ).toBeTruthy();
    await expect(getSavedKeyHint('deepseek')).resolves.toBeNull();
  });

  it('switches to a model whose key is already saved without checking it again', async () => {
    await saveRecipeCredentials('deepseek', DEEPSEEK_KEY);
    await saveRecipeCredentials('openai', OPENAI_KEY);
    const view = await renderScreen();

    await fireEvent.press(view.getByText('DeepSeek Flash'));
    await fireEvent.press(view.getByText('Use DeepSeek Flash'));

    expect(checkRecipeKeyMock).not.toHaveBeenCalled();
    const credentials = await getRecipeCredentials();
    expect(credentials?.provider.id).toBe('deepseek');
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('shows only the end of a saved key and can remove it', async () => {
    await saveRecipeCredentials('openai', OPENAI_KEY);
    const view = await renderScreen();

    expect(view.getByText('Saved key: sk-…a1B2')).toBeTruthy();
    expect(view.queryByText(OPENAI_KEY)).toBeNull();

    await fireEvent.press(view.getByText('Remove key'));

    expect(await view.findByText('OpenAI key removed from this phone.')).toBeTruthy();
    expect(view.getByText('No OpenAI key saved yet')).toBeTruthy();
    await expect(getRecipeCredentials()).resolves.toBeNull();
  });

  it('starts on the free Gemini model and saves a Google key for it', async () => {
    checkRecipeKeyMock.mockResolvedValue('valid');
    const view = await renderScreen();

    await fireEvent.changeText(view.getByLabelText('Google API key'), GEMINI_KEY);
    await fireEvent.press(view.getByText('Save and check'));

    expect(checkRecipeKeyMock).toHaveBeenCalledWith(RECIPE_PROVIDERS.gemini, GEMINI_KEY);
    const credentials = await getRecipeCredentials();
    expect(credentials?.provider.id).toBe('gemini');
  });

  it('says that Google may use free-tier requests, only while Gemini is chosen', async () => {
    const view = await renderScreen();

    expect(view.getByText(GEMINI_NOTE, { exact: false })).toBeTruthy();

    await fireEvent.press(view.getByText('GPT-5.4 mini'));

    expect(view.queryByText(GEMINI_NOTE, { exact: false })).toBeNull();
  });

  it('leaves the main button disabled until there is something to save', async () => {
    const view = await renderScreen();

    await fireEvent.press(view.getByText('Save and check'));

    expect(checkRecipeKeyMock).not.toHaveBeenCalled();
  });
});
