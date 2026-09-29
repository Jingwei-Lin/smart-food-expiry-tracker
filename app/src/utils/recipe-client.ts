import { readMatildaStream, toMatildaMessages } from '@/utils/matilda';
import { RecipeCredentials } from '@/utils/recipe-credentials';
import { RecipeIngredient } from '@/utils/recipe-ingredients';
import { buildRecipeMessages, ChatMessage, parseRecipeReply, Recipe } from '@/utils/recipe-prompt';
import { RecipeProvider } from '@/utils/recipe-providers';

const KEY_CHECK_TIMEOUT_MS = 10000;

/* Longer than the key check: a reasoning model can think for a while before it answers. */
const SUGGESTION_TIMEOUT_MS = 30000;

export type KeyCheckResult = 'valid' | 'invalid-key' | 'model-unavailable' | 'unavailable';

/*
 * Every provider answers GET /models with `{ data: [{ id }] }`, but Gemini
 * lists its ids as `models/gemini-3.8-flash` while chat requests take the bare
 * name, so both spellings count.
 */
function listsModel(body: unknown, model: string): boolean {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const { data } = body as { data?: unknown };

  return (
    Array.isArray(data) &&
    data.some((entry) => {
      const id =
        typeof entry === 'object' && entry !== null ? (entry as { id?: unknown }).id : null;

      return id === model || id === `models/${model}`;
    })
  );
}

/*
 * OpenAI and DeepSeek answer a bad key with 401 or 403. Gemini answers 400
 * INVALID_ARGUMENT, "Please pass a valid API key", and wraps chat errors in an
 * array, so a 400 only counts when its message is about the key.
 */
async function isKeyRejected(response: Response): Promise<boolean> {
  if (response.status === 401 || response.status === 403) {
    return true;
  }

  if (response.status !== 400) {
    return false;
  }

  try {
    const body: unknown = await response.json();
    const reply = (Array.isArray(body) ? body[0] : body) as
      { error?: { message?: unknown } } | null | undefined;
    const message = reply?.error?.message;

    return typeof message === 'string' && /api key/i.test(message);
  } catch {
    return false;
  }
}

/** One chat request, shaped for the provider's API. */
function buildChatRequest(
  provider: RecipeProvider,
  apiKey: string,
  messages: ChatMessage[],
  signal: AbortSignal,
): [string, RequestInit] {
  const body =
    provider.api === 'matilda'
      ? { messages: toMatildaMessages(messages), ...provider.requestOptions }
      : {
          model: provider.model,
          messages,
          response_format: { type: 'json_object' },
          ...provider.requestOptions,
        };

  return [
    `${provider.baseUrl}${provider.api === 'matilda' ? '/chat' : '/chat/completions'}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
  ];
}

/**
 * Checks a key before it is saved by asking the provider which models it can
 * use. Listing models spends no tokens, and it also catches a key that works
 * but belongs to an account without access to the model we need. Matilda has
 * no model list and a single model, so its key is checked with a one-line
 * chat request instead.
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
    const response =
      provider.api === 'matilda'
        ? await fetch(
            ...buildChatRequest(
              provider,
              apiKey,
              [{ role: 'user', content: 'Reply with OK.' }],
              controller.signal,
            ),
          )
        : await fetch(`${provider.baseUrl}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal,
          });

    if (await isKeyRejected(response)) {
      return 'invalid-key';
    }

    if (!response.ok) {
      return 'unavailable';
    }

    if (provider.api === 'matilda') {
      return 'valid';
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
  /** The saved key no longer works (401 / 403, or Gemini's 400 about the key). */
  | { outcome: 'rejected' }
  /** The account has run out of credit. */
  | { outcome: 'out-of-credit' }
  /** Rate-limited (429) or overloaded (503): the same request should work again shortly. */
  | { outcome: 'busy' }
  /** The provider answered but would not process the request (400, 404 or 422), e.g. a model or option it does not accept. */
  | { outcome: 'request-refused' }
  /** Offline, timed out, cancelled or another server error. */
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
    const body = (await response.json()) as { error?: { code?: unknown; type?: unknown } };

    return body.error?.code === 'insufficient_quota' || body.error?.type === 'insufficient_quota';
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

/** The model's text from a successful reply, or null when none can be trusted. */
async function readReply(provider: RecipeProvider, response: Response): Promise<string | null> {
  try {
    return provider.api === 'matilda'
      ? readMatildaStream(await response.text())
      : readReplyContent(await response.json());
  } catch {
    return null;
  }
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
    const response = await fetch(
      ...buildChatRequest(
        provider,
        apiKey,
        buildRecipeMessages(ingredients, avoidTitles),
        controller.signal,
      ),
    );

    if (await isKeyRejected(response)) {
      return { outcome: 'rejected' };
    }

    if (await isOutOfCredit(response)) {
      return { outcome: 'out-of-credit' };
    }

    /* Gemini's free model often answers 503 "high demand", then works seconds later. */
    if (response.status === 429 || response.status === 503) {
      return { outcome: 'busy' };
    }

    /* The provider did answer, so blaming the connection would send the student the wrong way. */
    if (response.status === 400 || response.status === 404 || response.status === 422) {
      return { outcome: 'request-refused' };
    }

    if (!response.ok) {
      return { outcome: 'unavailable' };
    }

    const content = await readReply(provider, response);
    const recipes = content === null ? null : parseRecipeReply(content, ingredients);

    return recipes ? { outcome: 'ok', recipes } : { outcome: 'bad-response' };
  } catch {
    return { outcome: 'unavailable' };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', stopWithCaller);
  }
}
