import AsyncStorage from '@react-native-async-storage/async-storage';

import { Recipe } from '@/utils/recipe-prompt';

/*
 * The Recipes tab's last suggestions and ticks, and the recipes the student
 * starred, kept next to the inventory. Reopening the app shows them again
 * without a new (possibly billed) request. None of it is secret, so it lives
 * in AsyncStorage rather than SecureStore.
 */
const SNAPSHOT_KEY = '@smart-food-expiry-tracker/recipes-screen-v1';
const SAVED_KEY = '@smart-food-expiry-tracker/recipes-saved-v1';

/** A suggestion as the app keeps it: the model's recipe, unchanged, plus our own id. */
export type SuggestedRecipe = Recipe & { id: string };

/**
 * A starred recipe. It is a copy, so it keeps its title, steps and ingredient
 * names after new suggestions replace its card, or its food is eaten.
 */
export type SavedRecipe = { id: string; savedAt: string; recipe: Recipe };

export type RecipeScreenSnapshot = {
  /** Ticked inventory items. Ones since eaten or deleted are dropped by the screen. */
  selectedIds: string[];
  /** The last successful result, with the names of the food it was made for. */
  lastResult: { recipes: SuggestedRecipe[]; forNames: string[] } | null;
};

/** Gives each recipe in a new result an id, for saving it and as its list key. */
export function toSuggestedRecipes(recipes: Recipe[], now = new Date()): SuggestedRecipe[] {
  return recipes.map((recipe, index) => ({
    ...recipe,
    id: `${now.getTime()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/** A stored recipe with every field the cards need, or null. */
function readRecipe(value: unknown): Recipe | null {
  if (!isRecord(value)) {
    return null;
  }

  const { title, minutes, usesIngredients, extraIngredients, steps } = value;

  if (
    typeof title !== 'string' ||
    !title.trim() ||
    typeof minutes !== 'number' ||
    !Number.isInteger(minutes) ||
    minutes <= 0 ||
    !isStringList(usesIngredients) ||
    usesIngredients.length === 0 ||
    !isStringList(extraIngredients) ||
    !isStringList(steps) ||
    steps.length === 0
  ) {
    return null;
  }

  return { title, minutes, usesIngredients, extraIngredients, steps };
}

function readSuggestedRecipe(value: unknown): SuggestedRecipe | null {
  const recipe = readRecipe(value);

  return recipe && isRecord(value) && typeof value.id === 'string'
    ? { ...recipe, id: value.id }
    : null;
}

function readSavedRecipe(value: unknown): SavedRecipe | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.savedAt !== 'string') {
    return null;
  }

  const recipe = readRecipe(value.recipe);

  return recipe ? { id: value.id, savedAt: value.savedAt, recipe } : null;
}

/** The stored result, keeping its readable recipes; null when none survive. */
function readLastResult(value: unknown): RecipeScreenSnapshot['lastResult'] {
  if (!isRecord(value) || !Array.isArray(value.recipes) || !isStringList(value.forNames)) {
    return null;
  }

  const recipes = value.recipes
    .map(readSuggestedRecipe)
    .filter((recipe): recipe is SuggestedRecipe => recipe !== null);

  return recipes.length > 0 && value.forNames.length > 0
    ? { recipes, forNames: value.forNames }
    : null;
}

/**
 * Reads the snapshot, or null when there is none. A malformed recipe is
 * dropped and a malformed file counts as nothing saved, so a bad write can
 * never stop the tab from opening. Never throws.
 */
export async function loadRecipeSnapshot(): Promise<RecipeScreenSnapshot | null> {
  try {
    const stored = await AsyncStorage.getItem(SNAPSHOT_KEY);

    if (!stored) {
      return null;
    }

    const value: unknown = JSON.parse(stored);

    if (!isRecord(value) || !isStringList(value.selectedIds)) {
      return null;
    }

    return { selectedIds: value.selectedIds, lastResult: readLastResult(value.lastResult) };
  } catch {
    return null;
  }
}

/**
 * Saves the snapshot. Never throws: if saving fails, the tab simply starts
 * from the checklist next time, which is not worth interrupting the student.
 */
export async function saveRecipeSnapshot(snapshot: RecipeScreenSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Nothing to recover: the next save or a fresh start covers it.
  }
}

/**
 * The starred recipes, newest first. Entries that cannot be read are dropped,
 * and a missing or malformed list counts as nothing saved. Never throws.
 */
export async function loadSavedRecipes(): Promise<SavedRecipe[]> {
  try {
    const stored = await AsyncStorage.getItem(SAVED_KEY);
    const value: unknown = stored ? JSON.parse(stored) : [];

    return Array.isArray(value)
      ? value.map(readSavedRecipe).filter((entry): entry is SavedRecipe => entry !== null)
      : [];
  } catch {
    return [];
  }
}

/*
 * Unlike the snapshot, these writes throw when storage fails, so the screen
 * only fills or empties a star once the change is really saved.
 */
async function writeSavedRecipes(saved: SavedRecipe[]): Promise<SavedRecipe[]> {
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(saved));

  return saved;
}

/** Stars a suggestion. Starring one that is already saved changes nothing. */
export async function saveRecipe(
  suggestion: SuggestedRecipe,
  now = new Date(),
): Promise<SavedRecipe[]> {
  const saved = await loadSavedRecipes();

  if (saved.some((entry) => entry.id === suggestion.id)) {
    return saved;
  }

  const { id, ...recipe } = suggestion;

  return writeSavedRecipes([{ id, savedAt: now.toISOString(), recipe }, ...saved]);
}

/** Removes a recipe from the saved list. */
export async function unsaveRecipe(id: string): Promise<SavedRecipe[]> {
  const saved = await loadSavedRecipes();

  return writeSavedRecipes(saved.filter((entry) => entry.id !== id));
}
