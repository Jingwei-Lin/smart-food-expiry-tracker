import { RecipeCredentials } from '@/utils/recipe-credentials';
import { RecipeIngredient } from '@/utils/recipe-ingredients';
import { buildRecipeMessages, parseRecipeReply, Recipe } from '@/utils/recipe-prompt';
import { RecipeProvider } from '@/utils/recipe-providers';

const KEY_CHECK_TIMEOUT_MS = 10000;

/* Longer than the key check: a reasoning model can think for a while before it answers. */
const SUGGESTION_TIMEOUT_MS = 30000;

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

export type RecipeSuggestionResult =
  | { outcome: 'ok'; recipes: Recipe[] }
  /** 401 / 403: the saved key no longer works. */
  | { outcome: 'rejected' }
  /** The account has run out of credit. */
  | { outcome: 'out-of-credit' }
  /** Offline, timed out, cancelled, rate-limited or a server error. */
  | { outcome: 'unavailable' }
  /** The provider answered, but not with recipes we can use. */
  | { outcome: 'bad-response' };

/*
 * DeepSeek reports an empty balance as 402. OpenAI uses 429 for both a rate
 * limit and an exhausted quota, and only the error code tells them apart.
 */
async function isOutOfCredit(response: Response): Promise<boolean> {
  if (response.status === 402) {
    return true;
  }

  if (response.status !== 429) {
    return false;
  }

  try {
    const body = (await response.json()) as { error?: { code?: unknown } };

    return body.error?.code === 'insufficient_quota';
  } catch {
    return false;
  }
}

/**
 * Pulls the model's text out of a Chat Completions reply, or null when there
 * is nothing trustworthy to parse: no choice, a refusal, a reply cut off at
 * the token limit (its JSON would be incomplete), or empty content, which
 * DeepSeek's JSON mode can occasionally return.
 */
function readReplyContent(body: unknown): string | null {
  const choice = (body as { choices?: unknown[] } | null)?.choices?.[0] as
    { finish_reason?: unknown; message?: { content?: unknown; refusal?: unknown } } | undefined;

  if (!choice || choice.finish_reason === 'length') {
    return null;
  }

  const { content, refusal } = choice.message ?? {};

  if (typeof refusal === 'string' && refusal.trim()) {
    return null;
  }

  return typeof content === 'string' && content.trim() ? content : null;
}

/**
 * Asks the chosen provider for recipes that use the ticked foods.
 *
 * Never throws: every way a request can end maps to one outcome the Recipes
 * tab has a screen for. The request stops after 30 seconds, or as soon as the
 * caller's `signal` aborts (the tab leaving, or a newer request starting).
 */
export async function fetchRecipeSuggestions(
  credentials: RecipeCredentials,
  ingredients: RecipeIngredient[],
  options: { avoidTitles?: string[]; signal?: AbortSignal } = {},
): Promise<RecipeSuggestionResult> {
  const { provider, apiKey } = credentials;
  const { avoidTitles, signal } = options;

  /* A request the caller has already given up on is not worth the student's credit. */
  if (signal?.aborted) {
    return { outcome: 'unavailable' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUGGESTION_TIMEOUT_MS);
  const stopWithCaller = () => controller.abort();

  signal?.addEventListener('abort', stopWithCaller);

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: buildRecipeMessages(ingredients, avoidTitles),
        response_format: { type: 'json_object' },
        ...provider.requestOptions,
      }),
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { outcome: 'rejected' };
    }

    if (await isOutOfCredit(response)) {
      return { outcome: 'out-of-credit' };
    }

    if (!response.ok) {
      return { outcome: 'unavailable' };
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      return { outcome: 'bad-response' };
    }

    const content = readReplyContent(body);
    const recipes = content === null ? null : parseRecipeReply(content, ingredients);

    return recipes ? { outcome: 'ok', recipes } : { outcome: 'bad-response' };
  } catch {
    return { outcome: 'unavailable' };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', stopWithCaller);
  }
}
