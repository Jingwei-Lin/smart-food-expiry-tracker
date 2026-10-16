import {
  type OverpassElement,
  OVERPASS_SERVERS,
  buildSnapshotQuery,
  distanceKm,
  fetchSnapshot,
  osmAddress,
  toDonationPoint,
  toDonationPoints,
  toSnapshot,
} from './overpass';

/* Sydney Town Hall, used as "where the phone is". */
const HERE = { lat: -33.8731, lon: 151.2061 };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function htmlResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => JSON.parse('<html>Too Many Requests</html>'),
  } as Response;
}

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm(HERE.lat, HERE.lon, HERE.lat, HERE.lon)).toBe(0);
  });

  it('is about 111 km for one degree of latitude', () => {
    expect(distanceKm(-33, 151, -34, 151)).toBeCloseTo(111.19, 1);
  });

  it('is the same in both directions', () => {
    const there = { lat: -33.8959, lon: 151.1799 };

    expect(distanceKm(HERE.lat, HERE.lon, there.lat, there.lon)).toBeCloseTo(
      distanceKm(there.lat, there.lon, HERE.lat, HERE.lon),
      10,
    );
  });
});

describe('osmAddress', () => {
  it('prefers addr:full', () => {
    expect(osmAddress({ 'addr:full': '1 Main St, Newtown', 'addr:street': 'Other St' })).toBe(
      '1 Main St, Newtown',
    );
  });

  it('joins house number, street and suburb', () => {
    expect(
      osmAddress({ 'addr:housenumber': '12', 'addr:street': 'King St', 'addr:suburb': 'Newtown' }),
    ).toBe('12 King St, Newtown');
  });

  it('falls back to the city when there is no suburb', () => {
    expect(osmAddress({ 'addr:street': 'King St', 'addr:city': 'Sydney' })).toBe('King St, Sydney');
  });

  it('is empty when there is no address', () => {
    expect(osmAddress({ name: 'Somewhere' })).toBe('');
  });
});

describe('toDonationPoint', () => {
  it('maps a node', () => {
    const element: OverpassElement = {
      type: 'node',
      id: 42,
      lat: HERE.lat,
      lon: HERE.lon,
      tags: {
        name: 'Newtown Pantry',
        social_facility: 'food_bank',
        opening_hours: 'Mo-Fr 09:00-17:00',
        'addr:street': 'King St',
      },
    };

    expect(toDonationPoint(element, HERE.lat, HERE.lon)).toEqual({
      id: 'node/42',
      name: 'Newtown Pantry',
      type: 'Food bank',
      distanceKm: 0,
      hours: 'Mo-Fr 09:00-17:00',
      address: 'King St',
      latitude: HERE.lat,
      longitude: HERE.lon,
    });
  });

  it('uses the centre of a way', () => {
    const point = toDonationPoint(
      {
        type: 'way',
        id: 7,
        center: { lat: -33.9, lon: 151.2 },
        tags: { name: 'Hall', social_facility: 'soup_kitchen' },
      },
      HERE.lat,
      HERE.lon,
    );

    expect(point).toMatchObject({
      id: 'way/7',
      type: 'Soup kitchen',
      latitude: -33.9,
      longitude: 151.2,
      hours: 'Hours not listed',
      address: '',
    });
  });

  it.each([
    ['a community fridge tagged as an amenity', { amenity: 'food_sharing' }, 'Community pantry'],
    [
      'a pantry tagged as a social facility',
      { social_facility: 'food_sharing' },
      'Community pantry',
    ],
    [
      'a food bank listed with other services',
      { social_facility: 'food_bank;outreach' },
      'Food bank',
    ],
    [
      'a soup kitchen listed with other services',
      { social_facility: 'outreach; soup_kitchen' },
      'Soup kitchen',
    ],
  ])('maps %s', (_label, kind, type) => {
    const point = toDonationPoint(
      { type: 'node', id: 1, lat: 0, lon: 0, tags: { name: 'Place', ...kind } },
      0,
      0,
    );

    expect(point?.type).toBe(type);
  });

  it('skips places without a name', () => {
    expect(toDonationPoint({ type: 'node', id: 1, lat: 0, lon: 0, tags: {} }, 0, 0)).toBeNull();
    expect(toDonationPoint({ type: 'node', id: 2, lat: 0, lon: 0 }, 0, 0)).toBeNull();
  });

  it('skips places without coordinates', () => {
    expect(toDonationPoint({ type: 'way', id: 1, tags: { name: 'Lost' } }, 0, 0)).toBeNull();
  });
});

