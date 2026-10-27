import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import ItemDetailScreen from '@/app/item/[id]';
import { InventoryProvider } from '@/context/inventory-context';
import { FoodItem } from '@/types/food-item';

jest.mock('@/services/expiry-notifications', () => ({
  cancelExpiryReminders: jest.fn().mockResolvedValue(true),
  scheduleExpiryReminders: jest.fn().mockResolvedValue({ status: 'not-needed' }),
}));

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    dismissTo: jest.fn(),
    push: jest.fn(),
  },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'milk' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const STORAGE_KEY = '@smart-food-expiry-tracker/inventory-v1';

function buildMilk(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'milk',
    name: 'Milk',
    quantity: '2 L',
    expiryDate: '2026-10-02',
    storageLocation: 'fridge',
    reminderDaysBefore: 1,
    reminderRuleVersion: 2,
    notes: '',
    createdAt: '2026-09-25T00:00:00.000Z',
    status: 'active',
    ...overrides,
  };
}

async function renderScreen(item: FoodItem) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([item]));

  const view = await render(
    <InventoryProvider>
      <ItemDetailScreen />
    </InventoryProvider>,
  );

  await view.findByText(item.name);

  return view;
}

beforeEach(async () => {
  jest.mocked(router.dismissTo).mockReset();
  jest.mocked(router.back).mockReset();
  await AsyncStorage.clear();
});

describe('ItemDetailScreen', () => {
  it('opens the Recipes tab with just this item ticked', async () => {
    const view = await renderScreen(buildMilk());

    await fireEvent.press(view.getByText('Find recipes'));

    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/recipes',
      params: { select: 'milk' },
    });
  });

  it('opens the Donation Points tab near the phone for food that cannot be finished', async () => {
    const view = await renderScreen(buildMilk());

    await fireEvent.press(view.getByText('Donate it'));

    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/donation-points',
      params: { near: 'phone' },
    });
  });

  it.each([
    ['Eaten', 'eaten'],
    ['Thrown out', 'discarded'],
  ])('records "%s" with the time, which the summary counts by', async (label, status) => {
    const view = await renderScreen(buildMilk());
    const before = Date.now();

    await fireEvent.press(view.getByText(label));

    const [saved] = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as FoodItem[];

    expect(saved.status).toBe(status);
    expect(Date.parse(saved.statusUpdatedAt ?? '')).toBeGreaterThanOrEqual(before);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Eaten', 'Thrown out'],
    ['Thrown out', 'Eaten'],
  ])('shows "Saving..." only on the "%s" button while it is pressed', async (pressed, other) => {
    const view = await renderScreen(buildMilk());
    jest.spyOn(AsyncStorage, 'setItem').mockReturnValueOnce(new Promise(() => undefined));

    await fireEvent.press(view.getByText(pressed));

    expect(view.getAllByText('Saving...')).toHaveLength(1);
    expect(view.queryByText(pressed)).toBeNull();
    expect(view.getByText(other)).toBeTruthy();
  });

  it.each([
    ['active', buildMilk({ createdAt: new Date(2026, 8, 25, 12).toISOString() })],
    [
      'eaten',
      buildMilk({
        createdAt: new Date(2026, 8, 25, 12).toISOString(),
        status: 'eaten',
        statusUpdatedAt: new Date(2026, 8, 28, 12).toISOString(),
      }),
    ],
  ])('shows the day an %s item was added', async (_label, item) => {
    const view = await renderScreen(item);

    expect(view.getByText(/^2 L · Added 25 Sept? 2026$/)).toBeTruthy();
  });

  it('shows no leading separator for an item with no quantity', async () => {
    const view = await renderScreen(
      buildMilk({ quantity: '', createdAt: new Date(2026, 8, 25, 12).toISOString() }),
    );

    expect(view.getByText(/^Added 25 Sept? 2026$/)).toBeTruthy();
  });

  it('leaves out an added day it cannot read', async () => {
    const view = await renderScreen(buildMilk({ createdAt: 'someday' }));

    expect(view.queryByText(/Added/)).toBeNull();
    expect(view.getByText('2 L')).toBeTruthy();
  });

  it('shows when an eaten item was updated', async () => {
    const view = await renderScreen(
      buildMilk({ status: 'eaten', statusUpdatedAt: new Date(2026, 8, 28, 12).toISOString() }),
    );

    expect(view.getByText(/^Updated 28 Sept? 2026$/)).toBeTruthy();
  });

  it('names the notice when both reminders are scheduled', async () => {
    const view = await renderScreen(
      buildMilk({ expiryDate: '2099-01-10', notificationIds: ['advance', 'expiry-day'] }),
    );

    expect(view.getByText('1 day before and on expiry day')).toBeTruthy();
  });

  it('says reminders are not set when none were scheduled', async () => {
    const view = await renderScreen(buildMilk({ expiryDate: '2099-01-10' }));

    expect(
      view.getByText('Not set. Turn on notifications, then save the item again from Edit'),
    ).toBeTruthy();
  });

  it('says reminders are not available on web, where none can be scheduled', async () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'web');

    try {
      const view = await renderScreen(buildMilk({ expiryDate: '2099-01-10' }));

      expect(view.getByText('Not available on web')).toBeTruthy();
      expect(view.queryByText(/^Not set/)).toBeNull();
    } finally {
      platform.restore();
    }
  });

  it('shows no reminders for food that has already been eaten', async () => {
    const view = await renderScreen(
      buildMilk({ status: 'eaten', statusUpdatedAt: '2026-09-28T00:00:00.000Z' }),
    );

    expect(view.queryByText('Remind me')).toBeNull();
    expect(view.queryByText(/before and on expiry day/)).toBeNull();
  });

  it('does not offer recipes or donating for food that has already been eaten', async () => {
    const view = await renderScreen(
      buildMilk({ status: 'eaten', statusUpdatedAt: '2026-09-28T00:00:00.000Z' }),
    );

    expect(view.queryByText('Find recipes')).toBeNull();
    expect(view.queryByText('Donate it')).toBeNull();
  });
});
