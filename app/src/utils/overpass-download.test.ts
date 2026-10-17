import { OVERPASS_SERVERS, buildSnapshotQuery, fetchDonationElements } from './overpass-download';

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

describe('fetchDonationElements', () => {
  const realFetch = globalThis.fetch;
  const pantry = { type: 'node', id: 1, lat: -33.8731, lon: 151.2061, tags: { name: 'Pantry' } };
  const timedOut = 'runtime error: Query timed out in "query" at line 1 after 121 seconds.';
  let fetchMock: jest.Mock;

  /* Hangs until the script gives up on it, like an overloaded server. */
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

  it('returns the elements of the answer as they came', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ elements: [pantry] }));

    await expect(fetchDonationElements()).resolves.toEqual({
      outcome: 'found',
      elements: [pantry],
    });
  });

  it('posts the Australia query and names the app in the User-Agent', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ elements: [] }));

    await fetchDonationElements();

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

    await fetchDonationElements();

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

    const result = await fetchDonationElements();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(OVERPASS_SERVERS);
    expect(result.outcome === 'found' && result.elements).toHaveLength(1);
  });

  it('gives up on a server after 130 seconds and tries the backup', async () => {
    jest.useFakeTimers();
    fetchMock
      .mockImplementationOnce(hangUntilAborted)
      .mockResolvedValueOnce(jsonResponse({ elements: [pantry] }));

    const pending = fetchDonationElements();

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

    const pending = fetchDonationElements();
    await jest.advanceTimersByTimeAsync(130000 * OVERPASS_SERVERS.length);

    await expect(pending).resolves.toEqual({ outcome: 'busy' });
  });

  it('reports busy when every server refuses', async () => {
    fetchMock.mockResolvedValue(htmlResponse(504));

    await expect(fetchDonationElements()).resolves.toEqual({ outcome: 'busy' });
    expect(fetchMock).toHaveBeenCalledTimes(OVERPASS_SERVERS.length);
  });

  it('reports unavailable with no connection', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(fetchDonationElements()).resolves.toEqual({ outcome: 'unavailable' });
  });

  it('reports unavailable for a 200 that is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => JSON.parse('<html></html>'),
    } as Response);

    await expect(fetchDonationElements()).resolves.toEqual({ outcome: 'unavailable' });
  });

  it('never keeps the partial list that comes with a runtime error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ elements: [pantry], remark: timedOut }));

    await expect(fetchDonationElements()).resolves.toEqual({ outcome: 'busy' });
  });

  it('keeps the places when the remark is not a runtime error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ elements: [pantry], remark: 'Note: the data is from an older snapshot.' }),
    );

    const result = await fetchDonationElements();

    expect(result.outcome === 'found' && result.elements).toHaveLength(1);
  });
});
