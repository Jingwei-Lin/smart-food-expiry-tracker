import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import WeeklySummaryScreen from '@/app/(tabs)/summary';
import { InventoryProvider, useInventory } from '@/context/inventory-context';
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
    useFocusEffect: (effect: () => void) =>
      useEffect(() => {
        mockFocus.effect = effect;
        effect();
      }, [effect]),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const STORAGE_KEY = '@smart-food-expiry-tracker/inventory-v1';
const DAY = 24 * 60 * 60 * 1000;

function buildItem(id: string, overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id,
    name: id,
    quantity: '1 item',
    expiryDate: '2026-12-31',
    reminderDaysBefore: 1,
    reminderRuleVersion: 2,
    notes: '',
    createdAt: '2026-09-01T00:00:00.000Z',
    status: 'active',
    ...overrides,
  };
}

/* Stands in for the item screen, which is where a student resolves an item. */
function ResolveMilkButton() {
  const { resolveItem } = useInventory();

  return (
    <Pressable onPress={() => void resolveItem('milk', 'eaten').catch(() => undefined)}>
      <Text>Eat milk</Text>
    </Pressable>
  );
}

async function renderScreen(items: FoodItem[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));

  const view = await render(
    <InventoryProvider>
      <ResolveMilkButton />
      <WeeklySummaryScreen />
    </InventoryProvider>,
  );

  await view.findByText(/This week/);

  return view;
}

/*
 * A Wednesday at noon, so "now" and "a week ago" are nowhere near a Monday
 * midnight or a clock change. The clocks still run, so the screen can load.
 */
const NOW = new Date(2026, 9, 14, 12, 0);

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('WeeklySummaryScreen', () => {
  it('counts eaten, donated and thrown-out food from the inventory', async () => {
    const now = Date.now();
    const view = await renderScreen([
      buildItem('apple', { status: 'eaten', statusUpdatedAt: new Date(now).toISOString() }),
      buildItem('bread', { status: 'discarded', statusUpdatedAt: new Date(now).toISOString() }),
      buildItem('pasta', { status: 'donated', statusUpdatedAt: new Date(now).toISOString() }),
      buildItem('rice', {
        status: 'eaten',
        statusUpdatedAt: new Date(now - 7 * DAY).toISOString(),
      }),
      buildItem('milk'),
    ]);

    /* Eaten, thrown out and donated this week, and eaten last week. */
    expect(view.getByText('Last week')).toBeTruthy();
    expect(view.getAllByText('1')).toHaveLength(4);
    expect(view.getByText(/marked as eaten, donated or thrown out/)).toBeTruthy();
    expect(view.queryByText(/not available yet/)).toBeNull();
  });

  it('hides the day-by-day chart in monthly view', async () => {
    const view = await renderScreen([
      buildItem('apple', { status: 'eaten', statusUpdatedAt: new Date(NOW).toISOString() }),
    ]);

    fireEvent.press(view.UNSAFE_getAllByType(Pressable)[1]);

    expect(view.queryByText('DAY BY DAY')).toBeNull();
    expect(view.getByText(/This month/)).toBeTruthy();
  });

  it('scrolls, with room under the tab bar, so small screens can reach the last week', async () => {
    const view = await renderScreen([]);
    const scroll = view.getByTestId('summary-scroll');

    expect(scroll.type).toBe('RCTScrollView');

    expect(scroll.props.contentContainerStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: 124 })]),
    );
  });

  it('moves on to the new week when the tab is opened again after Monday midnight', async () => {
    jest.setSystemTime(new Date(2026, 9, 18, 23, 0));
    const view = await renderScreen([
      buildItem('apple', {
        status: 'eaten',
        statusUpdatedAt: new Date(2026, 9, 18, 22, 0).toISOString(),
      }),
    ]);
    const eatenIn = (week: string) =>
      within(view.getByText(week).parent!).getAllByText(/^[0-9]+$/)[0].props.children;

    expect(eatenIn(/This week/)).toBe(1);

    jest.setSystemTime(new Date(2026, 9, 19, 0, 30));
    await act(async () => {
      mockFocus.effect?.();
    });

    expect(eatenIn(/This week/)).toBe(0);
    expect(eatenIn('Last week')).toBe(1);
  });

  it('keeps showing the counts after a save fails', async () => {
    const view = await renderScreen([buildItem('milk')]);
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));

    await fireEvent.press(view.getByText('Eat milk'));

    expect(view.getByText(/This week/)).toBeTruthy();
    expect(view.queryByText(/could not be loaded/)).toBeNull();
  });

  it('says so when the saved inventory could not be loaded', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('unreadable'));

    const view = await render(
      <InventoryProvider>
        <WeeklySummaryScreen />
      </InventoryProvider>,
    );

    expect(
      await view.findByText('Your saved inventory could not be loaded. Please try again later.'),
    ).toBeTruthy();
    expect(view.queryByText('This week')).toBeNull();
  });
});
