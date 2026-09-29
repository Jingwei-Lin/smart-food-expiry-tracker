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

  it('does not offer recipes for food that has already been eaten', async () => {
    const view = await renderScreen(
      buildMilk({ status: 'eaten', statusUpdatedAt: '2026-09-28T00:00:00.000Z' }),
    );

    expect(view.queryByText('Find recipes')).toBeNull();
  });
});
