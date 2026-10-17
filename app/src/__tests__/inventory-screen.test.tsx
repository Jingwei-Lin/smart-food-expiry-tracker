import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';

import InventoryScreen from '@/app/(tabs)/index';
import { InventoryProvider } from '@/context/inventory-context';
import { FoodItem } from '@/types/food-item';

jest.mock('@/services/expiry-notifications', () => ({
  cancelExpiryReminders: jest.fn().mockResolvedValue(true),
  scheduleExpiryReminders: jest.fn().mockResolvedValue({ status: 'not-needed' }),
}));

/* The latest focus effect, so a test can bring the tab back into view. */
const mockFocus: { effect: (() => void) | null } = { effect: null };

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');

  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => void) =>
      useEffect(() => {
        mockFocus.effect = effect;
        effect();
      }, [effect]),
  };
});

/* Reanimated has no native side under Jest, and these tests don't swipe. */
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({ children }: { children: import('react').ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const STORAGE_KEY = '@smart-food-expiry-tracker/inventory-v1';

function buildItem(id: string, expiryDate: string): FoodItem {
  return {
    id,
    name: id,
    quantity: '1 item',
    expiryDate,
    reminderDaysBefore: 1,
    reminderRuleVersion: 2,
    notes: '',
    createdAt: '2026-10-01T00:00:00.000Z',
    status: 'active',
  };
}

async function renderScreen(items: FoodItem[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));

  const view = await render(
    <InventoryProvider>
      <InventoryScreen />
    </InventoryProvider>,
  );

  await view.findByText('My Food Inventory');

  return view;
}

beforeEach(async () => {
  /* Sunday night, the evening before the milk's expiry day. */
  jest.useFakeTimers({ now: new Date(2026, 9, 18, 23, 0), advanceTimers: true });
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('InventoryScreen', () => {
  it('groups food by the days it has left', async () => {
    const view = await renderScreen([
      buildItem('Yoghurt', '2026-10-15'),
      buildItem('Milk', '2026-10-19'),
      buildItem('Rice', '2026-12-01'),
    ]);

    expect(view.getByText('EXPIRED')).toBeTruthy();
    expect(view.getByText('EAT SOON')).toBeTruthy();
    expect(view.getByText('LATER')).toBeTruthy();
    expect(view.getByText('Tomorrow')).toBeTruthy();
  });

  it('counts only the Eat soon section as "to eat soon", not expired food', async () => {
    const view = await renderScreen([
      buildItem('Yoghurt', '2026-10-15'),
      buildItem('Milk', '2026-10-19'),
      buildItem('Rice', '2026-12-01'),
    ]);

    expect(view.getByText('3 items · 1 to eat soon')).toBeTruthy();
  });

  it('moves on a day when the tab is opened again the next morning', async () => {
    const view = await renderScreen([buildItem('Milk', '2026-10-19')]);

    expect(view.getByText('Tomorrow')).toBeTruthy();

    jest.setSystemTime(new Date(2026, 9, 19, 8, 0));
    await act(async () => {
      mockFocus.effect?.();
    });

    expect(view.getByText('Today')).toBeTruthy();
    expect(view.queryByText('Tomorrow')).toBeNull();
  });
});
