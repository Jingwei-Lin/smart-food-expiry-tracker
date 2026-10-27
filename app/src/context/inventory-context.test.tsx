import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { InventoryProvider, useInventory } from '@/context/inventory-context';
import {
  cancelExpiryReminders,
  ReminderScheduleResult,
  scheduleExpiryReminders,
} from '@/services/expiry-notifications';
import { FoodItem, NewFoodItem } from '@/types/food-item';

jest.mock('@/services/expiry-notifications', () => ({
  cancelExpiryReminders: jest.fn(),
  scheduleExpiryReminders: jest.fn(),
}));

const STORAGE_KEY = '@smart-food-expiry-tracker/inventory-v1';

const milk: NewFoodItem = {
  name: 'Milk',
  quantity: '2 L',
  expiryDate: '2026-09-20',
  reminderDaysBefore: 1,
  notes: 'Opened on Monday',
};

const spinach: NewFoodItem = {
  name: 'Baby spinach',
  quantity: '1 bag',
  expiryDate: '2026-09-17',
  reminderDaysBefore: 1,
  notes: '',
};

const scheduleReminderMock = jest.mocked(scheduleExpiryReminders);
const cancelReminderMock = jest.mocked(cancelExpiryReminders);

/**
 * Mounts the inventory and waits for the stored list to be read, which is what
 * every screen does before it shows anything.
 */
async function renderInventory() {
  const view = await renderHook(() => useInventory(), { wrapper: InventoryProvider });

  await waitFor(() => expect(view.result.current.isLoading).toBe(false));

  return view;
}

async function readStoredItems(): Promise<FoodItem[]> {
  const storedValue = await AsyncStorage.getItem(STORAGE_KEY);

  return storedValue ? JSON.parse(storedValue) : [];
}

function storeItems(items: FoodItem[]): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function buildStoredItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'stored-1',
    name: 'Cheddar',
    quantity: '250 g',
    expiryDate: '2026-09-29',
    storageLocation: 'fridge',
    category: 'Others',
    reminderDaysBefore: 1,
    reminderRuleVersion: 2,
    notes: '',
    createdAt: '2026-09-10T00:00:00.000Z',
    status: 'active',
    ...overrides,
  };
}

/**
 * Stores an item the way v1.0 saved it, with no reminder fields, so it loads
 * on rule version 1 and has its reminders scheduled at launch.
 */
function storeLegacyItem(): Promise<void> {
  const legacyItem: Record<string, unknown> = { ...buildStoredItem() };

  delete legacyItem.reminderDaysBefore;
  delete legacyItem.reminderRuleVersion;

  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([legacyItem]));
}

/**
 * Holds the next reminder schedule open, the way a permission prompt does,
 * until the test finishes it.
 */
function holdNextSchedule(): (result: ReminderScheduleResult) => void {
  let finish: (result: ReminderScheduleResult) => void = () => undefined;

  scheduleReminderMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );

  return (result) => finish(result);
}

beforeEach(async () => {
  jest.clearAllMocks();
  scheduleReminderMock.mockResolvedValue({ status: 'not-needed' });
  cancelReminderMock.mockResolvedValue(true);
  await AsyncStorage.clear();
});

