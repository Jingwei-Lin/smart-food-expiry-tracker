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
 * The food a result was made for, with each date read again from the
 * inventory as it is now, so a result shown again the next day warns about
 * food that has expired overnight. The most urgent item of a name is used, as
 * in `toRecipeIngredients`. Food no longer in the inventory keeps its name
 * with no date, so it is never marked expired.
 */
export function findRecipeIngredients(
  names: string[],
  candidates: RecipeCandidate[],
): RecipeIngredient[] {
  return names.map((name) => {
    const key = name.trim().toLowerCase();
    const match = candidates.find((candidate) => candidate.name.trim().toLowerCase() === key);

    return { name, daysLeft: match ? match.daysLeft : Number.POSITIVE_INFINITY };
  });
}