describe('toDonationPoints', () => {
  it('sorts closest first and drops unusable elements', () => {
    const points = toDonationPoints(
      [
        { type: 'node', id: 1, lat: -33.95, lon: 151.2, tags: { name: 'Far' } },
        { type: 'node', id: 2, lat: -33.875, lon: 151.2, tags: { name: 'Near' } },
        { type: 'node', id: 3, lat: -33.9, lon: 151.2 },
      ],
      HERE.lat,
      HERE.lon,
    );

    expect(points.map((point) => point.name)).toEqual(['Near', 'Far']);
  });
});

describe('toSnapshot', () => {
  const fetchedAt = new Date('2026-10-16T09:00:00.000Z');

  it('dates the snapshot', () => {
    expect(toSnapshot([], fetchedAt)).toEqual({
      fetchedAt: '2026-10-16T09:00:00.000Z',
      elements: [],
    });
  });

  it('keeps only the tags a card reads', () => {
    const { elements } = toSnapshot(
      [
        {
          type: 'node',
          id: 1,
          lat: HERE.lat,
          lon: HERE.lon,
          tags: {
            name: 'Pantry',
            social_facility: 'food_bank',
            opening_hours: 'Mo-Fr 09:00-17:00',
            'addr:street': 'George Street',
            amenity: 'social_facility',
            operator: 'Pantry Inc',
            website: 'https://example.org',
          },
        },
      ],
      fetchedAt,
    );

    expect(elements[0].tags).toEqual({
      name: 'Pantry',
      amenity: 'social_facility',
      social_facility: 'food_bank',
      opening_hours: 'Mo-Fr 09:00-17:00',
      'addr:street': 'George Street',
    });
  });

  it("stores a way's centre as its coordinates", () => {
    const { elements } = toSnapshot(
      [{ type: 'way', id: 7, center: { lat: -33.9, lon: 151.1 }, tags: { name: 'Hall' } }],
      fetchedAt,
    );

    expect(elements).toEqual([
      { type: 'way', id: 7, lat: -33.9, lon: 151.1, tags: { name: 'Hall' } },
    ]);
  });

  it('drops elements without a name or coordinates', () => {
    const { elements } = toSnapshot(
      [
        { type: 'node', id: 1, lat: HERE.lat, lon: HERE.lon, tags: { amenity: 'social_facility' } },
        { type: 'way', id: 2, tags: { name: 'No centre' } },
        { type: 'node', id: 3, lat: HERE.lat, lon: HERE.lon, tags: { name: 'Kept' } },
      ],
      fetchedAt,
    );

    expect(elements.map((element) => element.id)).toEqual([3]);
  });

  it('drops Meals on Wheels, which delivers meals rather than taking food in', () => {
    const place = (id: number, name: string) => ({
      type: 'node' as const,
      id,
      lat: HERE.lat,
      lon: HERE.lon,
      tags: { name, social_facility: 'food_bank' },
    });

    const { elements } = toSnapshot(
      [
        place(1, 'Meals on Wheels'),
        place(2, 'Stafford Meals On Wheels'),
        place(3, 'Meals on Wheels Kedron'),
        place(4, 'Addi Road Food Pantry'),
      ],
      fetchedAt,
    );

    expect(elements.map((element) => element.id)).toEqual([4]);
  });
});

