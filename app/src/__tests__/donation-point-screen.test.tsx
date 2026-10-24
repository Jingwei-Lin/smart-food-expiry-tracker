import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking, Share } from 'react-native';

import DonationPointScreen from '@/app/donation-point/[id]';
import type { FoodItem } from '@/types/food-item';

/* The route's params, as the donation points list passes them. */
const mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

/*
 * Stands in for the bundled file, with made-up places so a test can't pass by
 * accident on the real data: one with hours, an address and two phone numbers,
 * and one with none of them.
 */
jest.mock('@/data/donation-points-au.json', () => ({
  fetchedAt: '2026-10-16T12:04:31.816Z',
  elements: [
    {
      type: 'node',
      id: 1,
      lat: -33.9,
      lon: 151.18,
      tags: {
        name: 'Close Pantry',
        social_facility: 'food_bank',
        opening_hours: 'Mo-Fr 09:00-15:00',
        'addr:housenumber': '1',
        'addr:street': 'George Street',
        phone: '+61 2 9000 0000;+61 2 9000 0001',
      },
    },
    {
      type: 'way',
      id: 2,
      lat: -33.91,
      lon: 151.19,
      tags: { name: 'Soup Hall', social_facility: 'soup_kitchen' },
    },
  ],
}));

const mockInventory: { activeItems: FoodItem[]; resolveItem: jest.Mock } = {
  activeItems: [],
  resolveItem: jest.fn(),
};

jest.mock('@/context/inventory-context', () => ({
  useInventory: () => mockInventory,
}));

function food(id: string, name: string, expiryDate: string): FoodItem {
  return {
    id,
    name,
    quantity: '1',
    expiryDate,
    storageLocation: 'fridge',
    reminderDaysBefore: 1,
    reminderRuleVersion: 2,
    notes: '',
    createdAt: '2026-10-01T00:00:00.000Z',
    status: 'active',
  };
}

/* Wednesday 21 October 2026, at the given time, so "Open now" and the badges don't depend on today. */
function setNow(hour: number) {
  jest.useFakeTimers({ now: new Date(2026, 9, 21, hour, 0) });
}

async function renderPlace(params: Record<string, string>) {
  Object.assign(mockParams, params);

  return render(<DonationPointScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();

  for (const key of Object.keys(mockParams)) {
    delete mockParams[key];
  }

  mockInventory.activeItems = [];
  mockInventory.resolveItem.mockResolvedValue(undefined);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  setNow(10);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the top of the screen', () => {
  it('names the place, its kind and how far away it is', async () => {
    const view = await renderPlace({ id: 'node-1', distanceKm: '0.6' });

    expect(view.getByRole('header', { name: 'Close Pantry' })).toBeTruthy();
    expect(view.getByText('Food bank')).toBeTruthy();
    expect(view.getByText(' · closes 3 pm · 0.6 km away')).toBeTruthy();
  });

  it('says it is open now during its hours', async () => {
    const view = await renderPlace({ id: 'node-1' });

    expect(view.getByText('Open now')).toBeTruthy();
  });

  it('says when a closed place opens next', async () => {
    setNow(17);
    const view = await renderPlace({ id: 'node-1' });

    expect(view.getByText('Closed now')).toBeTruthy();
    expect(view.getByText(' · opens tomorrow 9 am')).toBeTruthy();
  });

  it('shows just the distance for a place without hours', async () => {
    const view = await renderPlace({ id: 'way-2', distanceKm: '1.4' });

    expect(view.queryByText('Open now')).toBeNull();
    expect(view.queryByText('Closed now')).toBeNull();
    expect(view.getByText('1.4 km away')).toBeTruthy();
  });

  it('goes back to the list', async () => {
    const view = await renderPlace({ id: 'node-1' });

    await fireEvent.press(view.getByLabelText('Back'));

    expect(router.back).toHaveBeenCalled();
  });

  it('shares the name, address and a maps link', async () => {
    const view = await renderPlace({ id: 'node-1' });

    await fireEvent.press(view.getByLabelText('Share Close Pantry'));

    expect(Share.share).toHaveBeenCalledWith({
      message: expect.stringMatching(
        /^Close Pantry\n1 George Street\nhttps:\/\/maps\.apple\.com\//,
      ),
    });
  });

  it('explains when the place is no longer in the list', async () => {
    const view = await renderPlace({ id: 'node-999' });

    expect(view.getByText("This place isn't in the list any more")).toBeTruthy();
  });
});

