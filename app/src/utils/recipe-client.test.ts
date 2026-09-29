import { checkRecipeKey, fetchRecipeSuggestions } from '@/utils/recipe-client';
import { RecipeIngredient } from '@/utils/recipe-ingredients';
import { RECIPE_PROVIDERS } from '@/utils/recipe-providers';

const API_KEY = 'sk-test-key-1234';

function modelList(...ids: string[]) {
  return { ok: true, status: 200, json: async () => ({ data: ids.map((id) => ({ id })) }) };
}

describe('checkRecipeKey', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('asks the chosen provider for its models, using the key', async () => {
    fetchMock.mockResolvedValue(modelList('deepseek-flash'));

    await checkRecipeKey(RECIPE_PROVIDERS.deepseek, API_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.deepseek.com/models');
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: `Bearer ${API_KEY}` });
  });

  it('accepts a key whose account can use the model', async () => {
    fetchMock.mockResolvedValue(modelList('gpt-4o', 'gpt-5.4-mini'));

    await expect(checkRecipeKey(RECIPE_PROVIDERS.openai, API_KEY)).resolves.toBe('valid');
  });

  it('asks Gemini at its OpenAI-compatible address', async () => {
    fetchMock.mockResolvedValue(modelList('gemini-3.8-flash'));

    await checkRecipeKey(RECIPE_PROVIDERS.gemini, API_KEY);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/models',
    );
  });

  it.each(['gemini-3.8-flash', 'models/gemini-3.8-flash'])(
    'accepts a Gemini key when the model is listed as %s',
    async (id) => {
      fetchMock.mockResolvedValue(modelList('models/gemini-2.5-flash', id));

      await expect(checkRecipeKey(RECIPE_PROVIDERS.gemini, API_KEY)).resolves.toBe('valid');
    },
  );

  it('flags a working key whose account cannot use the model', async () => {
    fetchMock.mockResolvedValue(modelList('gpt-4o'));

    await expect(checkRecipeKey(RECIPE_PROVIDERS.openai, API_KEY)).resolves.toBe(
      'model-unavailable',
    );
  });

  it.each([401, 403])('rejects the key when the provider answers %i', async (status) => {
    fetchMock.mockResolvedValue({ ok: false, status, json: async () => ({}) });

    await expect(checkRecipeKey(RECIPE_PROVIDERS.openai, API_KEY)).resolves.toBe('invalid-key');
  });

  it('rejects a Gemini key, which Google answers with 400 rather than 401', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: 400, message: 'Please pass a valid API key', status: 'INVALID_ARGUMENT' },
      }),
    });

    await expect(checkRecipeKey(RECIPE_PROVIDERS.gemini, API_KEY)).resolves.toBe('invalid-key');
  });

  it('does not blame the key for a 400 about something else', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 400, message: 'Invalid JSON payload received.' } }),
    });

    await expect(checkRecipeKey(RECIPE_PROVIDERS.gemini, API_KEY)).resolves.toBe('unavailable');
  });

  it('reports the provider as unavailable on a server error, without blaming the key', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    await expect(checkRecipeKey(RECIPE_PROVIDERS.openai, API_KEY)).resolves.toBe('unavailable');
  });

  it('reports the provider as unavailable when there is no connection', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));

    await expect(checkRecipeKey(RECIPE_PROVIDERS.deepseek, API_KEY)).resolves.toBe('unavailable');
  });

  it('reports the provider as unavailable when the reply is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });

    await expect(checkRecipeKey(RECIPE_PROVIDERS.deepseek, API_KEY)).resolves.toBe('unavailable');
  });
});

