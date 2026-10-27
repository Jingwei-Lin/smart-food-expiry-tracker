import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, AlertButton, Platform, StyleSheet } from 'react-native';

import InventoryScreen from '@/app/(tabs)/index';
import { InventoryProvider } from '@/context/inventory-context';
import { FoodItem } from '@/types/food-item';

jest.mock('@/services/expiry-notifications', () => ({
  cancelExpiryReminders: jest.fn().mockResolvedValue(true),
  scheduleExpiryReminders: jest.fn().mockResolvedValue({ status: 'not-needed' }),
}));

jest.mock('@/components/food-category-icon', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    FoodCategoryIcon: ({ category }: { category?: string }) =>
      createElement(Text, {
        accessibilityLabel: `Food category icon: ${category ?? 'Others'}`,
      }),
  };
});

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

function buildItem(
  id: string,
  expiryDate: string,
  category: FoodItem['category'] = 'Others',
): FoodItem {
  return {
    id,
    name: id,
    quantity: '1 item',
    expiryDate,
    storageLocation: 'fridge',
    reminderDaysBefore: 1,
    reminderRuleVersion: 2,
    notes: '',
    createdAt: '2026-10-01T00:00:00.000Z',
    status: 'active',
    category,
  };
}

async function renderScreen(items: FoodItem[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));

  const view = await render(
    <InventoryProvider>
      <InventoryScreen />
    </InventoryProvider>,
  );

  await view.findByText("What's in my fridge?");

  return view;
}

beforeEach(async () => {
  /* Sunday night, the evening before the milk's expiry day. */
  jest.useFakeTimers({ now: new Date(2026, 9, 18, 23, 0), advanceTimers: true });
  mockClose.mockClear();
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
    // Food still in the list isn't in the waste summary yet.
    expect(message).toBe('This removes the item from your inventory. It cannot be undone.');
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

  /* react-native-web's Alert does nothing, so web asks with the browser's dialog. */
  describe('on web', () => {
    const confirm = jest.fn<boolean, [string?]>();

    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'web');
      confirm.mockReset();
      window.confirm = confirm;
    });

    it('removes the item once the browser dialog is confirmed', async () => {
      confirm.mockReturnValue(true);
      const view = await renderScreen([
        buildItem('Milk', '2026-10-19'),
        buildItem('Rice', '2026-12-01'),
      ]);

      await fireEvent.press(view.getByLabelText('Delete Milk'));

      expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/^Delete Milk\?\n\n/));
      await waitFor(() => expect(view.queryByText('Milk')).toBeNull());
      expect(await storedNames()).toEqual(['Rice']);
    });

    it('keeps the item when the browser dialog is cancelled', async () => {
      confirm.mockReturnValue(false);
      const view = await renderScreen([buildItem('Milk', '2026-10-19')]);

      await fireEvent.press(view.getByLabelText('Delete Milk'));

      expect(confirm).toHaveBeenCalled();
      expect(view.getByText('Milk')).toBeTruthy();
      expect(await storedNames()).toEqual(['Milk']);
    });
  });
});

describe('InventoryScreen', () => {
  it('shows the saved food category icon in the inventory list', async () => {
    const view = await renderScreen([buildItem('Fish', '2026-10-19', 'Seafood')]);

    expect(view.getByLabelText('Food category icon: Seafood')).toBeTruthy();
  });

  it('has a Fridge, Freezer and Pantry tab, each with how much is in it', async () => {
    const view = await renderScreen([
      buildItem('Milk', '2026-10-19'),
      buildItem('Rice', '2026-12-01'),
      { ...buildItem('Peas', '2026-12-01'), storageLocation: 'freezer' },
    ]);

    expect(view.getByRole('button', { name: 'Fridge, 2 items', selected: true })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Freezer, 1 item', selected: false })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Pantry, 0 items', selected: false })).toBeTruthy();
  });

  it('lists the selected location by soonest expiry, with an expired item first and badged', async () => {
    const view = await renderScreen([
      buildItem('Rice', '2026-12-01'),
      buildItem('Milk', '2026-10-19'),
      buildItem('Yoghurt', '2026-10-15'),
      { ...buildItem('Peas', '2026-11-01'), storageLocation: 'freezer' },
    ]);
    const listed = () =>
      view.getAllByText(/^(Yoghurt|Milk|Rice|Peas)$/).map((name) => name.props.children);

    expect(listed()).toEqual(['Yoghurt', 'Milk', 'Rice']);
    expect(view.getByText('3 days over')).toBeTruthy();
    expect(view.getByText('Tomorrow')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Freezer, 1 item' }));

    expect(listed()).toEqual(['Peas']);
    expect(view.queryByText('3 days over')).toBeNull();
  });

  it('colours food expiring today at least as urgently as food expiring tomorrow', async () => {
    const view = await renderScreen([
      buildItem('Yoghurt', '2026-10-18'),
      buildItem('Milk', '2026-10-19'),
    ]);
    const colourOf = (text: string) => StyleSheet.flatten(view.getByText(text).props.style).color;

    expect(colourOf('Today')).toBe(colourOf('Tomorrow'));
  });

  it('says a location is empty, and still offers to scan', async () => {
    const view = await renderScreen([buildItem('Milk', '2026-10-19')]);

    await fireEvent.press(view.getByRole('button', { name: 'Pantry, 0 items' }));

    expect(view.getByText('Nothing in your pantry')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Scan a food item' })).toBeTruthy();
  });

  it('shows only the error, not an empty fridge, when the saved inventory could not be read', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('unreadable'));

    const view = await renderScreen([buildItem('Milk', '2026-10-19')]);

    expect(view.getByText(/saved inventory could not be loaded/)).toBeTruthy();
    expect(view.queryByText('Nothing in your fridge')).toBeNull();
    expect(view.queryByRole('button', { name: 'Scan a food item' })).toBeNull();
    expect(view.queryByRole('button', { name: /^Fridge/ })).toBeNull();
  });

  it('hides the decorative week strip from screen readers', async () => {
    const view = await renderScreen([]);

    expect(view.queryByText('Mon')).toBeNull();
    expect(view.getByText('Mon', { includeHiddenElements: true })).toBeTruthy();
  });

  it('counts only food that has not expired as "to eat soon"', async () => {
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
