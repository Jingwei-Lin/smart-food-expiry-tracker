export type RecipeProviderId = 'openai' | 'deepseek';

export type RecipeProvider = {
  id: RecipeProviderId;
  /** The model as the app names it, e.g. on the Recipes tab's header. */
  label: string;
  company: string;
  model: string;
  /** Both providers speak the OpenAI Chat Completions API under this address. */
  baseUrl: string;
  /** Where a student creates a key; opened from the settings screen. */
  keysUrl: string;
  /** Sent with every chat request alongside the model and messages. */
  requestOptions: Record<string, string | number>;
};

/*
 * The only two models the app offers. Their request options differ because
 * gpt-5.4-mini is a reasoning model: OpenAI rejects `max_tokens` for it, its
 * reasoning counts against `max_completion_tokens` (hence the larger limit),
 * and a low reasoning effort keeps the wait short.
 */
export const RECIPE_PROVIDERS: Record<RecipeProviderId, RecipeProvider> = {
  openai: {
    id: 'openai',
    label: 'GPT-5.4 mini',
    company: 'OpenAI',
    model: 'gpt-5.4-mini',
    baseUrl: 'https://api.openai.com/v1',
    keysUrl: 'https://platform.openai.com/api-keys',
    requestOptions: { max_completion_tokens: 3000, reasoning_effort: 'low' },
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek Flash',
    company: 'DeepSeek',
    model: 'deepseek-flash',
    baseUrl: 'https://api.deepseek.com',
    keysUrl: 'https://platform.deepseek.com/api_keys',
    requestOptions: { max_tokens: 2000 },
  },
};

export function isRecipeProviderId(value: string): value is RecipeProviderId {
  return value === 'openai' || value === 'deepseek';
}
