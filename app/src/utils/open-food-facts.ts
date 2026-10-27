import type { FoodCategory } from '@/types/food-item';
import { addDaysToToday, estimateShelfLife, normalizeCategoryTag } from '@/utils/shelf-life';

/*
 * Only the fields the add form can use are requested, which keeps the response
 * small on a phone's mobile data.
 */
const FIELDS = 'code,product_name,product_name_en,brands,quantity,categories_tags';

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';

/* Open Food Facts asks every client to identify itself. */
const USER_AGENT = 'SmartFoodExpiryTracker/1.0 (COMP5216-2026-GP-23 student project)';

const REQUEST_TIMEOUT_MS = 8000;

export type ScannedProduct = {
  barcode: string;
  name: string;
  quantity: string;
  /** Empty when no category matched, so the student fills the date in themselves. */
  expiryDate: string;
  /** Names the category the estimate came from, or empty when there was none. */
  shelfLifeLabel: string;
  category: FoodCategory;
};

export type ProductLookupResult =
  | { outcome: 'found'; product: ScannedProduct }
  | { outcome: 'not-found' }
  | { outcome: 'unavailable' };

type OpenFoodFactsResponse = {
  status?: number;
  product?: {
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    quantity?: string;
    categories_tags?: string[];
  };
};

/*
 * Open Food Facts tags that put a product in each category, checked in order so
 * a product tagged as both fish and vegetables is filed as Seafood. Tags are
 * matched whole: "en:fish-sauces" or "en:milk-chocolates" are condiments and
 * sweets, and must not be mistaken for fish or dairy just because of a word in
 * them. The shelf-life estimate uses the same tag names (see shelf-life.ts).
 */
const CATEGORY_TAGS: [Exclude<FoodCategory, 'Others'>, string[]][] = [
  ['Seafood', ['seafood', 'fishes', 'frozen-fishes', 'crustaceans', 'molluscs']],
  ['Veg', ['fresh-vegetables', 'vegetables', 'salads']],
  ['Fruit', ['fresh-fruits', 'fruits']],
  ['Dairy', ['fresh-dairy', 'milks', 'yogurts', 'cheeses', 'butters', 'creams', 'eggs']],
  ['Meat', ['fresh-meats', 'meats', 'poultries']],
  ['Bread', ['breads']],
];

/**
 * Maps Open Food Facts category tags to the categories used by the add form.
 * Anything that does not match a tag above exactly is Others.
 */
function mapFoodCategory(tags: string[]): FoodCategory {
  const normalized = tags.map(normalizeCategoryTag);

  const match = CATEGORY_TAGS.find(([, categoryTags]) =>
    categoryTags.some((categoryTag) => normalized.includes(categoryTag)),
  );

  return match ? match[0] : 'Others';
}

/**
 * Turns an Open Food Facts response into the fields the add form pre-fills.
 *
 * Kept apart from the request so it can be tested without a network, and
 * because the API returns plenty of shapes: a missing product, a product with
 * no name, or a name in the contributor's own language.
 */
export function parseProductResponse(
  barcode: string,
  body: OpenFoodFactsResponse,
  today = new Date(),
): ProductLookupResult {
  if (body.status !== 1 || !body.product) {
    return { outcome: 'not-found' };
  }

  const { product } = body;

  const englishName = product.product_name_en?.trim();
  const defaultName = product.product_name?.trim();
  const name = englishName || defaultName || '';

  if (!name) {
    return { outcome: 'not-found' };
  }

  const brand = (product.brands ?? '').split(',')[0].trim();
  const tags = product.categories_tags ?? [];

  const estimate = estimateShelfLife(tags);
  const category = mapFoodCategory(tags);

  return {
    outcome: 'found',
    product: {
      barcode,
      /* The brand is what is readable on the shelf, so it leads the name. */
      name: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name,
      quantity: (product.quantity ?? '').trim(),
      expiryDate: estimate ? addDaysToToday(estimate.days, today) : '',
      shelfLifeLabel: estimate ? estimate.label : '',
      category,
    },
  };
}

/**
 * Looks a scanned barcode up in Open Food Facts.
 *
 * Never throws: with no signal, a slow response or a failing API, the caller
 * gets `unavailable` and sends the student to manual entry instead.
 */
export async function lookupProduct(barcode: string): Promise<ProductLookupResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${PRODUCT_URL}/${barcode}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    if (!response.ok) {
      return response.status === 404 ? { outcome: 'not-found' } : { outcome: 'unavailable' };
    }

    return parseProductResponse(barcode, await response.json());
  } catch {
    return { outcome: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
