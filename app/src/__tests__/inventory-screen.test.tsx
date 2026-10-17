import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, AlertButton } from 'react-native';

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

/*
 * Reanimated has no native side under Jest, so each row is drawn as if
 * already swiped open: the row, then its Edit and Delete actions.
 */
const mockClose = jest.fn();

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { createElement, Fragment } = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: ({
      children,
      renderRightActions,
    }: {
      children: import('react').ReactNode;
      renderRightActions?: (
        progress: unknown,
        translation: unknown,
        swipeable: { close: () => void },
      ) => import('react').ReactNode;
    }) =>
      createElement(
        Fragment,
        null,
        children,
        renderRightActions?.(undefined, undefined, { close: mockClose }),
      ),
  };
});

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
  jest.restoreAllMocks();
});

async function storedNames(): Promise<string[]> {
  const items = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as FoodItem[];

  return items.map((item) => item.name);
}

describe('deleting from the list', () => {
  /* The buttons of the confirm dialog the swipe's Delete opened. */
  async function swipeDelete(view: Awaited<ReturnType<typeof renderScreen>>, name: string) {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await fireEvent.press(view.getByLabelText(`Delete ${name}`));

    const [title, message, buttons] = alert.mock.calls[0];

    return { title, message, buttons: buttons as AlertButton[] };
  }

  it('asks first, and "Keep item" keeps it', async () => {
    const view = await renderScreen([buildItem('Milk', '2026-10-19')]);
    const { title, message, buttons } = await swipeDelete(view, 'Milk');

    expect(title).toBe('Delete Milk?');
    expect(message).toMatch(/cannot be undone/);
    expect(buttons.map((button) => button.text)).toEqual(['Keep item', 'Delete']);
    expect(buttons[0].style).toBe('cancel');
    expect(mockClose).toHaveBeenCalled();

    expect(view.getByText('Milk')).toBeTruthy();
    expect(await storedNames()).toEqual(['Milk']);
  });

  it('removes the item from the list and from storage once confirmed', async () => {
    const view = await renderScreen([
      buildItem('Milk', '2026-10-19'),
      buildItem('Rice', '2026-12-01'),
    ]);
    const { buttons } = await swipeDelete(view, 'Milk');

    await act(async () => {
      buttons[1].onPress?.();
    });

    await waitFor(() => expect(view.queryByText('Milk')).toBeNull());
    expect(view.getByText('Rice')).toBeTruthy();
    expect(await storedNames()).toEqual(['Rice']);
  });
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
