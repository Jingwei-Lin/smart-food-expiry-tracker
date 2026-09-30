import { RecipeIngredient } from '@/utils/recipe-ingredients';

/* Two cards fit on a phone screen and keep the wait short. */
export const RECIPES_PER_REQUEST = 2;

/* Enough to steer the model away from repeats without crowding the prompt. */
export const MAX_AVOID_TITLES = 10;

export type Recipe = {
  title: string;
  minutes: number;
  /** Every entry names one of the foods the student ticked. */
  usesIngredients: string[];
  extraIngredients: string[];
  steps: string[];
};

export type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

/*
 * DeepSeek's JSON mode only works when the prompt says "JSON" and shows the
 * shape it wants, so the example is part of the instructions, not decoration.
 */
const EXAMPLE_REPLY = JSON.stringify({
  recipes: [
    {
      title: 'Recipe name',
      minutes: 20,
      uses: ['A food from the list'],
      also_needs: ['An ingredient not on the list'],
      steps: ['First step', 'Second step'],
    },
  ],
});

const SYSTEM_PROMPT = [
  'You are a home-cooking chef who suggests simple recipes for a university student with a basic kitchen.',
  'Assume salt, pepper, cooking oil and water are available.',
  'Each recipe has at most 10 short steps.',
  'A recipe does not have to use every listed food, but should favour the ones that need using up soonest.',
  'In "uses", list only foods from the list, spelled exactly as given.',
  `Reply with JSON only, in exactly this structured response format: ${EXAMPLE_REPLY}`,
].join('\n');

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Describes one food the way the prompt lists it, e.g. "Milk (1 day left)".
 * Expired food is named as such so the model knows it is using it anyway.
 */
function describeIngredient(ingredient: RecipeIngredient): string {
  const { name, daysLeft } = ingredient;

  if (!Number.isFinite(daysLeft)) {
    return `${name} (date unknown)`;
  }

  if (daysLeft < 0) {
    const elapsedDays = Math.abs(daysLeft);

    return `${name} (expired ${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} ago)`;
  }

  if (daysLeft === 0) {
    return `${name} (expires today)`;
  }

  return `${name} (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left)`;
}

/**
 * Builds the chat messages for one request. Only the names and dates of the
 * ticked foods are sent: nothing else about the student or their inventory.
 */
export function buildRecipeMessages(
  ingredients: RecipeIngredient[],
  avoidTitles: string[] = [],
): ChatMessage[] {
  const lines = [
    'Food I want to use:',
    ...ingredients.map((ingredient) => `- ${describeIngredient(ingredient)}`),
    '',
    `Suggest ${RECIPES_PER_REQUEST} recipes. Each must use at least one of these foods.`,
  ];

  if (avoidTitles.length > 0) {
    lines.push(`Do not suggest these again: ${avoidTitles.join('; ')}.`);
  }

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFilledString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Accepts one recipe exactly as the model wrote it, or returns null.
 *
 * Nothing is trimmed, renamed or filled in: a recipe that breaks a rule is
 * dropped whole. In particular, one that claims a food the student did not
 * tick is dropped rather than edited, because its steps may rely on it.
 */
function toValidRecipe(value: unknown, tickedNames: Set<string>): Recipe | null {
  if (!isRecord(value)) {
    return null;
  }

  const { title, minutes, uses, also_needs: alsoNeeds, steps } = value;

  if (!isFilledString(title)) {
    return null;
  }

  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes <= 0) {
    return null;
  }

  if (!Array.isArray(steps) || steps.length === 0 || !steps.every(isFilledString)) {
    return null;
  }

  if (!isStringList(alsoNeeds)) {
    return null;
  }

  if (
    !isStringList(uses) ||
    uses.length === 0 ||
    !uses.every((name) => tickedNames.has(normalizeName(name)))
  ) {
    return null;
  }

  return {
    title,
    minutes,
    usesIngredients: uses,
    extraIngredients: alsoNeeds,
    steps,
  };
}

/**
 * Reads the model's reply. Returns null when no recipe in it can be used, so
 * the caller can show one "couldn't read the suggestions" state for every way
 * a reply can go wrong.
 */
export function parseRecipeReply(
  content: string,
  ingredients: RecipeIngredient[],
): Recipe[] | null {
  let body: unknown;

  try {
    body = JSON.parse(content);
  } catch {
    return null;
  }

  if (!isRecord(body) || !Array.isArray(body.recipes)) {
    return null;
  }

  const tickedNames = new Set(ingredients.map((ingredient) => normalizeName(ingredient.name)));
  const recipes = body.recipes
    .map((value) => toValidRecipe(value, tickedNames))
    .filter((recipe): recipe is Recipe => recipe !== null)
    .slice(0, RECIPES_PER_REQUEST);

  return recipes.length > 0 ? recipes : null;
}

/**
 * The ticked foods a recipe uses that are past their date, spelled as in the
 * inventory. The red warning on a recipe card comes from this, not from the
 * model, so it is always there when it should be.
 */
export function findExpiredIngredients(recipe: Recipe, ingredients: RecipeIngredient[]): string[] {
  const usedNames = new Set(recipe.usesIngredients.map(normalizeName));

  return ingredients
    .filter(
      (ingredient) => ingredient.daysLeft < 0 && usedNames.has(normalizeName(ingredient.name)),
    )
    .map((ingredient) => ingredient.name);
}

/**
 * Adds the titles just shown to the list "Suggest different recipes" asks the
 * model to avoid. A title shown again moves to the end rather than appearing
 * twice, and only the newest ones are kept, so the prompt stays short.
 */
export function rememberShownTitles(shownTitles: string[], newTitles: string[]): string[] {
  const newNames = new Set(newTitles.map(normalizeName));

  return [
    ...shownTitles.filter((title) => !newNames.has(normalizeName(title))),
    ...newTitles,
  ].slice(-MAX_AVOID_TITLES);
}

/**
 * The titles a request asks the model to avoid: every title shown this
 * session, so new ideas never repeat what is on screen, then the newest saved
 * titles, so a starred recipe is not suggested again. At most ten in total.
 */
export function buildAvoidTitles(shownTitles: string[], savedTitles: string[]): string[] {
  const shownNames = new Set(shownTitles.map(normalizeName));
  const newSaved = savedTitles.filter((title) => !shownNames.has(normalizeName(title)));

  return [...shownTitles, ...newSaved].slice(0, MAX_AVOID_TITLES);
}
