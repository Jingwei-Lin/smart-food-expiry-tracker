import { newerSnapshot, parseSnapshot, pointsNear } from '@/utils/donation-snapshot';
import { type DonationSnapshot } from '@/utils/overpass';

/* Sydney Town Hall, used as "where the phone is". */
const HERE = { lat: -33.8731, lon: 151.2061 };

/* Along a meridian the straight-line distance is exactly this many km per degree. */
const KM_PER_DEGREE = (Math.PI / 180) * 6371;

function snapshot(fetchedAt: string, elements: DonationSnapshot['elements'] = []) {
  return { fetchedAt, elements };
}

/** A named place `km` due south of HERE. */
function placeSouth(id: number, km: number, name = `Place ${id}`) {
  return {
    type: 'node' as const,
    id,
    lat: HERE.lat - km / KM_PER_DEGREE,
    lon: HERE.lon,
    tags: { name },
  };
}

describe('parseSnapshot', () => {
  it('reads back a saved snapshot', () => {
    const saved = snapshot('2026-10-16T09:00:00.000Z', [placeSouth(1, 2)]);

    expect(parseSnapshot(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it.each([
    ['nothing', null],
    ['a list', []],
    ['no date', { elements: [] }],
    ['an unreadable date', { fetchedAt: 'yesterday', elements: [] }],
    ['no element list', { fetchedAt: '2026-10-16T09:00:00.000Z', elements: {} }],
  ])('rejects %s', (_label, value) => {
    expect(parseSnapshot(value)).toBeNull();
  });

  it('drops single elements it cannot read and keeps the rest', () => {
    const parsed = parseSnapshot({
      fetchedAt: '2026-10-16T09:00:00.000Z',
      elements: [
        placeSouth(1, 2),
        { type: 'area', id: 2, lat: HERE.lat, lon: HERE.lon, tags: { name: 'Bad type' } },
        { type: 'node', id: 3, lat: 'north', lon: HERE.lon, tags: { name: 'Bad latitude' } },
        { type: 'node', id: 4, lat: HERE.lat, lon: HERE.lon },
        'junk',
      ],
    });

    expect(parsed?.elements.map((element) => element.id)).toEqual([1]);
  });

  it('keeps only text tags', () => {
    const parsed = parseSnapshot({
      fetchedAt: '2026-10-16T09:00:00.000Z',
      elements: [{ ...placeSouth(1, 2), tags: { name: 'Pantry', opening_hours: 9 } }],
    });

    expect(parsed?.elements[0].tags).toEqual({ name: 'Pantry' });
  });
});

describe('newerSnapshot', () => {
  const bundled = snapshot('2026-10-16T09:00:00.000Z');

  it('uses a saved update that is newer than the bundled data', () => {
    const saved = snapshot('2026-11-01T09:00:00.000Z');

    expect(newerSnapshot(bundled, saved)).toBe(saved);
  });

  it('keeps the bundled data when the saved update is older', () => {
    expect(newerSnapshot(bundled, snapshot('2026-10-01T09:00:00.000Z'))).toBe(bundled);
  });

  it('keeps the bundled data when nothing was saved', () => {
    expect(newerSnapshot(bundled, null)).toBe(bundled);
  });
});

describe('pointsNear', () => {
  it('keeps places within the radius, closest first', () => {
    const points = pointsNear(
      snapshot('2026-10-16T09:00:00.000Z', [
        placeSouth(1, 9.9, 'Edge'),
        placeSouth(2, 10.1, 'Too far'),
        placeSouth(3, 1, 'Close'),
      ]),
      HERE.lat,
      HERE.lon,
      10,
    );

    expect(points.map((point) => point.name)).toEqual(['Close', 'Edge']);
    expect(points[1].distanceKm).toBeCloseTo(9.9, 6);
  });

  it('is empty when nothing is close enough', () => {
    expect(
      pointsNear(snapshot('2026-10-16T09:00:00.000Z', [placeSouth(1, 50)]), HERE.lat, HERE.lon, 10),
    ).toEqual([]);
  });
});
