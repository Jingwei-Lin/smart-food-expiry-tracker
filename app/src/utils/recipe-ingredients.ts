import { FoodItem } from '@/types/food-item';
import { daysUntilExpiry, EAT_SOON_DAYS } from '@/utils/expiry-date';

/* Enough for a varied meal without the prompt turning into a shopping list. */
export const MAX_RECIPE_INGREDIENTS = 10;

/** One row of the Recipes tab's checklist. */
export type RecipeCandidate = {
  id: string;
  name: string;
  /** Negative once expired; Infinity when the stored date cannot be read. */
  daysLeft: number;
};

/** One food as the recipe prompt describes it. */
export type RecipeIngredient = {
  name: string;
  daysLeft: number;
};

type CandidateSource = Pick<FoodItem, 'id' | 'name' | 'expiryDate' | 'status'>;

/**
 * Lists every food still in the inventory, most urgent first.
 *
 * Each item keeps its own row, so two cartons of milk bought on different days
 * can be told apart. Expired food is listed too: the student may know it is
 * still fine, so the screen warns about it rather than hiding it.
 */
export function listRecipeCandidates(
  items: CandidateSource[],
  today = new Date(),
): RecipeCandidate[] {
  return items
    .filter((item) => item.status === 'active')
    .map((item) => ({
      id: item.id,
      name: item.name,
      daysLeft: daysUntilExpiry(item.expiryDate, today),
    }))
    .sort((first, second) => first.daysLeft - second.daysLeft);
}

/**
 * The foods ticked the first time the Recipes tab opens: the ones the
 * inventory already calls "eat soon". Expired food is never ticked on the
 * student's behalf.
 */
export function defaultRecipeSelection(candidates: RecipeCandidate[]): string[] {
  return candidates
    .filter((candidate) => candidate.daysLeft >= 0 && candidate.daysLeft <= EAT_SOON_DAYS)
    .slice(0, MAX_RECIPE_INGREDIENTS)
    .map((candidate) => candidate.id);
}

/**
 * "Select all" ticks the most urgent unexpired foods, up to the limit. Expired
 * food is left for the student to tick by hand, so a tap on "Select all" never
 * signs them up to cook with it.
 */
export function selectAllRecipeCandidates(candidates: RecipeCandidate[]): string[] {
  return candidates
    .filter((candidate) => candidate.daysLeft >= 0)
    .slice(0, MAX_RECIPE_INGREDIENTS)
    .map((candidate) => candidate.id);
}

/**
 * Ticks or unticks one food. Once the limit is reached, ticking another does
 * nothing; the screen shows the remaining rows as disabled.
 */
export function toggleRecipeCandidate(selectedIds: string[], id: string): string[] {
  if (selectedIds.includes(id)) {
    return selectedIds.filter((selectedId) => selectedId !== id);
  }

  if (selectedIds.length >= MAX_RECIPE_INGREDIENTS) {
    return selectedIds;
  }

  return [...selectedIds, id];
}

/**
 * Turns the ticked rows into the list the prompt is built from.
 *
 * Two ticked items with the same name become one ingredient, so the prompt
 * never lists "Milk" twice. Candidates are already sorted most urgent first,
 * so the first one seen is the one whose date is kept.
 */
export function toRecipeIngredients(
  candidates: RecipeCandidate[],
  selectedIds: string[],
): RecipeIngredient[] {
  const seenNames = new Set<string>();
  const ingredients: RecipeIngredient[] = [];

  for (const candidate of candidates) {
    if (!selectedIds.includes(candidate.id)) {
      continue;
    }

    const name = candidate.name.trim();
    const key = name.toLowerCase();

    if (seenNames.has(key)) {
      continue;
    }

    seenNames.add(key);
    ingredients.push({ name, daysLeft: candidate.daysLeft });
  }

  return ingredients;
}

/**
 * A recipe's food as it stands in the inventory now, with each date read
 * again so a recipe opened the next day warns about food that has expired
 * overnight. Each name is matched as in `findUsedItemIds`, so the warnings
 * and the Mark buttons agree. Food no longer in the inventory keeps its name
 * with no date, so it is never marked expired.
 */
export function findStockedIngredients(
  names: string[],
  candidates: RecipeCandidate[],
  tickedIds: string[] = [],
): RecipeIngredient[] {
  return names.map((name) => {
    const match = pickItemNamed(name, candidates, tickedIds);

    return { name, daysLeft: match ? match.daysLeft : Number.POSITIVE_INFINITY };
  });
}

/**
 * The items a recipe's "Mark as consumed" or "Mark as wasted" resolves: one
 * per ingredient. No item is used twice, and food no longer in the inventory
 * is skipped.
 */
export function findUsedItemIds(
  names: string[],
  candidates: RecipeCandidate[],
  tickedIds: string[] = [],
): string[] {
  const usedIds: string[] = [];

  for (const name of names) {
    const unused = candidates.filter((candidate) => !usedIds.includes(candidate.id));
    const match = pickItemNamed(name, unused, tickedIds);

    if (match) {
      usedIds.push(match.id);
    }
  }

  return usedIds;
}

/**
 * The item of this name a recipe uses, when two or more share it.
 *
 * 1. The one the student ticked for this result, even if it has expired:
 *    they may have picked an old carton on purpose to use it up.
 * 2. Otherwise the most urgent one still in date, so a saved recipe made
 *    with milk is fine to cook while a fresh carton is in the fridge.
 * 3. Otherwise the most urgent expired one.
 *
 * Candidates are already sorted most urgent first.
 */
function pickItemNamed(
  name: string,
  candidates: RecipeCandidate[],
  tickedIds: string[],
): RecipeCandidate | undefined {
  const key = name.trim().toLowerCase();
  const matches = candidates.filter((candidate) => candidate.name.trim().toLowerCase() === key);

  return (
    matches.find((candidate) => tickedIds.includes(candidate.id)) ??
    matches.find((candidate) => candidate.daysLeft >= 0) ??
    matches[0]
  );
}
