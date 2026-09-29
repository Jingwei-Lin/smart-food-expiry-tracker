export type RecipeProviderId = 'gemini' | 'openai' | 'deepseek';

export type RecipeProvider = {
  id: RecipeProviderId;
  /** The model as the app names it, e.g. on the Recipes tab's header. */
  label: string;
  company: string;
  model: string;
  /** Every provider speaks the OpenAI Chat Completions API under this address. */
  baseUrl: string;
  /** Where a student creates a key; opened from the settings screen. */
  keysUrl: string;
  /** Sent with every chat request alongside the model and messages. */
  requestOptions: Record<string, string | number>;
  /** What the provider does with the request, shown on the settings screen when it differs from the rest. */
  privacyNote?: string;
};

/*
 * The only models the app offers. Gemini comes first because its free tier
 * needs no payment, so any student (or marker) can try recipes with it.
 *
 * gpt-5.4-mini and the Gemini 3 models reason before they answer: OpenAI
 * rejects `max_tokens` for gpt-5.4-mini and counts its reasoning against
 * `max_completion_tokens` (hence the larger limit), and Gemini 3 cannot turn
 * reasoning off. A low reasoning effort keeps the wait short for both.
 */
export const RECIPE_PROVIDERS: Record<RecipeProviderId, RecipeProvider> = {
  gemini: {
    id: 'gemini',
    label: 'Gemini Flash',
    company: 'Google',
    model: 'gemini-3.8-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keysUrl: 'https://aistudio.google.com/app/apikey',
    requestOptions: { max_tokens: 3000, reasoning_effort: 'low' },
    privacyNote:
      "Gemini's free tier costs nothing, but Google may use what you send to improve its products.",
  },
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
  return value === 'gemini' || value === 'openai' || value === 'deepseek';
}
