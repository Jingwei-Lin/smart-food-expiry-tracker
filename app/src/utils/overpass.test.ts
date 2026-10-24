import {
  type OverpassElement,
  distanceKm,
  formatOpeningHours,
  osmAddress,
  toDonationPoint,
  toDonationPoints,
  toSnapshot,
} from './overpass';

/* Sydney Town Hall, used as "where the phone is". */
const HERE = { lat: -33.8731, lon: 151.2061 };

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

describe('formatOpeningHours', () => {
  it.each([
    ['Mo-Sa 12:00-16:00; Su off', 'Mon-Sat 12:00-16:00 · Sun closed'],
    ['Tu 12:00-15:30; Fr 08:30-13:30', 'Tue 12:00-15:30 · Fri 08:30-13:30'],
    ['We,Th 18:30-19:30', 'Wed, Thu 18:30-19:30'],
    ['Mo-Fr 07:30-14:00; PH off', 'Mon-Fri 07:30-14:00 · closed on public holidays'],
    [
      'Mo-Fr 09:00-12:00,13:00-16:00; Sa 09:00-12:00',
      'Mon-Fri 09:00-12:00, 13:00-16:00 · Sat 09:00-12:00',
    ],
    ['Mo-Fr,PH 09:00-12:00', 'Mon-Fri, public holidays 09:00-12:00'],
    ['24/7', 'Open 24 hours'],
  ])('spells out "%s"', (raw, readable) => {
    expect(formatOpeningHours(raw)).toBe(readable);
  });

  it('leaves what it does not recognise as written', () => {
    expect(formatOpeningHours('by appointment')).toBe('by appointment');
    expect(formatOpeningHours('Mo 09:00-12:00 "call first"')).toBe('Mon 09:00-12:00 "call first"');
  });

  it('does not touch letters inside other words', () => {
    expect(formatOpeningHours('Summer Sa 10:00-12:00')).toBe('Summer Sat 10:00-12:00');
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
      hours: 'Mon-Fri 09:00-17:00',
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
            phone: '+61 2 9000 0000',
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
      phone: '+61 2 9000 0000',
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