describe('buildSnapshotQuery', () => {
  it('asks for every kind of place anywhere in Australia, with a long time limit', () => {
    const query = buildSnapshotQuery();

    expect(query).toContain('[timeout:120]');
    expect(query).toContain('area["ISO3166-1"="AU"][admin_level=2]->.au');
    expect(query).toContain('(food_bank|soup_kitchen|food_sharing)');
    expect(query).toContain('nwr["amenity"="food_sharing"](area.au)');
    expect(query).not.toContain('shelter');
    expect(query).not.toContain('around:');
  });

  it('matches one whole value in a semicolon list', () => {
    const [, pattern] = /"social_facility"~"([^"]+)"/.exec(buildSnapshotQuery()) ?? [];
    const matches = (value: string) => new RegExp(pattern).test(value);

    expect(
      ['food_bank', 'food_bank;outreach', 'outreach; soup_kitchen', 'food_sharing'].map(matches),
    ).toEqual([true, true, true, true]);
    expect(['food_bank_volunteers', 'shelter', 'assisted_living'].map(matches)).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe('fetchSnapshot', () => {
  const realFetch = globalThis.fetch;
  const NOW = new Date('2026-10-16T09:00:00.000Z');
  const pantry = { type: 'node', id: 1, lat: HERE.lat, lon: HERE.lon, tags: { name: 'Pantry' } };
  const timedOut = 'runtime error: Query timed out in "query" at line 1 after 121 seconds.';
  let fetchMock: jest.Mock;

  /* Hangs until the app gives up on it, like an overloaded server. */
  function hangUntilAborted(_url: string, init: RequestInit): Promise<Response> {
    return new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
    });
  }

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.useRealTimers();
  });

  it('returns a snapshot of the answer, dated now', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ elements: [pantry] }));

    await expect(fetchSnapshot(NOW)).resolves.toEqual({
      outcome: 'found',
      snapshot: {
        fetchedAt: '2026-10-16T09:00:00.000Z',
        elements: [{ type: 'node', id: 1, lat: HERE.lat, lon: HERE.lon, tags: { name: 'Pantry' } }],
      },
    });
  });

  it('posts the Australia query and names the app in the User-Agent', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ elements: [] }));

    await fetchSnapshot(NOW);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(url).toBe(OVERPASS_SERVERS[0]);
    expect(init.method).toBe('POST');
    expect(headers['User-Agent']).toMatch(/^SmartFoodExpiryTracker\//);
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(decodeURIComponent(String(init.body))).toBe(`data=${buildSnapshotQuery()}`);
  });

  it('does not ask the backup server once the main one has answered', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ elements: [] }));

    await fetchSnapshot(NOW);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['refuses the client (406)', () => htmlResponse(406)],
    ['is too busy (429)', () => htmlResponse(429)],
    ['reports a runtime error', () => jsonResponse({ elements: [], remark: timedOut })],
  ])('tries the backup server when the main one %s', async (_label, mainAnswer) => {
    fetchMock
      .mockResolvedValueOnce(mainAnswer())
      .mockResolvedValueOnce(jsonResponse({ elements: [pantry] }));

    const result = await fetchSnapshot(NOW);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(OVERPASS_SERVERS);
    expect(result.outcome === 'found' && result.snapshot.elements).toHaveLength(1);
  });

  it('gives up on a server after 130 seconds and tries the backup', async () => {
    jest.useFakeTimers();
    fetchMock
      .mockImplementationOnce(hangUntilAborted)
      .mockResolvedValueOnce(jsonResponse({ elements: [pantry] }));

    const pending = fetchSnapshot(NOW);

    await jest.advanceTimersByTimeAsync(129999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(OVERPASS_SERVERS.length);
    expect(result.outcome).toBe('found');
  });

  it('reports busy when every server hangs', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(hangUntilAborted);

    const pending = fetchSnapshot(NOW);
    await jest.advanceTimersByTimeAsync(130000 * OVERPASS_SERVERS.length);

    await expect(pending).resolves.toEqual({ outcome: 'busy' });
  });

  it('reports busy when every server refuses', async () => {
    fetchMock.mockResolvedValue(htmlResponse(504));

    await expect(fetchSnapshot(NOW)).resolves.toEqual({ outcome: 'busy' });
    expect(fetchMock).toHaveBeenCalledTimes(OVERPASS_SERVERS.length);
  });

  it('reports unavailable with no connection', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(fetchSnapshot(NOW)).resolves.toEqual({ outcome: 'unavailable' });
  });

  it('reports unavailable for a 200 that is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => JSON.parse('<html></html>'),
    } as Response);

    await expect(fetchSnapshot(NOW)).resolves.toEqual({ outcome: 'unavailable' });
  });

  it('never keeps the partial list that comes with a runtime error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ elements: [pantry], remark: timedOut }));

    await expect(fetchSnapshot(NOW)).resolves.toEqual({ outcome: 'busy' });
  });

  it('keeps the places when the remark is not a runtime error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ elements: [pantry], remark: 'Note: the data is from an older snapshot.' }),
    );

    const result = await fetchSnapshot(NOW);

    expect(result.outcome === 'found' && result.snapshot.elements).toHaveLength(1);
  });
});
