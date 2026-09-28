import * as SecureStore from 'expo-secure-store';

import {
  isRecipeProviderId,
  RECIPE_PROVIDERS,
  RecipeProvider,
  RecipeProviderId,
} from '@/utils/recipe-providers';

/*
 * The key and the chosen provider live in the iOS Keychain / Android
 * Keystore rather than AsyncStorage, which is plain text on the device.
 * Each provider keeps its own key, so switching back does not mean pasting
 * the old one in again.
 */
const SELECTED_PROVIDER_KEY = 'recipe.provider';

function apiKeyStorageKey(id: RecipeProviderId): string {
  return `recipe.key.${id}`;
}

export type RecipeCredentials = {
  provider: RecipeProvider;
  apiKey: string;
};

/**
 * The provider the student chose and its key, or null when either is missing,
 * which is when the Recipes tab shows its set-up card.
 */
export async function getRecipeCredentials(): Promise<RecipeCredentials | null> {
  const providerId = await SecureStore.getItemAsync(SELECTED_PROVIDER_KEY);

  if (!providerId || !isRecipeProviderId(providerId)) {
    return null;
  }

  const apiKey = await SecureStore.getItemAsync(apiKeyStorageKey(providerId));

  return apiKey ? { provider: RECIPE_PROVIDERS[providerId], apiKey } : null;
}

/**
 * Shows enough of a key to recognise it, never enough to reuse it:
 * "sk-proj-…a1B2" becomes "sk-…a1B2". A key too short to hide its ending is
 * shown as dots only.
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length < 12) {
    return '••••';
  }

  const prefix = apiKey.startsWith('sk-') ? 'sk-' : '';

  return `${prefix}…${apiKey.slice(-4)}`;
}

/** The masked key saved for one provider, for the settings screen. */
export async function getSavedKeyHint(id: RecipeProviderId): Promise<string | null> {
  const apiKey = await SecureStore.getItemAsync(apiKeyStorageKey(id));

  return apiKey ? maskApiKey(apiKey) : null;
}

/**
 * Stores a key and makes its provider the one the Recipes tab uses. The key is
 * trimmed because keys are pasted, and a pasted newline would break the
 * Authorization header.
 */
export async function saveRecipeCredentials(id: RecipeProviderId, apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(apiKeyStorageKey(id), apiKey.trim());
  await SecureStore.setItemAsync(SELECTED_PROVIDER_KEY, id);
}

/** Forgets one provider's key. The other provider's key is left alone. */
export async function removeRecipeKey(id: RecipeProviderId): Promise<void> {
  await SecureStore.deleteItemAsync(apiKeyStorageKey(id));
}
