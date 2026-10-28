import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, AlertButton, Platform } from 'react-native';

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
    replace: jest.fn(),
  },
  Stack: { Screen: () => null },
  useFocusEffect: jest.fn(),
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
    category: 'Others',
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
  jest.mocked(router.replace).mockReset();
  jest
    .spyOn(Alert, 'alert')
    .mockReset()
    .mockImplementation(() => undefined);
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
    const view = await renderScreen(buildMilk({ expiryDate: '2099-12-31' }));

    await fireEvent.press(view.getByText('Donate it'));

    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/donation-points',
      params: { near: 'phone' },
    });
  });

  it('does not offer donating expired food, which a donation point cannot take', async () => {
    const view = await renderScreen(buildMilk({ expiryDate: '2000-01-01' }));

    expect(view.getByText('Find recipes')).toBeTruthy();
    expect(view.queryByText('Donate it')).toBeNull();
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

  it('names the item on the buttons that resolve it, for screen readers', async () => {
    const view = await renderScreen(buildMilk());

    expect(view.getByRole('button', { name: 'Eaten' }).props.accessibilityHint).toBe(
      'Marks Milk as eaten',
    );
    expect(view.getByRole('button', { name: 'Thrown out' }).props.accessibilityHint).toBe(
      'Marks Milk as thrown out',
    );
  });

  it('marks only the pressed button as busy while it saves', async () => {
    const view = await renderScreen(buildMilk());
    jest.spyOn(AsyncStorage, 'setItem').mockReturnValueOnce(new Promise(() => undefined));

    await fireEvent.press(view.getByText('Thrown out'));

    expect(view.getByHintText('Marks Milk as thrown out').props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true,
    });
    expect(view.getByHintText('Marks Milk as eaten').props.accessibilityState).toMatchObject({
      busy: false,
      disabled: true,
    });
  });

  it('goes back one screen, which is not always the inventory', async () => {
    const view = await renderScreen(buildMilk());

    await fireEvent.press(view.getByLabelText('Go back'));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('falls back to the inventory when the screen was opened with nothing to go back to', async () => {
    const view = await renderScreen(buildMilk());
    jest.mocked(router.canGoBack).mockReturnValueOnce(false);

    await fireEvent.press(view.getByLabelText('Go back'));

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('offers a way back while the inventory is still loading', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(new Promise(() => undefined));

    const view = await render(
      <InventoryProvider>
        <ItemDetailScreen />
      </InventoryProvider>,
    );

    expect(view.getByText('Loading item...')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('Go back'));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('offers a way back for an item that no longer exists', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));

    const view = await render(
      <InventoryProvider>
        <ItemDetailScreen />
      </InventoryProvider>,
    );

    await fireEvent.press(await view.findByText('Back to inventory'));

    expect(router.back).toHaveBeenCalledTimes(1);
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

  it('says reminders are not set when none were scheduled, and claims no notice', async () => {
    const view = await renderScreen(buildMilk({ expiryDate: '2099-01-10', reminderDaysBefore: 3 }));

    expect(
      view.getByText('Not set. Turn on notifications, then save the item again from Edit'),
    ).toBeTruthy();
    expect(view.queryByText(/3 days before/)).toBeNull();
  });

  it('names the item on the buttons that change it, for screen readers', async () => {
    const view = await renderScreen(buildMilk({ expiryDate: '2099-01-10' }));

    expect(view.getByRole('header', { name: 'Milk' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Edit Milk' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Change date' }).props.accessibilityHint).toBe(
      'Edits the expiry date of Milk',
    );
    expect(
      view.getByRole('button', { name: 'Edit reminder settings' }).props.accessibilityHint,
    ).toBe('Edits the reminders for Milk');
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

  it('asks in a dialog, and deletes an active item only once it is confirmed', async () => {
    const view = await renderScreen(buildMilk());

    await fireEvent.press(view.getByRole('button', { name: 'Delete item' }));
    const dialog = lastDialog();

    expect(dialog.title).toBe('Delete Milk?');
    expect(dialog.message).toBe('This removes the item from your inventory. It cannot be undone.');
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]')).toHaveLength(1);

    await act(async () => dialog.press('Delete'));

    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('[]');
    expect(router.back).toHaveBeenCalled();
  });

  it.each(['eaten', 'discarded', 'donated'] as const)(
    'lets a %s item be deleted, so a mistaken resolve can be undone',
    async (status) => {
      const view = await renderScreen(
        buildMilk({ status, statusUpdatedAt: '2026-09-28T00:00:00.000Z' }),
      );

      await fireEvent.press(view.getByRole('button', { name: 'Delete item' }));
      const dialog = lastDialog();

      expect(dialog.message).toMatch(/and from the waste summary/);

      await act(async () => dialog.press('Delete'));

      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('[]');
    },
  );

  it('keeps the item when the dialog is answered "Keep item"', async () => {
    const view = await renderScreen(buildMilk());

    await fireEvent.press(view.getByRole('button', { name: 'Delete item' }));
    await act(async () => lastDialog().press('Keep item'));

    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]')).toHaveLength(1);
    expect(router.back).not.toHaveBeenCalled();
  });
});

/** The last dialog shown, with a way to press one of its buttons by its words. */
function lastDialog() {
  const calls = jest.mocked(Alert.alert).mock.calls;
  const [title, message, buttons = []] = calls[calls.length - 1];

  return {
    title,
    message,
    press: (text: string) => (buttons as AlertButton[]).find((b) => b.text === text)?.onPress?.(),
  };
}
