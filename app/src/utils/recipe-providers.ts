export type RecipeProviderId = 'gemini' | 'matilda' | 'openai' | 'deepseek';

export type RecipeProvider = {
  id: RecipeProviderId;
  /** The model as the app names it, e.g. on the Recipes tab's header. */
  label: string;
  company: string;
  model: string;
  /**
   * How requests are made: the OpenAI Chat Completions API, which three
   * providers share, or Matilda's own streaming chat API.
   */
  api: 'chat-completions' | 'matilda';
  baseUrl: string;
  /** Where a student creates a key; opened from the settings screen. */
  keysUrl: string;
  /** Sent with every chat request alongside the messages. */
  requestOptions: Record<string, string | number | boolean>;
  /** What the provider does with the request, shown on the settings screen when it differs from the rest. */
  privacyNote?: string;
};

/*
 * The only models the app offers. The free ones come first, so any student
 * (or marker) can try recipes without paying.
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
    api: 'chat-completions',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keysUrl: 'https://aistudio.google.com/app/apikey',
    requestOptions: { max_tokens: 3000, reasoning_effort: 'low' },
    privacyNote:
      "Gemini's free tier costs nothing, but Google may use what you send to improve its products.",
  },
  /*
   * Matilda has a single model, so no model name is sent. "instant" is its
   * fastest mode, and `persist: false` stops every request from being kept as
   * a conversation in the student's Matilda account.
   */
  matilda: {
    id: 'matilda',
    label: 'Matilda',
    company: 'Maincode',
    model: 'matilda',
    api: 'matilda',
    baseUrl: 'https://matilda.maincode.com/api',
    keysUrl: 'https://maincode.com/dashboard',
    requestOptions: { responseMode: 'instant', persist: false },
    privacyNote:
      "Matilda runs on Maincode's own servers in Melbourne, and Maincode says it never trains its models on your prompts.",
  },
  openai: {
    id: 'openai',
    label: 'GPT-5.4 mini',
    company: 'OpenAI',
    model: 'gpt-5.4-mini',
    api: 'chat-completions',
    baseUrl: 'https://api.openai.com/v1',
    keysUrl: 'https://platform.openai.com/api-keys',
    requestOptions: { max_completion_tokens: 3000, reasoning_effort: 'low' },
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek Flash',
    company: 'DeepSeek',
    model: 'deepseek-flash',
    api: 'chat-completions',
    baseUrl: 'https://api.deepseek.com',
    keysUrl: 'https://platform.deepseek.com/api_keys',
    requestOptions: { max_tokens: 2000 },
  },
};

export function isRecipeProviderId(value: string): value is RecipeProviderId {
  return Object.keys(RECIPE_PROVIDERS).includes(value);
}