describe('directions and calling', () => {
  it('opens directions to the place in the maps app', async () => {
    const view = await renderPlace({ id: 'node-1' });

    await fireEvent.press(view.getByLabelText('Directions to Close Pantry'));

    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('daddr=-33.9,151.18'));
  });

  it('calls the first number listed, without spaces', async () => {
    const view = await renderPlace({ id: 'node-1' });

    await fireEvent.press(view.getByLabelText('Call Close Pantry'));

    expect(Linking.openURL).toHaveBeenCalledWith('tel:+61290000000');
  });

  it('offers no call button when there is no number', async () => {
    const view = await renderPlace({ id: 'way-2' });

    expect(view.queryByLabelText('Call Soup Hall')).toBeNull();
  });
});

describe('the address and hours card', () => {
  it('prefers the address the list looked up', async () => {
    const view = await renderPlace({ id: 'way-2', address: '5 Pitt Street, Sydney' });

    expect(view.getByText('5 Pitt Street, Sydney')).toBeTruthy();
  });

  it('ignores the list placeholders and falls back to OpenStreetMap', async () => {
    const view = await renderPlace({ id: 'node-1', address: 'Looking up address…' });

    expect(view.getByText('1 George Street')).toBeTruthy();
  });

  it('lays out the week with today marked', async () => {
    const view = await renderPlace({ id: 'node-1' });

    expect(view.getByText('Mon – Tue')).toBeTruthy();
    expect(view.getByText('Wed (today)')).toBeTruthy();
    expect(view.getByText('Sat – Sun')).toBeTruthy();
    expect(view.getByText('Closed')).toBeTruthy();
  });

  it('says when the hours are not listed', async () => {
    const view = await renderPlace({ id: 'way-2' });

    expect(view.getByText('Address not listed')).toBeTruthy();
    expect(view.getByText('Hours not listed')).toBeTruthy();
  });
});

describe('bringing food from the fridge', () => {
  beforeEach(() => {
    mockInventory.activeItems = [
      food('eggs', 'Eggs', '2026-11-05'),
      food('milk', 'Milk', '2026-10-21'),
      food('old', 'Old yoghurt', '2026-10-19'),
      food('spinach', 'Spinach', '2026-10-22'),
    ];
  });

  it('offers the food expiring soonest first, and leaves out expired food', async () => {
    const view = await renderPlace({ id: 'node-1' });

    expect(view.getAllByRole('checkbox').map((tile) => tile.props.accessibilityLabel)).toEqual([
      'Milk, expires today',
      'Spinach, 1 day left',
      'Eggs, 15 days left',
    ]);
    expect(view.queryByText('Old yoghurt')).toBeNull();
  });

  it('only lets the button be pressed once something is marked', async () => {
    const view = await renderPlace({ id: 'node-1' });

    await fireEvent.press(view.getByRole('button', { name: 'Mark food to bring' }));
    expect(mockInventory.resolveItem).not.toHaveBeenCalled();

    await fireEvent.press(view.getByLabelText('Spinach, 1 day left'));

    expect(
      view.getByRole('checkbox', { name: 'Spinach, 1 day left' }).props.accessibilityState,
    ).toMatchObject({ checked: true });
    expect(view.getByRole('button', { name: 'Mark 1 item as donated' })).toBeTruthy();
  });

  it('marks the chosen food as donated and thanks the student', async () => {
    const view = await renderPlace({ id: 'node-1' });

    await fireEvent.press(view.getByLabelText('Milk, expires today'));
    await fireEvent.press(view.getByLabelText('Spinach, 1 day left'));
    await fireEvent.press(view.getByRole('button', { name: 'Mark 2 items as donated' }));

    expect(mockInventory.resolveItem.mock.calls).toEqual([
      ['milk', 'donated'],
      ['spinach', 'donated'],
    ]);
    expect(await view.findByText(/Milk and Spinach are marked/)).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Done' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('keeps the choice and says so when saving fails', async () => {
    mockInventory.resolveItem.mockRejectedValue(new Error('Unable to save inventory.'));
    const view = await renderPlace({ id: 'node-1' });

    await fireEvent.press(view.getByLabelText('Milk, expires today'));
    await fireEvent.press(view.getByRole('button', { name: 'Mark 1 item as donated' }));

    expect(await view.findByText(/couldn't be marked as donated/)).toBeTruthy();
    expect(view.getByRole('button', { name: 'Mark 1 item as donated' })).toBeTruthy();
  });

  it('says so when there is nothing in date to bring', async () => {
    mockInventory.activeItems = [food('old', 'Old yoghurt', '2026-10-19')];
    const view = await renderPlace({ id: 'node-1' });

    expect(view.getByText(/Nothing in your fridge is still in date/)).toBeTruthy();
  });
});
