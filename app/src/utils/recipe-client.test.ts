import { checkRecipeKey } from '@/utils/recipe-client';
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
