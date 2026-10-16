import { fireEvent, render } from '@testing-library/react-native';
import * as Location from 'expo-location';

import DonationPointsScreen from '@/app/(tabs)/donation-points';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  geocodeAsync: jest.fn(),
}));

/* Sydney Town Hall, used as "where the phone is". */
const HERE = { latitude: -33.8731, longitude: 151.2061 };
const FITZROY = { latitude: -37.7983, longitude: 144.9784 };
const PERTH = { latitude: -31.9523, longitude: 115.8613 };

/*
 * Stands in for the bundled file. The names are made up so a test can't pass
 * by accident on the real data. Places are put due south of HERE, where the
 * straight-line distance is exactly km / (km per degree of latitude).
 */
jest.mock('@/data/donation-points-au.json', () => {
  const south = (km: number) => -33.8731 - km / ((Math.PI / 180) * 6371);

  return {
    fetchedAt: '2026-10-16T12:04:31.816Z',
    elements: [
      {
        type: 'node',
        id: 2,
        lat: south(3),
        lon: 151.2061,
        tags: { name: 'Soup Hall', social_facility: 'soup_kitchen' },
      },
      {
        type: 'node',
        id: 1,
        lat: south(1),
        lon: 151.2061,
        tags: {
          name: 'Close Pantry',
          social_facility: 'food_bank',
          'addr:housenumber': '1',
          'addr:street': 'George Street',
        },
      },
      {
        type: 'node',
        id: 3,
        lat: south(50),
        lon: 151.2061,
        tags: { name: 'Far Pantry', social_facility: 'food_bank' },
      },
      {
        type: 'node',
        id: 4,
        lat: -37.7983,
        lon: 144.9784,
        tags: { name: 'Fitzroy Pantry', social_facility: 'food_bank' },
      },
    ],
  };
});

const location = jest.mocked(Location);
const realFetch = globalThis.fetch;

function at(coords: { latitude: number; longitude: number }) {
  return { coords, timestamp: Date.now() } as Location.LocationObject;
}

/** The card names on screen, top to bottom. */
function shownPlaces(view: Awaited<ReturnType<typeof render>>): string[] {
  return view
    .queryAllByText(/^(Close Pantry|Soup Hall|Far Pantry|Fitzroy Pantry)$/)
    .map((node) => String(node.props.children));
}

