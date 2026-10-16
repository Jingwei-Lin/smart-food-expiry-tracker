import {
  type OverpassElement,
  OVERPASS_SERVERS,
  buildQuery,
  buildSnapshotQuery,
  distanceKm,
  fetchDonationPoints,
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

  it('maps shelters', () => {
    const point = toDonationPoint(
      { type: 'node', id: 1, lat: 0, lon: 0, tags: { name: 'Haven', social_facility: 'shelter' } },
      0,
      0,
    );

    expect(point?.type).toBe('Shelter');
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
            website: 'https://example.org',
          },
        },
      ],
      fetchedAt,
    );

    expect(elements[0].tags).toEqual({
      name: 'Pantry',
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
});

describe('buildQuery', () => {
  it('asks Overpass to time out and searches 10 km around the place', () => {
    const query = buildQuery(-33.87, 151.2);

    expect(query).toContain('[timeout:90]');
    expect(query).toContain('(around:10000,-33.87,151.2)');
  });
});

describe('fetchDonationPoints', () => {
  const realFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.useRealTimers();
  });

  it('returns the points, closest first', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        elements: [
          { type: 'node', id: 1, lat: -33.95, lon: 151.2, tags: { name: 'Far' } },
          { type: 'node', id: 2, lat: -33.875, lon: 151.2, tags: { name: 'Near' } },
        ],
      }),
    );

    const result = await fetchDonationPoints(HERE.lat, HERE.lon);

    expect(result.outcome).toBe('found');
    expect(result.outcome === 'found' && result.points.map((point) => point.name)).toEqual([
      'Near',
      'Far',
    ]);
  });

  it('posts the query and names the app in the User-Agent', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ elements: [] }));

    await fetchDonationPoints(HERE.lat, HERE.lon);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(url).toBe('https://overpass-api.de/api/interpreter');
    expect(init.method).toBe('POST');
    expect(headers['User-Agent']).toMatch(/^SmartFoodExpiryTracker\//);
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(decodeURIComponent(String(init.body))).toContain('data=[out:json][timeout:90]');
  });

  it('reports busy when Overpass refuses the client (406)', async () => {
    fetchMock.mockResolvedValue(htmlResponse(406));

    await expect(fetchDonationPoints(HERE.lat, HERE.lon)).resolves.toEqual({ outcome: 'busy' });
  });

  it('returns an empty list when nothing is nearby', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ elements: [] }));

    await expect(fetchDonationPoints(HERE.lat, HERE.lon)).resolves.toEqual({
      outcome: 'found',
      points: [],
    });
  });

  it.each([429, 504])('reports busy for a %i HTML page', async (status) => {
    fetchMock.mockResolvedValue(htmlResponse(status));

    await expect(fetchDonationPoints(HERE.lat, HERE.lon)).resolves.toEqual({ outcome: 'busy' });
  });

  it('reports unavailable with no connection', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(fetchDonationPoints(HERE.lat, HERE.lon)).resolves.toEqual({
      outcome: 'unavailable',
    });
  });

  it('reports unavailable for a 200 that is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => JSON.parse('<html></html>'),
    } as Response);

    await expect(fetchDonationPoints(HERE.lat, HERE.lon)).resolves.toEqual({
      outcome: 'unavailable',
    });
  });

  describe('a 200 that reports a runtime error', () => {
    const timedOut = 'runtime error: Query timed out in "query" at line 1 after 91 seconds.';
    const pantry = { type: 'node', id: 1, lat: HERE.lat, lon: HERE.lon, tags: { name: 'Pantry' } };

    it('tries the backup server instead of saying nothing is nearby', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ elements: [], remark: timedOut }))
        .mockResolvedValueOnce(jsonResponse({ elements: [pantry] }));

      const result = await fetchDonationPoints(HERE.lat, HERE.lon);

      expect(result.outcome === 'found' && result.points.map((point) => point.name)).toEqual([
        'Pantry',
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(OVERPASS_SERVERS.length);
    });

    it('reports busy when every server reports one', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ elements: [], remark: timedOut }));

      await expect(fetchDonationPoints(HERE.lat, HERE.lon)).resolves.toEqual({ outcome: 'busy' });
    });

    it('does not show the partial list that came with it', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ elements: [pantry], remark: timedOut }));

      await expect(fetchDonationPoints(HERE.lat, HERE.lon)).resolves.toEqual({ outcome: 'busy' });
    });
  });

  it('keeps the points when the remark is not a runtime error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        elements: [{ type: 'node', id: 1, lat: HERE.lat, lon: HERE.lon, tags: { name: 'Pantry' } }],
        remark: 'Note: the data is from an older snapshot.',
      }),
    );

    const result = await fetchDonationPoints(HERE.lat, HERE.lon);

    expect(result.outcome === 'found' && result.points).toHaveLength(1);
  });

  it('gives up after 95 seconds, reports busy and does not try another server', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    );

    const pending = fetchDonationPoints(HERE.lat, HERE.lon);
    jest.advanceTimersByTime(95000);

    await expect(pending).resolves.toEqual({ outcome: 'busy' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tries the backup server when the main one refuses', async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse(406)).mockResolvedValueOnce(
      jsonResponse({
        elements: [{ type: 'node', id: 1, lat: HERE.lat, lon: HERE.lon, tags: { name: 'Pantry' } }],
      }),
    );

    const result = await fetchDonationPoints(HERE.lat, HERE.lon);

    expect(result.outcome === 'found' && result.points.map((point) => point.name)).toEqual([
      'Pantry',
    ]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(OVERPASS_SERVERS);
  });

  it('reports busy when every server refuses', async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse(429)).mockResolvedValueOnce(htmlResponse(504));

    await expect(fetchDonationPoints(HERE.lat, HERE.lon)).resolves.toEqual({ outcome: 'busy' });
    expect(fetchMock).toHaveBeenCalledTimes(OVERPASS_SERVERS.length);
  });

  it('does not ask the backup server once the main one has answered', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ elements: [] }));

    await fetchDonationPoints(HERE.lat, HERE.lon);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('buildSnapshotQuery', () => {
  it('asks for whole-value matches anywhere in NSW, with a long time limit', () => {
    const query = buildSnapshotQuery();

    expect(query).toContain('[timeout:120]');
    expect(query).toContain('area["ISO3166-2"="AU-NSW"]->.nsw');
    expect(query).toContain('["social_facility"~"^(food_bank|soup_kitchen|shelter)$"](area.nsw)');
    expect(query).not.toContain('around:');
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

  it('posts the NSW query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ elements: [] }));

    await fetchSnapshot(NOW);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(OVERPASS_SERVERS[0]);
    expect(init.method).toBe('POST');
    expect(decodeURIComponent(String(init.body))).toBe(`data=${buildSnapshotQuery()}`);
  });

  it.each([
    ['refuses', () => htmlResponse(429)],
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
});
