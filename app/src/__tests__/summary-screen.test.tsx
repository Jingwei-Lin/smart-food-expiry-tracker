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
    storageLocation: 'fridge',
    category: 'Others',
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

/** The big number under a legend label such as "Eaten", for the period on show. */
function totalFor(view: Awaited<ReturnType<typeof renderScreen>>, label: string): number {
  const column = view.getAllByText(label)[0].parent!.parent!;

  return Number(within(column).getByText(/^[0-9]+$/).props.children);
}

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

    /* Rice was eaten last Wednesday, so it is outside this week. */
    expect(totalFor(view, 'Eaten')).toBe(1);
    expect(totalFor(view, 'Donated')).toBe(1);
    expect(totalFor(view, 'Thrown out')).toBe(1);
    expect(view.getByText('of 3 items saved')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Show this month' }));

    /* ...but it is inside this month. */
    expect(totalFor(view, 'Eaten')).toBe(2);
    expect(view.getByText('of 4 items saved')).toBeTruthy();
  });

  it('shows the week by default and switches between the week and the month', async () => {
    const view = await renderScreen([
      buildItem('apple', { status: 'eaten', statusUpdatedAt: new Date(NOW).toISOString() }),
    ]);

    expect(view.getByRole('button', { name: 'Show this week', selected: true })).toBeTruthy();
    expect(view.getByText('This week · 12 Oct–18 Oct')).toBeTruthy();
    expect(view.getByText('DAY BY DAY')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Show this month' }));

    expect(view.getByRole('button', { name: 'Show this month', selected: true })).toBeTruthy();
    expect(view.queryByText('DAY BY DAY')).toBeNull();
    expect(view.getByText(/This month · October 2026/)).toBeTruthy();
  });

  it('describes each day of the chart for screen readers', async () => {
    const view = await renderScreen([
      buildItem('apple', {
        status: 'eaten',
        statusUpdatedAt: new Date(2026, 9, 12, 9).toISOString(),
      }),
      buildItem('pear', {
        status: 'eaten',
        statusUpdatedAt: new Date(2026, 9, 12, 18).toISOString(),
      }),
      buildItem('bread', {
        status: 'discarded',
        statusUpdatedAt: new Date(2026, 9, 12, 20).toISOString(),
      }),
      buildItem('pasta', { status: 'donated', statusUpdatedAt: new Date(NOW).toISOString() }),
    ]);

    expect(view.getByLabelText('Mon, 2 eaten, 1 thrown out')).toBeTruthy();
    expect(view.getByLabelText('Tue, nothing recorded')).toBeTruthy();
    expect(view.getByLabelText('Wed, 0 eaten, 1 donated, 0 thrown out')).toBeTruthy();
  });

  it('lists the food thrown out in the period and opens it', async () => {
    const view = await renderScreen([
      buildItem('bread', { status: 'discarded', statusUpdatedAt: new Date(NOW).toISOString() }),
    ]);

    expect(view.getByLabelText('View details for bread')).toBeTruthy();
    expect(view.queryByText('No food thrown out')).toBeNull();
  });

  it('lists the newest thrown-out food first', async () => {
    const view = await renderScreen([
      buildItem('older', {
        status: 'discarded',
        statusUpdatedAt: new Date(NOW.getTime() - DAY).toISOString(),
      }),
      buildItem('newer', { status: 'discarded', statusUpdatedAt: new Date(NOW).toISOString() }),
    ]);

    const names = view
      .getAllByLabelText(/^View details for /)
      .map((row) => row.props.accessibilityLabel);

    expect(names).toEqual(['View details for newer', 'View details for older']);
  });

  it('shows the 10 newest thrown-out items and counts the rest', async () => {
    const view = await renderScreen(
      Array.from({ length: 12 }, (_, index) =>
        buildItem(`food-${index}`, {
          status: 'discarded',
          statusUpdatedAt: new Date(NOW.getTime() - index * 60 * 1000).toISOString(),
        }),
      ),
    );

    expect(view.getAllByLabelText(/^View details for /)).toHaveLength(10);
    expect(view.getByLabelText('View details for food-9')).toBeTruthy();
    expect(view.queryByLabelText('View details for food-10')).toBeNull();
    expect(view.getByLabelText('2 more thrown out, not shown')).toBeTruthy();
    expect(view.getByText('+2 more')).toBeTruthy();
  });

  it('shows no count of more items when all of them fit', async () => {
    const view = await renderScreen(
      Array.from({ length: 10 }, (_, index) =>
        buildItem(`food-${index}`, {
          status: 'discarded',
          statusUpdatedAt: new Date(NOW.getTime() - index * 60 * 1000).toISOString(),
        }),
      ),
    );

    expect(view.getAllByLabelText(/^View details for /)).toHaveLength(10);
    expect(view.queryByText(/more$/)).toBeNull();
  });

  it('scrolls, with room under the tab bar, so small screens can reach the last section', async () => {
    const view = await renderScreen([]);
    let scroll = view.getByText('Waste summary');

    while (scroll.type !== 'RCTScrollView') {
      scroll = scroll.parent!;
    }

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

    expect(view.getByText('This week · 12 Oct–18 Oct')).toBeTruthy();
    expect(totalFor(view, 'Eaten')).toBe(1);

    jest.setSystemTime(new Date(2026, 9, 19, 0, 30));
    await act(async () => {
      mockFocus.effect?.();
    });

    expect(view.getByText('This week · 19 Oct–25 Oct')).toBeTruthy();
    expect(totalFor(view, 'Eaten')).toBe(0);
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
    expect(view.queryByText('Eaten')).toBeNull();
  });
});
