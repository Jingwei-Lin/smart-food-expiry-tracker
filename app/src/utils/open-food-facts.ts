import { addDaysToToday, estimateShelfLife } from '@/utils/shelf-life';

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
  const name = (product.product_name_en || product.product_name || '').trim();

  if (!name) {
    return { outcome: 'not-found' };
  }

  const brand = (product.brands ?? '').split(',')[0].trim();
  const estimate = estimateShelfLife(product.categories_tags ?? []);

  return {
    outcome: 'found',
    product: {
      barcode,
      /* The brand is what is readable on the shelf, so it leads the name. */
      name: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name,
      quantity: (product.quantity ?? '').trim(),
      expiryDate: estimate ? addDaysToToday(estimate.days, today) : '',
      shelfLifeLabel: estimate ? estimate.label : '',
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