describe('reading the stored inventory', () => {
  it('starts empty when nothing has been saved', async () => {
    const { result } = await renderInventory();

    expect(result.current.items).toEqual([]);
    expect(result.current.storageError).toBeNull();
    expect(result.current.isStorageReady).toBe(true);
  });

  it('loads what a previous session saved', async () => {
    await storeItems([buildStoredItem()]);

    const { result } = await renderInventory();

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].name).toBe('Cheddar');
  });

  it('puts an item saved before locations and categories existed in the fridge, as Others', async () => {
    const oldRecord: Record<string, unknown> = { ...buildStoredItem() };
    delete oldRecord.storageLocation;
    delete oldRecord.category;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([oldRecord]));

    const { result } = await renderInventory();

    expect(result.current.items[0].storageLocation).toBe('fridge');
    expect(result.current.items[0].category).toBe('Others');
  });

  it('files an item under Others when its stored category is not one the app offers', async () => {
    await storeItems([
      buildStoredItem({ id: 'valid', category: 'Seafood' }),
      buildStoredItem({ id: 'unknown', category: 'pantry' as FoodItem['category'] }),
      buildStoredItem({ id: 'wrong-type', category: 7 as unknown as FoodItem['category'] }),
    ]);

    const { result } = await renderInventory();

    expect(result.current.items.map((item) => item.category)).toEqual([
      'Seafood',
      'Others',
      'Others',
    ]);
  });

  it('loads an item that was donated', async () => {
    await storeItems([
      buildStoredItem({ status: 'donated', statusUpdatedAt: '2026-10-16T09:00:00.000Z' }),
    ]);

    const { result } = await renderInventory();

    expect(result.current.items[0].status).toBe('donated');
    expect(result.current.activeItems).toEqual([]);
  });

  it('drops records that are missing fields rather than failing the whole load', async () => {
    await storeItems([buildStoredItem(), { id: 'broken' } as FoodItem]);

    const { result } = await renderInventory();

    expect(result.current.items.map((item) => item.id)).toEqual(['stored-1']);
  });

  it('reports an error and refuses to save when the stored data cannot be read', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{ not valid json');

    const { result } = await renderInventory();

    expect(result.current.storageError).not.toBeNull();
    expect(result.current.isStorageReady).toBe(false);

    await expect(result.current.addItem(milk)).rejects.toThrow();

    /* The unreadable value must survive, rather than being replaced by one item. */
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('{ not valid json');
  });
});

describe('upgrading older reminders at launch', () => {
  it('gives an item saved by v1.0 the one-day default and schedules its reminders', async () => {
    scheduleReminderMock.mockResolvedValueOnce({
      status: 'scheduled',
      notificationIds: ['new-advance', 'new-expiry'],
    });
    await storeLegacyItem();

    const { result } = await renderInventory();

    await waitFor(() => expect(result.current.items[0].reminderRuleVersion).toBe(2));
    expect(result.current.items[0].reminderDaysBefore).toBe(1);
    expect(result.current.items[0].notificationIds).toEqual(['new-advance', 'new-expiry']);
    expect(cancelReminderMock).not.toHaveBeenCalled();
  });

  it('explains that reminders are off without claiming an item was just saved', async () => {
    scheduleReminderMock.mockResolvedValueOnce({ status: 'permission-denied' });
    await storeLegacyItem();

    const { result } = await renderInventory();

    await waitFor(() => expect(result.current.reminderNotice).toContain('reminders are off'));
    expect(result.current.reminderNotice).not.toContain('was saved');
    expect(result.current.reminderNotice).toContain('next time you open the app');

    /* It stays on the old rule so the upgrade is tried again on the next launch. */
    expect(result.current.items[0].reminderRuleVersion).toBe(1);
  });

  it('keeps an item added while the upgrade was waiting', async () => {
    const finishScheduling = holdNextSchedule();
    await storeLegacyItem();

    const { result } = await renderInventory();

    await waitFor(() => expect(scheduleReminderMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.addItem(milk);
    });

    await act(async () => {
      finishScheduling({ status: 'scheduled', notificationIds: ['new-advance', 'new-expiry'] });
    });

    await waitFor(() => expect(result.current.items[0].reminderRuleVersion).toBe(2));
    expect(result.current.items.map((item) => item.name)).toEqual(['Cheddar', 'Milk']);
    expect((await readStoredItems()).map((item) => item.name)).toEqual(['Cheddar', 'Milk']);
  });

  it('withdraws the new reminders for an item deleted while the upgrade was waiting', async () => {
    const finishScheduling = holdNextSchedule();
    await storeLegacyItem();

    const { result } = await renderInventory();

    await waitFor(() => expect(scheduleReminderMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.deleteItem('stored-1');
    });

    await act(async () => {
      finishScheduling({ status: 'scheduled', notificationIds: ['new-advance', 'new-expiry'] });
    });

    await waitFor(() =>
      expect(cancelReminderMock).toHaveBeenCalledWith(['new-advance', 'new-expiry']),
    );
    expect(result.current.items).toEqual([]);
    expect(await readStoredItems()).toEqual([]);
  });
});