describe('fetchRecipeSuggestions', () => {
  const fetchMock = jest.fn();
  const openai = { provider: RECIPE_PROVIDERS.openai, apiKey: API_KEY };
  const deepseek = { provider: RECIPE_PROVIDERS.deepseek, apiKey: API_KEY };
  const gemini = { provider: RECIPE_PROVIDERS.gemini, apiKey: API_KEY };
  const ticked: RecipeIngredient[] = [
    { name: 'Spinach', daysLeft: 0 },
    { name: 'Milk', daysLeft: -2 },
  ];

  const usableContent = JSON.stringify({
    recipes: [
      {
        title: 'Spinach omelette',
        minutes: 10,
        uses: ['Spinach'],
        also_needs: ['Eggs'],
        steps: ['Wilt the spinach.', 'Add the beaten eggs.'],
      },
    ],
  });

  /** A Chat Completions reply carrying one choice. */
  function chatReply(message: Record<string, unknown>, finishReason = 'stop') {
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ finish_reason: finishReason, message }] }),
    };
  }

  function errorReply(status: number, body: unknown = {}) {
    return { ok: false, status, json: async () => body };
  }

  /** A fetch that never answers, and fails only when its signal aborts. */
  function hangingFetch(_url: string, init: { signal: AbortSignal }) {
    return new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
    });
  }

  function sentBody() {
    return JSON.parse(fetchMock.mock.calls[0][1].body);
  }

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('posts the ticked foods to OpenAI with its model, JSON mode and token options', async () => {
    fetchMock.mockResolvedValue(chatReply({ content: usableContent }));

    await fetchRecipeSuggestions(openai, ticked, { avoidTitles: ['Milk pudding'] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(sentBody()).toMatchObject({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      max_completion_tokens: 3000,
      reasoning_effort: 'low',
    });
    expect(sentBody().messages[1].content).toContain('- Spinach (expires today)');
    expect(sentBody().messages[1].content).toContain('Do not suggest these again: Milk pudding.');
  });

  it('uses DeepSeek’s own address and token option', async () => {
    fetchMock.mockResolvedValue(chatReply({ content: usableContent }));

    await fetchRecipeSuggestions(deepseek, ticked);

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.deepseek.com/chat/completions');
    expect(sentBody().model).toBe('deepseek-flash');
    expect(sentBody().max_tokens).toBe(2000);
    expect(sentBody()).not.toHaveProperty('max_completion_tokens');
  });

  it('uses Gemini’s OpenAI-compatible address, JSON mode and a low reasoning effort', async () => {
    fetchMock.mockResolvedValue(chatReply({ content: usableContent }));

    await fetchRecipeSuggestions(gemini, ticked);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(sentBody()).toMatchObject({
      model: 'gemini-3.8-flash',
      response_format: { type: 'json_object' },
      max_tokens: 3000,
      reasoning_effort: 'low',
    });
    expect(sentBody()).not.toHaveProperty('max_completion_tokens');
  });

  it('returns the recipes from a usable reply', async () => {
    fetchMock.mockResolvedValue(chatReply({ content: usableContent }));

    const result = await fetchRecipeSuggestions(openai, ticked);

    expect(result).toEqual({
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
  });

  it.each([401, 403])('reports a rejected key when the provider answers %i', async (status) => {
    fetchMock.mockResolvedValue(errorReply(status));

    await expect(fetchRecipeSuggestions(openai, ticked)).resolves.toEqual({ outcome: 'rejected' });
  });

  it('reports a rejected key when Gemini answers 400 about the key, wrapped in an array', async () => {
    fetchMock.mockResolvedValue(
      errorReply(400, [
        {
          error: { code: 400, message: 'Please pass a valid API key', status: 'INVALID_ARGUMENT' },
        },
      ]),
    );

    await expect(fetchRecipeSuggestions(gemini, ticked)).resolves.toEqual({ outcome: 'rejected' });
  });

  it.each([
    ['DeepSeek has no balance left (402)', errorReply(402)],
    [
      'OpenAI reports an exhausted quota (429)',
      errorReply(429, { error: { code: 'insufficient_quota' } }),
    ],
    [
      'OpenAI names the exhausted quota only in the error type (429)',
      errorReply(429, { error: { type: 'insufficient_quota', code: null } }),
    ],
  ])('reports an account out of credit when %s', async (_, reply) => {
    fetchMock.mockResolvedValue(reply);

    await expect(fetchRecipeSuggestions(openai, ticked)).resolves.toEqual({
      outcome: 'out-of-credit',
    });
  });

  it.each([
    ['a plain rate limit (429)', errorReply(429, { error: { code: 'rate_limit_exceeded' } })],
    [
      'Gemini is overloaded (503)',
      errorReply(503, [
        {
          error: {
            code: 503,
            message: 'This model is currently experiencing high demand.',
            status: 'UNAVAILABLE',
          },
        },
      ]),
    ],
  ])('reports the provider as busy on %s', async (_, reply) => {
    fetchMock.mockResolvedValue(reply);

    await expect(fetchRecipeSuggestions(openai, ticked)).resolves.toEqual({ outcome: 'busy' });
  });

  it.each([
    ['an option it does not accept (400)', errorReply(400, { error: { message: 'Unknown name' } })],
    ['a model it does not have (404)', errorReply(404)],
    ['a request it cannot process (422)', errorReply(422)],
  ])('reports a refused request, not a lost connection, on %s', async (_, reply) => {
    fetchMock.mockResolvedValue(reply);

    await expect(fetchRecipeSuggestions(openai, ticked)).resolves.toEqual({
      outcome: 'request-refused',
    });
  });

  it('still reports the provider as unavailable on a server error (500)', async () => {
    fetchMock.mockResolvedValue(errorReply(500));

    await expect(fetchRecipeSuggestions(openai, ticked)).resolves.toEqual({
      outcome: 'unavailable',
    });
  });

  it('reports the provider as unavailable when there is no connection', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));

    await expect(fetchRecipeSuggestions(openai, ticked)).resolves.toEqual({
      outcome: 'unavailable',
    });
  });

  it.each([
    ['the reply is empty', chatReply({ content: '' })],
    ['the model refused', chatReply({ content: null, refusal: 'I cannot help with that.' })],
    ['the reply was cut off at the token limit', chatReply({ content: usableContent }, 'length')],
    [
      'no recipe passes validation',
      chatReply({ content: JSON.stringify({ recipes: [{ title: 'Nothing usable' }] }) }),
    ],
    ['there is no choice at all', { ok: true, status: 200, json: async () => ({ choices: [] }) }],
    [
      'the body is not JSON',
      {
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      },
    ],
  ])('reports a bad response when %s', async (_, reply) => {
    fetchMock.mockResolvedValue(reply);

    await expect(fetchRecipeSuggestions(deepseek, ticked)).resolves.toEqual({
      outcome: 'bad-response',
    });
  });

  it('stops as soon as the caller cancels, without throwing', async () => {
    fetchMock.mockImplementation(hangingFetch);
    const caller = new AbortController();

    const pending = fetchRecipeSuggestions(openai, ticked, { signal: caller.signal });
    caller.abort();

    await expect(pending).resolves.toEqual({ outcome: 'unavailable' });
  });

  it('does not start a request the caller has already cancelled', async () => {
    fetchMock.mockImplementation(hangingFetch);
    const caller = new AbortController();
    caller.abort();

    await expect(
      fetchRecipeSuggestions(openai, ticked, { signal: caller.signal }),
    ).resolves.toEqual({ outcome: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives up after 30 seconds', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(hangingFetch);

    const pending = fetchRecipeSuggestions(openai, ticked);
    jest.advanceTimersByTime(30000);

    await expect(pending).resolves.toEqual({ outcome: 'unavailable' });
  });
});
