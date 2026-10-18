import { toExpiryDateString } from '@/utils/expiry-date';

/*
 * Open Food Facts records what a product is, not how long it keeps: its
 * `expiration_date` is the date printed on whichever package a contributor
 * photographed, so it is often already in the past. These estimates are ours,
 * and the add form always shows them as a guess for the student to correct.
 */
type ShelfLifeRule = {
  /** Matched against the product's Open Food Facts category tags. */
  categoryTag: string;
  days: number;
  /** Named in the add form, so the estimate can be judged rather than trusted. */
  label: string;
};

/*
 * First match wins, so the short-lived and more specific categories are listed
 * before the broad ones they sit inside.
 */
const SHELF_LIFE_RULES: ShelfLifeRule[] = [
  { categoryTag: 'fresh-meats', days: 3, label: 'fresh meat' },
  { categoryTag: 'meats', days: 3, label: 'meat' },
  { categoryTag: 'seafood', days: 2, label: 'seafood' },
  { categoryTag: 'fishes', days: 2, label: 'fish' },
  { categoryTag: 'fresh-vegetables', days: 5, label: 'fresh vegetables' },
  { categoryTag: 'fresh-fruits', days: 5, label: 'fresh fruit' },
  { categoryTag: 'salads', days: 4, label: 'salad' },
  { categoryTag: 'fresh-dairy', days: 7, label: 'fresh dairy' },
  { categoryTag: 'milks', days: 7, label: 'milk' },
  { categoryTag: 'yogurts', days: 14, label: 'yoghurt' },
  { categoryTag: 'cheeses', days: 14, label: 'cheese' },
  { categoryTag: 'eggs', days: 21, label: 'eggs' },
  { categoryTag: 'breads', days: 5, label: 'bread' },
  { categoryTag: 'frozen-foods', days: 90, label: 'frozen food' },
  { categoryTag: 'canned-foods', days: 365, label: 'tinned food' },
  { categoryTag: 'groceries', days: 180, label: 'packaged groceries' },
  { categoryTag: 'beverages', days: 180, label: 'drinks' },
  { categoryTag: 'spreads', days: 180, label: 'spreads' },
  { categoryTag: 'snacks', days: 120, label: 'snacks' },
];

export type ShelfLifeEstimate = {
  days: number;
  label: string;
};

/**
 * Estimates how long a scanned product keeps, from its category tags.
 *
 * Returns null when nothing matches, which leaves the student to fill the date
 * in themselves rather than showing them a number we invented.
 */
export function estimateShelfLife(categoryTags: string[]): ShelfLifeEstimate | null {
  /* Tags arrive as "en:fresh-vegetables"; the language prefix is not ours to rely on. */
  const tags = categoryTags.map((tag) => tag.replace(/^[a-z]{2}:/, '').toLowerCase());

  const rule = SHELF_LIFE_RULES.find((candidate) => tags.includes(candidate.categoryTag));

  return rule ? { days: rule.days, label: rule.label } : null;
}

/**
 * Turns a shelf life into the YYYY-MM-DD the add form expects.
 */
export function addDaysToToday(days: number, today = new Date()): string {
  return toExpiryDateString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + days),
  );
}
