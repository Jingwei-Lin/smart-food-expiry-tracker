import * as SecureStore from 'expo-secure-store';

import {
  getRecipeCredentials,
  getSavedKeyHint,
  maskApiKey,
  removeRecipeKey,
  saveRecipeCredentials,
} from '@/utils/recipe-credentials';
import { RECIPE_PROVIDERS } from '@/utils/recipe-providers';

const OPENAI_KEY = 'sk-proj-openai-test-key-a1B2';
const DEEPSEEK_KEY = 'sk-deepseek-test-key-9z8Y';

describe('getRecipeCredentials', () => {
  it('returns null before anything has been saved', async () => {
    await expect(getRecipeCredentials()).resolves.toBeNull();
  });

  it('returns the provider and key that were saved', async () => {
    await saveRecipeCredentials('openai', OPENAI_KEY);

    await expect(getRecipeCredentials()).resolves.toEqual({
      provider: RECIPE_PROVIDERS.openai,
      apiKey: OPENAI_KEY,
    });
  });

  it('ignores a stored provider the app does not offer', async () => {
    await SecureStore.setItemAsync('recipe.provider', 'another-provider');

    await expect(getRecipeCredentials()).resolves.toBeNull();
  });
});

describe('saveRecipeCredentials', () => {
  it('trims a pasted key so the Authorization header stays valid', async () => {
    await saveRecipeCredentials('deepseek', `  ${DEEPSEEK_KEY}\n`);

    const credentials = await getRecipeCredentials();

    expect(credentials?.apiKey).toBe(DEEPSEEK_KEY);
  });

  it('switches to the newly saved provider and keeps the other key', async () => {
    await saveRecipeCredentials('openai', OPENAI_KEY);
    await saveRecipeCredentials('deepseek', DEEPSEEK_KEY);

    const credentials = await getRecipeCredentials();

    expect(credentials?.provider.id).toBe('deepseek');
    await expect(getSavedKeyHint('openai')).resolves.toBe('sk-…a1B2');
  });
});

describe('removeRecipeKey', () => {
  it('forgets only that provider’s key', async () => {
    await saveRecipeCredentials('openai', OPENAI_KEY);
    await saveRecipeCredentials('deepseek', DEEPSEEK_KEY);

    await removeRecipeKey('deepseek');

    await expect(getSavedKeyHint('deepseek')).resolves.toBeNull();
    await expect(getSavedKeyHint('openai')).resolves.toBe('sk-…a1B2');
  });

  it('leaves the Recipes tab without credentials when the chosen provider’s key goes', async () => {
    await saveRecipeCredentials('openai', OPENAI_KEY);

    await removeRecipeKey('openai');

    await expect(getRecipeCredentials()).resolves.toBeNull();
  });
});

describe('maskApiKey', () => {
  it('shows the prefix and the last four characters only', () => {
    expect(maskApiKey(OPENAI_KEY)).toBe('sk-…a1B2');
  });

  it('leaves out the prefix when a key does not start with sk-', () => {
    expect(maskApiKey('key-without-the-usual-prefix-WXYZ')).toBe('…WXYZ');
  });

  it('never shows a short key in full', () => {
    expect(maskApiKey('sk-ab12')).toBe('••••');
  });
});

describe('getSavedKeyHint', () => {
  it('returns null for a provider with no saved key', async () => {
    await expect(getSavedKeyHint('openai')).resolves.toBeNull();
  });
});
