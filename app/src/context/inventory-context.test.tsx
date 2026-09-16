import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { InventoryProvider, useInventory } from '@/context/inventory-context';
import { FoodItem, NewFoodItem } from '@/types/food-item';

const STORAGE_KEY = '@smart-food-expiry-tracker/inventory-v1';

const milk: NewFoodItem = {
  name: 'Milk',
  quantity: '2 L',
  expiryDate: '2026-09-20',
  notes: 'Opened on Monday',
};

const spinach: NewFoodItem = {
  name: 'Baby spinach',
  quantity: '1 bag',
  expiryDate: '2026-09-17',
  notes: '',
};

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
    notes: '',
    createdAt: '2026-09-10T00:00:00.000Z',
    status: 'active',
    ...overrides,
  };
}

beforeEach(async () => {
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

describe('adding an item', () => {
  it('saves it and returns it with an id, a created date and an active status', async () => {
    const { result } = await renderInventory();

    let added: FoodItem | undefined;

    await act(async () => {
      added = await result.current.addItem(milk);
    });

    expect(added?.id).toEqual(expect.any(String));
    expect(added?.createdAt).toEqual(expect.any(String));
    expect(added?.status).toBe('active');

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
});

describe('resolving an item', () => {
  it.each([['eaten'], ['discarded']] as const)(
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