async function searchSuburb(view: Awaited<ReturnType<typeof render>>, suburb: string) {
  if (!view.queryByLabelText('Suburb')) {
    await fireEvent.press(view.getByLabelText('Change suburb'));
  }

  const input = view.getByLabelText('Suburb');

  await fireEvent.changeText(input, suburb);
  await fireEvent(input, 'submitEditing');
}

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = jest.fn();

  location.requestForegroundPermissionsAsync.mockResolvedValue({
    status: 'granted',
  } as Location.LocationPermissionResponse);
  location.hasServicesEnabledAsync.mockResolvedValue(true);
  location.getLastKnownPositionAsync.mockResolvedValue(at(HERE));
  location.getCurrentPositionAsync.mockResolvedValue(at(HERE));
  location.reverseGeocodeAsync.mockResolvedValue([
    { city: 'Sydney', region: 'NSW', street: 'Pitt Street', streetNumber: '5' },
  ] as Location.LocationGeocodedAddress[]);
  location.geocodeAsync.mockResolvedValue([FITZROY] as Location.LocationGeocodedLocation[]);
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('DonationPointsScreen', () => {
  it('lists the bundled places within 10 km of the phone, closest first, without downloading', async () => {
    const view = await render(<DonationPointsScreen />);

    await view.findByText('Close Pantry');

    expect(shownPlaces(view)).toEqual(['Close Pantry', 'Soup Hall']);
    expect(view.getByText('CLOSEST TO YOU')).toBeTruthy();
    expect(view.getByText('1.0 km')).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('says where the data comes from and how old it is', async () => {
    const view = await render(<DonationPointsScreen />);

    expect(
      await view.findByText('Data © OpenStreetMap contributors, as of 16 Oct 2026'),
    ).toBeTruthy();
  });

  it('uses a recent position instead of waiting for a fresh fix', async () => {
    const view = await render(<DonationPointsScreen />);
    await view.findByText('Close Pantry');

    expect(location.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 10 * 60 * 1000 });
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('asks for a fresh fix when there is no recent position', async () => {
    location.getLastKnownPositionAsync.mockResolvedValue(null);

    const view = await render(<DonationPointsScreen />);
    await view.findByText('Close Pantry');

    expect(location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('fills in a missing address after the list shows', async () => {
    let answerLookup: (places: Location.LocationGeocodedAddress[]) => void = () => undefined;
    location.reverseGeocodeAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          answerLookup = resolve;
        }),
    );

    const view = await render(<DonationPointsScreen />);

    expect(await view.findByText(/Looking up address…/)).toBeTruthy();
    expect(view.getByText(/1 George Street/)).toBeTruthy();

    answerLookup([
      { city: 'Sydney', region: 'NSW', street: 'Pitt Street', streetNumber: '5' },
    ] as Location.LocationGeocodedAddress[]);

    expect(await view.findByText(/5 Pitt Street, Sydney/)).toBeTruthy();
  });

  it('still lists the places when the suburb name for the header cannot be found', async () => {
    location.reverseGeocodeAsync.mockRejectedValue(new Error('Geocoder unavailable'));

    const view = await render(<DonationPointsScreen />);

    expect(await view.findByText('Close Pantry')).toBeTruthy();
    expect(view.getByText('Your location')).toBeTruthy();
    expect(await view.findByText(/Address not listed/)).toBeTruthy();
  });

  it('offers a suburb search when location access is off, and searches the whole country', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
    } as Location.LocationPermissionResponse);

    const view = await render(<DonationPointsScreen />);

    expect(await view.findByText(/Location access is off for this app/)).toBeTruthy();

    await fireEvent.press(view.getByText('Search a suburb'));
    await searchSuburb(view, 'Fitzroy VIC');

    expect(await view.findByText('Fitzroy Pantry')).toBeTruthy();
    expect(location.geocodeAsync).toHaveBeenCalledWith('Fitzroy VIC, Australia');
    expect(view.getByText('CLOSEST TO FITZROY VIC')).toBeTruthy();
    expect(shownPlaces(view)).toEqual(['Fitzroy Pantry']);
  });

  it('says so when location services are off', async () => {
    location.hasServicesEnabledAsync.mockResolvedValue(false);

    const view = await render(<DonationPointsScreen />);

    expect(await view.findByText(/Location services are turned off/)).toBeTruthy();
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('says nothing is listed near a suburb with no places within 10 km', async () => {
    location.geocodeAsync.mockResolvedValue([PERTH] as Location.LocationGeocodedLocation[]);

    const view = await render(<DonationPointsScreen />);
    await view.findByText('Close Pantry');
    await searchSuburb(view, 'Perth WA');

    expect(await view.findByText('No donation points nearby')).toBeTruthy();
    expect(shownPlaces(view)).toEqual([]);
  });

  it('asks for the state when a suburb cannot be found', async () => {
    location.geocodeAsync.mockResolvedValue([]);

    const view = await render(<DonationPointsScreen />);
    await view.findByText('Close Pantry');
    await searchSuburb(view, 'Nowhereville');

    expect(
      await view.findByText(
        'Couldn\'t find "Nowhereville". Check the spelling, add the state, and try again.',
      ),
    ).toBeTruthy();
  });

  describe('going back to the phone after a suburb search', () => {
    it('only offers "Use my location" once a suburb has been searched', async () => {
      const view = await render(<DonationPointsScreen />);
      await view.findByText('Close Pantry');

      await fireEvent.press(view.getByLabelText('Change suburb'));
      expect(view.queryByText('Use my location')).toBeNull();

      await searchSuburb(view, 'Fitzroy VIC');
      await view.findByText('Fitzroy Pantry');
      await fireEvent.press(view.getByLabelText('Change suburb'));

      expect(view.getByText('Use my location')).toBeTruthy();
    });

    it('lists the places around the phone again', async () => {
      const view = await render(<DonationPointsScreen />);
      await view.findByText('Close Pantry');
      await searchSuburb(view, 'Fitzroy VIC');
      await view.findByText('Fitzroy Pantry');

      await fireEvent.press(view.getByLabelText('Change suburb'));
      await fireEvent.press(view.getByText('Use my location'));

      expect(await view.findByText('Close Pantry')).toBeTruthy();
      expect(view.getByText('CLOSEST TO YOU')).toBeTruthy();
      expect(shownPlaces(view)).toEqual(['Close Pantry', 'Soup Hall']);
      expect(location.getLastKnownPositionAsync).toHaveBeenCalledTimes(2);
      expect(view.queryByText('Use my location')).toBeNull();
    });

    it('retries near the phone, not the old suburb, after going back', async () => {
      const view = await render(<DonationPointsScreen />);
      await view.findByText('Close Pantry');
      await searchSuburb(view, 'Fitzroy VIC');
      await view.findByText('Fitzroy Pantry');

      location.hasServicesEnabledAsync.mockResolvedValue(false);
      await fireEvent.press(view.getByLabelText('Change suburb'));
      await fireEvent.press(view.getByText('Use my location'));
      await view.findByText(/Location services are turned off/);

      location.hasServicesEnabledAsync.mockResolvedValue(true);
      await fireEvent.press(view.getByText('Try again'));

      expect(await view.findByText('Close Pantry')).toBeTruthy();
      expect(location.geocodeAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('the place named at the top', () => {
    it('says it is finding the location while the phone looks', async () => {
      location.getLastKnownPositionAsync.mockReturnValue(new Promise(() => undefined));

      const view = await render(<DonationPointsScreen />);

      expect(view.getByText('Finding your location…')).toBeTruthy();
    });

    it('names the suburb, not the phone, while a suburb loads', async () => {
      const view = await render(<DonationPointsScreen />);
      await view.findByText('Close Pantry');

      location.geocodeAsync.mockReturnValue(new Promise(() => undefined));
      await searchSuburb(view, 'Fitzroy VIC');

      expect(view.getByText('Fitzroy VIC')).toBeTruthy();
      expect(view.queryByText('Finding your location…')).toBeNull();
    });
  });
});
