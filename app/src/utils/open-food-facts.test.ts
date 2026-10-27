import { lookupProduct, parseProductResponse } from '@/utils/open-food-facts';

const today = new Date(2026, 8, 17);

describe('parseProductResponse', () => {
  it('reads the name, quantity and an expiry estimated from the category', () => {
    const result = parseProductResponse(
      '9300601000517',
      {
        status: 1,
        product: {
          product_name: 'Full Cream Milk',
          brands: 'Dairy Farmers',
          quantity: '2 L',
          categories_tags: ['en:dairies', 'en:milks'],
        },
      },
      today,
    );

    expect(result).toEqual({
      outcome: 'found',
      product: {
        barcode: '9300601000517',
        name: 'Dairy Farmers Full Cream Milk',
        quantity: '2 L',
        expiryDate: '2026-09-24',
        shelfLifeLabel: 'milk',
        category: 'Dairy',
      },
    });
  });

  it('does not repeat a brand the product name already carries', () => {
    const result = parseProductResponse(
      '3017620422003',
      {
        status: 1,
        product: { product_name: 'Nutella', brands: 'Nutella, Ferrero' },
      },
      today,
    );

    expect(result).toMatchObject({ product: { name: 'Nutella' } });
  });

  it('prefers the English name when the product carries both', () => {
    const result = parseProductResponse(
      '1',
      {
        status: 1,
        product: { product_name: 'Pâtes à tartiner', product_name_en: 'Hazelnut spread' },
      },
      today,
    );

    expect(result).toMatchObject({ product: { name: 'Hazelnut spread' } });
  });

  it('leaves the expiry empty when no category matches, rather than guessing', () => {
    const result = parseProductResponse(
      '1',
      { status: 1, product: { product_name: 'Mystery jar', categories_tags: ['en:unicorns'] } },
      today,
    );

    expect(result).toMatchObject({
      product: {
        expiryDate: '',
        shelfLifeLabel: '',
        category: 'Others',
      },
    });
  });

  it('uses Others when Open Food Facts has no category tags', () => {
    const result = parseProductResponse(
      '1',
      { status: 1, product: { product_name: 'Mystery jar' } },
      today,
    );

    expect(result).toMatchObject({
      outcome: 'found',
      product: { category: 'Others' },
    });
  });

  it('maps the Open Food Facts fishes tag to Seafood', () => {
    const result = parseProductResponse(
      '1',
      {
        status: 1,
        product: {
          product_name: 'Fresh fish',
          categories_tags: ['en:fishes'],
        },
      },
      today,
    );

    expect(result).toMatchObject({
      outcome: 'found',
      product: { category: 'Seafood' },
    });
  });

  it.each([
    ['en:fishes', 'Seafood'],
    ['en:frozen-fishes', 'Seafood'],
    ['en:fresh-vegetables', 'Veg'],
    ['en:fresh-fruits', 'Fruit'],
    ['en:cheeses', 'Dairy'],
    ['en:fresh-meats', 'Meat'],
    ['en:breads', 'Bread'],
  ])('files the whole tag %s under %s', (tag, category) => {
    const result = parseProductResponse(
      '1',
      { status: 1, product: { product_name: 'Item', categories_tags: [tag] } },
      today,
    );

    expect(result).toMatchObject({ product: { category } });
  });

  it.each([
    'en:canned-vegetables',
    'en:fruits-and-vegetables-based-foods',
    'en:egg-noodles',
    'en:milk-chocolates',
    'en:fish-sauces',
    'en:chicken-soups',
    'en:fruit-juices',
    'en:salad-dressings',
  ])('does not file %s by a word that happens to be in it', (tag) => {
    const result = parseProductResponse(
      '1',
      { status: 1, product: { product_name: 'Item', categories_tags: [tag] } },
      today,
    );

    expect(result).toMatchObject({ product: { category: 'Others' } });
  });

  it('files a product under the first category in the list when its tags match two', () => {
    const result = parseProductResponse(
      '1',
      {
        status: 1,
        product: {
          product_name: 'Fish pie',
          categories_tags: ['en:fresh-vegetables', 'en:fishes'],
        },
      },
      today,
    );

    expect(result).toMatchObject({ product: { category: 'Seafood' } });
  });

  it.each([
    ['the product is unknown', { status: 0 }],
    ['the response has no product', { status: 1 }],
    ['the product has no usable name', { status: 1, product: { product_name: '   ' } }],
  ])('reports not-found when %s', (_case, body) => {
    expect(parseProductResponse('1', body, today)).toEqual({ outcome: 'not-found' });
  });
});

describe('lookupProduct', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('asks Open Food Facts for the scanned barcode', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 1, product: { product_name: 'Nutella' } }),
    });

    const result = await lookupProduct('3017620422003');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/product/3017620422003.json');
    expect(fetchMock.mock.calls[0][0]).toContain('categories_tags');
    expect(result).toMatchObject({ outcome: 'found' });
  });

  it('reports not-found when the API has never heard of the barcode', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    expect(await lookupProduct('0000000000000')).toEqual({ outcome: 'not-found' });
  });

  it('reports unavailable when there is no connection, instead of throwing', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));

    expect(await lookupProduct('3017620422003')).toEqual({ outcome: 'unavailable' });
  });

  it('reports unavailable when the API itself is failing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    expect(await lookupProduct('3017620422003')).toEqual({ outcome: 'unavailable' });
  });
});
