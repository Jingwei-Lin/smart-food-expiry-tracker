
import { addDaysToToday, estimateShelfLife } from '@/utils/shelf-life';
import type { FoodCategory } from '@/types/food-item';

/*
 * Only the fields the add form can use are requested, which keeps the response
 * small on a phone's mobile data.
 */
const FIELDS = 'code,product_name,product_name_en,brands,quantity,categories_tags';

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';

/* Open Food Facts asks every client to identify itself. */
const USER_AGENT =
  'SmartFoodExpiryTracker/1.0 (COMP5216-2026-GP-23 student project)';

const REQUEST_TIMEOUT_MS = 8000;

export type ScannedProduct = {
  barcode: string;
  name: string;
  quantity: string;
  /** Empty when no shelf-life estimate is available. */
  expiryDate: string;
  /** Names the category used for the estimate, or empty when unavailable. */
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

/**
 * Maps Open Food Facts category tags to the categories used by the Add page.
 *
 * Open Food Facts tags can look like:
 *   en:fresh-vegetables
 *   en:fish
 *   en: dairy-products
 *
 * Unknown or missing categories default to Others.
 */
function mapFoodCategory(tags: string[]): FoodCategory {
  const categories = tags.map((tag) =>
    tag
      .toLowerCase()
      .replace(/^en:/, '')
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .trim(),
  );

  const hasExactOrChildCategory = (...keywords: string[]) =>
    categories.some((tag) =>
      keywords.some(
        (keyword) =>
          tag === keyword || tag.startsWith(`${keyword} `),
      ),
    );

  // Check seafood before broader food groups.
  if (
    hasExactOrChildCategory(
      'seafood',
      'fish',
      'fishes',
      'shellfish',
      'crustacean',
      'crustaceans',
      'mollusc',
      'molluscs',
    )
  ) {
    return 'Seafood';
  }

  if (
    hasExactOrChildCategory(
      'vegetable',
      'vegetables',
      'fresh vegetable',
      'fresh vegetables',
      'leafy green',
      'leafy greens',
      'salad',
      'legume',
      'legumes',
    )
  ) {
    return 'Veg';
  }

  if (
    hasExactOrChildCategory(
      'fruit',
      'fruits',
      'fresh fruit',
      'fresh fruits',
    )
  ) {
    return 'Fruit';
  }

  if (
    hasExactOrChildCategory(
      'dairy',
      'dairies',
      'dairy product',
      'dairy products',
      'milk',
      'cheese',
      'yogurt',
      'yoghurts',
      'yoghurt',
      'butter',
      'cream',
      'egg',
      'eggs',
    )
  ) {
    return 'Dairy';
  }

  if (
    hasExactOrChildCategory(
      'meat',
      'meats',
      'poultry',
      'chicken',
      'beef',
      'pork',
      'lamb',
      'turkey',
      'ham',
      'bacon',
      'sausage',
    )
  ) {
    return 'Meat';
  }

  if (
    hasExactOrChildCategory(
      'bread',
      'breads',
      'bakery',
      'baguette',
      'loaf',
      'pastry',
    )
  ) {
    return 'Bread';
  }

  return 'Others';
}

/**
 * Turns an Open Food Facts response into the fields the add form pre-fills.
 *
 * Kept separate from the request so it can be tested without a network.
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
      name:
        brand && !name.toLowerCase().includes(brand.toLowerCase())
          ? `${brand} ${name}`
          : name,
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
 * Never throws: with a slow response or a failing API, the caller gets
 * `unavailable` and can continue with manual entry.
 */
export async function lookupProduct(
  barcode: string,
): Promise<ProductLookupResult> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${PRODUCT_URL}/${barcode}.json?fields=${FIELDS}`,
      {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return response.status === 404
        ? { outcome: 'not-found' }
        : { outcome: 'unavailable' };
    }

    return parseProductResponse(barcode, await response.json());
  } catch {
    return { outcome: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