describe('adding an item', () => {
  it('saves the food category so it is available after reloading inventory', async () => {
    const first = await renderInventory();

    await act(async () => {
      await first.result.current.addItem({
        ...milk,
        category: 'Dairy',
      });
    });

    expect(first.result.current.items[0].category).toBe('Dairy');
    expect((await readStoredItems())[0].category).toBe('Dairy');

    await first.unmount();

    const second = await renderInventory();

    expect(second.result.current.items[0].category).toBe('Dairy');
  });

  it('files an item under Others when no category is given', async () => {
    const { result } = await renderInventory();

    await act(async () => {
      await result.current.addItem(milk);
    });

    expect(result.current.items[0].category).toBe('Others');
    expect((await readStoredItems())[0].category).toBe('Others');
  });

  it('saves it and returns it with an id, a created date and an active status', async () => {
    const { result } = await renderInventory();

    let added: FoodItem | undefined;

    await act(async () => {
      added = await result.current.addItem(milk);
    });

    expect(added?.id).toEqual(expect.any(String));
    expect(added?.createdAt).toEqual(expect.any(String));
    expect(added?.status).toBe('active');
    expect(added?.reminderDaysBefore).toBe(1);

    expect(result.current.items).toHaveLength(1);
    expect(await readStoredItems()).toHaveLength(1);
  });

  it('keeps items from a previous session', async () => {
    await storeItems([buildStoredItem()]);

    const { result } = await renderInventory();

    await act(async () => {
      await result.current.addItem(milk);
    });

    expect(result.current.items.map((item) => item.name)).toEqual(['Cheddar', 'Milk']);
  });

  it('survives a restart of the app', async () => {
    const first = await renderInventory();

    await act(async () => {
      await first.result.current.addItem(milk);
    });

    await first.unmount();

    const second = await renderInventory();

    expect(second.result.current.items).toHaveLength(1);
    expect(second.result.current.items[0].name).toBe('Milk');
  });

  it('stores the scheduled notification identifier with the item', async () => {
    scheduleReminderMock.mockResolvedValueOnce({
      status: 'scheduled',
      notificationIds: ['advance-notification', 'expiry-notification'],
    });
    const { result } = await renderInventory();

    await act(async () => {
      await result.current.addItem(milk);
    });

    expect(result.current.items[0].notificationIds).toEqual([
      'advance-notification',
      'expiry-notification',
    ]);
    expect((await readStoredItems())[0].notificationIds).toEqual([
      'advance-notification',
      'expiry-notification',
    ]);
  });

  it('still saves when notification permission is denied', async () => {
    scheduleReminderMock.mockResolvedValueOnce({ status: 'permission-denied' });
    const { result } = await renderInventory();

    await act(async () => {
      await result.current.addItem(milk);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.reminderNotice).toContain('reminders are off');
  });
});

describe('editing an item', () => {
  it('replaces the edited fields and leaves the rest of the record alone', async () => {
    const { result } = await renderInventory();

    let added: FoodItem | undefined;

    await act(async () => {
      added = await result.current.addItem(milk);
    });

    await act(async () => {
      await result.current.updateItem(added!.id, {
        ...milk,
        name: 'Full cream milk',
        expiryDate: '2026-09-25',
      });
    });

    const [edited] = result.current.items;

    expect(edited.name).toBe('Full cream milk');
    expect(edited.expiryDate).toBe('2026-09-25');
    expect(edited.id).toBe(added!.id);
    expect(edited.createdAt).toBe(added!.createdAt);
    expect(edited.status).toBe('active');

    expect((await readStoredItems())[0].name).toBe('Full cream milk');
  });

  it('keeps the stored category and location when the edit leaves them undefined', async () => {
    const { result } = await renderInventory();

    let added: FoodItem | undefined;

    await act(async () => {
      added = await result.current.addItem({
        ...milk,
        category: 'Dairy',
        storageLocation: 'freezer',
      });
    });

    await act(async () => {
      await result.current.updateItem(added!.id, {
        ...milk,
        name: 'Full cream milk',
        category: undefined,
        storageLocation: undefined,
      });
    });

    expect(result.current.items[0]).toMatchObject({
      name: 'Full cream milk',
      category: 'Dairy',
      storageLocation: 'freezer',
    });
    expect((await readStoredItems())[0]).toMatchObject({ category: 'Dairy' });
  });

  it('replaces the category and location when the edit gives new ones', async () => {
    const { result } = await renderInventory();

    let added: FoodItem | undefined;

    await act(async () => {
      added = await result.current.addItem({ ...milk, category: 'Dairy' });
    });

    await act(async () => {
      await result.current.updateItem(added!.id, {
        ...milk,
        category: 'Meat',
        storageLocation: 'pantry',
      });
    });

    expect(result.current.items[0]).toMatchObject({ category: 'Meat', storageLocation: 'pantry' });
  });

  it('leaves the other items untouched', async () => {
    const { result } = await renderInventory();

    let added: FoodItem | undefined;

    await act(async () => {
      added = await result.current.addItem(milk);
      await result.current.addItem(spinach);
    });

    await act(async () => {
      await result.current.updateItem(added!.id, { ...milk, name: 'Full cream milk' });
    });

    expect(result.current.items.map((item) => item.name)).toEqual([
      'Full cream milk',
      'Baby spinach',
    ]);
  });

  it('replaces and cancels the previous expiry reminder', async () => {
    await storeItems([buildStoredItem({ notificationIds: ['old-advance', 'old-expiry'] })]);
    scheduleReminderMock.mockResolvedValueOnce({
      status: 'scheduled',
      notificationIds: ['new-advance', 'new-expiry'],
    });
    const { result } = await renderInventory();

    await act(async () => {
      await result.current.updateItem('stored-1', {
        name: 'Cheddar',
        quantity: '250 g',
        expiryDate: '2026-10-02',
        reminderDaysBefore: 3,
        notes: '',
      });
    });

    expect(result.current.items[0].notificationIds).toEqual(['new-advance', 'new-expiry']);
    expect(result.current.items[0].reminderDaysBefore).toBe(3);
    expect(cancelReminderMock).toHaveBeenCalledWith(['old-advance', 'old-expiry']);
  });

  it('reschedules reminders when only the custom reminder choice changes', async () => {
    await storeItems([buildStoredItem({ notificationIds: ['old-advance', 'old-expiry'] })]);
    scheduleReminderMock.mockResolvedValueOnce({
      status: 'scheduled',
      notificationIds: ['new-advance', 'new-expiry'],
    });
    const { result } = await renderInventory();

    await act(async () => {
      await result.current.updateItem('stored-1', {
        name: 'Mature cheddar',
        quantity: '250 g',
        expiryDate: '2026-09-29',
        reminderDaysBefore: 7,
        notes: '',
      });
    });

    expect(result.current.items[0].reminderDaysBefore).toBe(7);
    expect(scheduleReminderMock).toHaveBeenCalled();
    expect(cancelReminderMock).toHaveBeenCalledWith(['old-advance', 'old-expiry']);
  });

  it('keeps the scheduled reminders when only the quantity and notes change', async () => {
    await storeItems([buildStoredItem({ notificationIds: ['advance', 'expiry'] })]);
    const { result } = await renderInventory();

    await act(async () => {
      await result.current.updateItem('stored-1', {
        name: 'Cheddar',
        quantity: '500 g',
        expiryDate: '2026-09-29',
        reminderDaysBefore: 1,
        notes: 'Opened on Sunday',
      });
    });

    /* Rescheduling would re-send an advance reminder whose day has already passed. */
    expect(scheduleReminderMock).not.toHaveBeenCalled();
    expect(cancelReminderMock).not.toHaveBeenCalled();
    expect(result.current.items[0]).toMatchObject({
      quantity: '500 g',
      notes: 'Opened on Sunday',
      notificationIds: ['advance', 'expiry'],
    });
    expect((await readStoredItems())[0].notes).toBe('Opened on Sunday');
  });

  it('schedules reminders when an item without any is edited', async () => {
    /* For example, notifications were off when it was added and are now on. */
    await storeItems([buildStoredItem()]);
    scheduleReminderMock.mockResolvedValueOnce({
      status: 'scheduled',
      notificationIds: ['new-advance', 'new-expiry'],
    });
    const { result } = await renderInventory();

    await act(async () => {
      await result.current.updateItem('stored-1', {
        name: 'Cheddar',
        quantity: '250 g',
        expiryDate: '2026-09-29',
        reminderDaysBefore: 1,
        notes: '',
      });
    });

    expect(scheduleReminderMock).toHaveBeenCalledTimes(1);
    expect(result.current.items[0].notificationIds).toEqual(['new-advance', 'new-expiry']);
  });
});

describe('deleting an item', () => {
  it('removes it from the inventory and from storage', async () => {
    const { result } = await renderInventory();

    let added: FoodItem | undefined;

    await act(async () => {
      added = await result.current.addItem(milk);
      await result.current.addItem(spinach);
    });

    await act(async () => {
      await result.current.deleteItem(added!.id);
    });

    expect(result.current.items.map((item) => item.name)).toEqual(['Baby spinach']);
    expect(await readStoredItems()).toHaveLength(1);
  });

  it('cancels its expiry reminders', async () => {
    await storeItems([
      buildStoredItem({ notificationIds: ['advance-notification', 'expiry-notification'] }),
    ]);
    const { result } = await renderInventory();

    await act(async () => {
      await result.current.deleteItem('stored-1');
    });

    expect(cancelReminderMock).toHaveBeenCalledWith([
      'advance-notification',
      'expiry-notification',
    ]);
  });
});

describe('resolving an item', () => {
  it.each([['eaten'], ['discarded'], ['donated']] as const)(
    'records that it was %s, with the date it happened',
    async (status) => {
      const { result } = await renderInventory();

      let added: FoodItem | undefined;

      await act(async () => {
        added = await result.current.addItem(milk);
      });

      await act(async () => {
        await result.current.resolveItem(added!.id, status);
      });

      const [resolved] = result.current.items;

      expect(resolved.status).toBe(status);
      expect(resolved.statusUpdatedAt).toEqual(expect.any(String));

      /* Resolved items leave the inventory list but stay on the record. */
      expect(result.current.activeItems).toEqual([]);
      expect((await readStoredItems())[0].status).toBe(status);
    },
  );

  it('cancels the reminder and removes its identifier', async () => {
    await storeItems([
      buildStoredItem({ notificationIds: ['advance-notification', 'expiry-notification'] }),
    ]);
    const { result } = await renderInventory();

    await act(async () => {
      await result.current.resolveItem('stored-1', 'eaten');
    });

    expect(result.current.items[0].notificationIds).toBeUndefined();
    expect(cancelReminderMock).toHaveBeenCalledWith([
      'advance-notification',
      'expiry-notification',
    ]);
  });
});

describe('querying the active inventory', () => {
  it('lists only active items, soonest to expire first', async () => {
    await storeItems([
      buildStoredItem({ id: 'later', name: 'Cheddar', expiryDate: '2026-09-29' }),
      buildStoredItem({ id: 'soonest', name: 'Baby spinach', expiryDate: '2026-09-17' }),
      buildStoredItem({ id: 'middle', name: 'Milk', expiryDate: '2026-09-20' }),
      buildStoredItem({ id: 'eaten', name: 'Yoghurt', expiryDate: '2026-09-18', status: 'eaten' }),
    ]);

    const { result } = await renderInventory();

    expect(result.current.activeItems.map((item) => item.id)).toEqual([
      'soonest',
      'middle',
      'later',
    ]);
  });
});
