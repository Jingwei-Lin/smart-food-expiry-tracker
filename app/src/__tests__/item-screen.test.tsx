import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

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

const STORAGE_KEY = '@smart-food-expiry-tracker/inventory-v1';

function buildMilk(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'milk',
    name: 'Milk',
    quantity: '2 L',
    expiryDate: '2026-10-02',
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

  await view.findByText('Delete item');

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

    await fireEvent.press(view.getByText('Find donation point'));

    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/donation-points',
      params: { near: 'phone' },
    });
  });

  it.each([
    ['Mark as eaten', 'eaten'],
    ['Mark as thrown out', 'discarded'],
    ['Mark as donated', 'donated'],
  ])('records "%s" with the time, which the weekly summary counts by', async (label, status) => {
    const view = await renderScreen(buildMilk());
    const before = Date.now();

    await fireEvent.press(view.getByText(label));

    const [saved] = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as FoodItem[];

    expect(saved.status).toBe(status);
    expect(Date.parse(saved.statusUpdatedAt ?? '')).toBeGreaterThanOrEqual(before);
    expect(router.back).toHaveBeenCalledTimes(1);
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

  it('shows no reminders for food that has already been eaten', async () => {
    const view = await renderScreen(
      buildMilk({ status: 'eaten', statusUpdatedAt: '2026-09-28T00:00:00.000Z' }),
    );

    expect(view.queryByText('Reminders')).toBeNull();
  });

  it('does not offer recipes or a donation point for food that has already been eaten', async () => {
    const view = await renderScreen(
      buildMilk({ status: 'eaten', statusUpdatedAt: '2026-09-28T00:00:00.000Z' }),
    );

    expect(view.queryByText('Find recipes')).toBeNull();
    expect(view.queryByText('Find donation point')).toBeNull();
  });
});
