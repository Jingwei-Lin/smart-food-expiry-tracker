import { RecipeProvider } from '@/utils/recipe-providers';

const KEY_CHECK_TIMEOUT_MS = 10000;

export type KeyCheckResult = 'valid' | 'invalid-key' | 'model-unavailable' | 'unavailable';

/** Both providers answer GET /models with `{ data: [{ id }] }`. */
function listsModel(body: unknown, model: string): boolean {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const { data } = body as { data?: unknown };

  return (
    Array.isArray(data) &&
    data.some(
      (entry) =>
        typeof entry === 'object' && entry !== null && (entry as { id?: unknown }).id === model,
    )
  );
}

/**
 * Checks a key before it is saved by asking the provider which models it can
 * use. Listing models spends no tokens, and it also catches a key that works
 * but belongs to an account without access to the model we need.
 *
 * Never throws: with no signal or a failing API the settings screen gets
 * `unavailable` and says so, rather than treating the key as wrong.
 */
export async function checkRecipeKey(
  provider: RecipeProvider,
  apiKey: string,
): Promise<KeyCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KEY_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return 'invalid-key';
    }

    if (!response.ok) {
      return 'unavailable';
    }

    return listsModel(await response.json(), provider.model) ? 'valid' : 'model-unavailable';
  } catch {
    return 'unavailable';
  } finally {
    clearTimeout(timeout);
  }
}
