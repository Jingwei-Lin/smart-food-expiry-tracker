import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { FoodItem, NewFoodItem } from '@/types/food-item';

const STORAGE_KEY = '@smart-food-expiry-tracker/inventory-v1';

type InventoryContextValue = {
  items: FoodItem[];
  activeItems: FoodItem[];
  isLoading: boolean;
  storageError: string | null;
  addItem: (input: NewFoodItem) => Promise<FoodItem>;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

/**
 * Checks that a value loaded from storage has the expected FoodItem fields.
 */
function isFoodItem(value: unknown): value is FoodItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<FoodItem>;

  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.quantity === 'string' &&
    typeof item.expiryDate === 'string' &&
    typeof item.notes === 'string' &&
    typeof item.createdAt === 'string' &&
    (item.status === 'active' || item.status === 'eaten' || item.status === 'discarded')
  );
}

/**
 * Produces an identifier suitable for locally stored prototype data.
 */
function createItemId(): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 10);

  return `${timestamp}-${randomPart}`;
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  /*
   * The ref always contains the latest items. This prevents save operations
   * from using an older copy of the inventory.
   */
  const itemsRef = useRef<FoodItem[]>([]);

  const setCurrentItems = useCallback((nextItems: FoodItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  /*
   * Load the stored inventory once when the provider starts.
   */
  useEffect(() => {
    let isMounted = true;

    async function loadInventory() {
      try {
        const storedValue = await AsyncStorage.getItem(STORAGE_KEY);

        if (!storedValue) {
          if (isMounted) {
            setCurrentItems([]);
          }

          return;
        }

        const parsedValue: unknown = JSON.parse(storedValue);

        if (!Array.isArray(parsedValue)) {
          throw new Error('The stored inventory is not an array.');
        }

        const validItems = parsedValue.filter(isFoodItem);

        if (isMounted) {
          setCurrentItems(validItems);
          setStorageError(null);
        }
      } catch {
        if (isMounted) {
          setStorageError('The saved inventory could not be loaded.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInventory();

    return () => {
      isMounted = false;
    };
  }, [setCurrentItems]);

  /*
   * Save a complete inventory list before updating the visible state.
   */
  const persistItems = useCallback(
    async (nextItems: FoodItem[]) => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));

        setCurrentItems(nextItems);
        setStorageError(null);
      } catch {
        setStorageError('The latest inventory change could not be saved.');
        throw new Error('Unable to save inventory.');
      }
    },
    [setCurrentItems],
  );

  /*
   * Convert manual-entry values into a complete FoodItem and save it.
   */
  const addItem = useCallback(
    async (input: NewFoodItem) => {
      const newItem: FoodItem = {
        id: createItemId(),
        name: input.name,
        quantity: input.quantity,
        expiryDate: input.expiryDate,
        notes: input.notes,
        createdAt: new Date().toISOString(),
        status: 'active',
      };

      const nextItems = [...itemsRef.current, newItem];

      await persistItems(nextItems);

      return newItem;
    },
    [persistItems],
  );

  const activeItems = useMemo(
    () =>
      items
        .filter((item) => item.status === 'active')
        .sort((firstItem, secondItem) =>
          firstItem.expiryDate.localeCompare(secondItem.expiryDate),
        ),
    [items],
  );

  const contextValue = useMemo<InventoryContextValue>(
    () => ({
      items,
      activeItems,
      isLoading,
      storageError,
      addItem,
    }),
    [items, activeItems, isLoading, storageError, addItem],
  );

  return (
    <InventoryContext.Provider value={contextValue}>{children}</InventoryContext.Provider>
  );
}

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext);

  if (!context) {
    throw new Error('useInventory must be used inside InventoryProvider.');
  }

  return context;
}