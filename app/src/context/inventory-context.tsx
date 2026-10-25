
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

import {
  FoodCategory,
  FoodItem,
  FoodStorageLocation,
  NewFoodItem,
  ResolvedFoodItemStatus,
} from '@/types/food-item';
import {
  cancelExpiryReminders,
  ReminderScheduleResult,
  scheduleExpiryReminders,
} from '@/services/expiry-notifications';

const STORAGE_KEY = '@smart-food-expiry-tracker/inventory-v1';
function normalizeFoodCategory(value: unknown): FoodCategory {
  if (typeof value !== 'string') {
    return 'Others';
  }

  const normalized = value.trim().toLowerCase();

  const categoryMap: Record<string, FoodCategory> = {
    veg: 'Veg',
    vegetable: 'Veg',
    vegetables: 'Veg',
    fruit: 'Fruit',
    fruits: 'Fruit',
    dairy: 'Dairy',
    meat: 'Meat',
    bread: 'Bread',
    seafood: 'Seafood',
    fish: 'Seafood',
    others: 'Others',
    other: 'Others',
    pantry: 'Others',
  };

  return categoryMap[normalized] ?? 'Others';
}

type InventoryContextValue = {
  items: FoodItem[];
  activeItems: FoodItem[];
  isLoading: boolean;
  storageError: string | null;
  reminderNotice: string | null;
  isStorageReady: boolean;
  addItem: (input: NewFoodItem) => Promise<FoodItem>;
  updateItem: (id: string, input: NewFoodItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  resolveItem: (
    id: string,
    status: ResolvedFoodItemStatus,
  ) => Promise<void>;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

const VALID_STORAGE_LOCATIONS: FoodStorageLocation[] = [
  'fridge',
  'freezer',
  'pantry',
];

const VALID_FOOD_CATEGORIES: FoodCategory[] = [
  'Veg',
  'Fruit',
  'Dairy',
  'Meat',
  'Bread',
  'Seafood',
  'Others',
];

/**
 * Validates a stored item.
 * Older records without storageLocation default to the fridge.
 * Existing reminder migration behaviour is preserved.
 */
function normalizeFoodItem(value: unknown): FoodItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.id !== 'string' ||
    typeof item.name !== 'string' ||
    typeof item.quantity !== 'string' ||
    typeof item.expiryDate !== 'string' ||
    typeof item.notes !== 'string' ||
    typeof item.createdAt !== 'string' ||
    (item.status !== 'active' &&
      item.status !== 'eaten' &&
      item.status !== 'discarded' &&
      item.status !== 'donated')
  ) {
    return null;
  }

  const reminderDaysBefore = item.reminderDaysBefore ?? 1;
  const reminderRuleVersion = item.reminderRuleVersion ?? 1;

  if (
    typeof reminderDaysBefore !== 'number' ||
    !Number.isInteger(reminderDaysBefore) ||
    reminderDaysBefore < 1 ||
    reminderDaysBefore > 7
  ) {
    return null;
  }

  if (reminderRuleVersion !== 1 && reminderRuleVersion !== 2) {
    return null;
  }

  const storageLocation: FoodStorageLocation =
    typeof item.storageLocation === 'string' &&
    VALID_STORAGE_LOCATIONS.includes(
      item.storageLocation as FoodStorageLocation,
    )
      ? (item.storageLocation as FoodStorageLocation)
      : 'fridge';

  let notificationIds: string[] | undefined;

  if (
    Array.isArray(item.notificationIds) &&
    item.notificationIds.every((id) => typeof id === 'string')
  ) {
    notificationIds = item.notificationIds;
  } else if (item.notificationIds !== undefined) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    expiryDate: item.expiryDate,
    storageLocation,
    reminderDaysBefore,
    reminderRuleVersion,
    notes: item.notes,
    createdAt: item.createdAt,
    status: item.status,
    ...(typeof item.statusUpdatedAt === 'string'
      ? { statusUpdatedAt: item.statusUpdatedAt }
      : null),
    ...(typeof item.barcode === 'string'
      ? { barcode: item.barcode }
      : null),
    category: normalizeFoodCategory(item.category),
    ...(notificationIds && notificationIds.length > 0
      ? { notificationIds }
      : null),
  };
}

function setNotificationIds(
  item: FoodItem,
  notificationIds?: string[],
): FoodItem {
  const nextItem = { ...item };

  delete nextItem.notificationIds;

  if (notificationIds && notificationIds.length > 0) {
    nextItem.notificationIds = notificationIds;
  }

  return nextItem;
}

function describeReminderResult(
  result: ReminderScheduleResult,
): string | null {
  if (result.status === 'permission-denied') {
    return 'This item was saved, but expiry reminders are off. Enable notifications in your device settings, then edit the item to schedule its reminders.';
  }

  if (result.status === 'error') {
    return 'This item was saved, but one or more expiry reminders could not be scheduled.';
  }

  return null;
}

function describeUpgradeFailure(
  result: ReminderScheduleResult,
): string | null {
  if (result.status === 'permission-denied') {
    return 'Expiry reminders are off. Enable notifications in your device settings and your reminders will be set up the next time you open the app.';
  }

  if (result.status === 'error') {
    return 'Some expiry reminders could not be set up. The app will try again the next time you open it.';
  }

  return null;
}

function createItemId(): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 10);

  return `${timestamp}-${randomPart}`;
}

export function InventoryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);

  const [isStorageReady, setIsStorageReady] = useState(false);
  const isStorageReadyRef = useRef(false);

  const markStorageReady = useCallback(() => {
    isStorageReadyRef.current = true;
    setIsStorageReady(true);
  }, []);

  const itemsRef = useRef<FoodItem[]>([]);
  const hasReconciledRemindersRef = useRef(false);

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
            markStorageReady();
          }

          return;
        }

        const parsedValue: unknown = JSON.parse(storedValue);

        if (!Array.isArray(parsedValue)) {
          throw new Error('The stored inventory is not an array.');
        }

        const validItems = parsedValue
          .map(normalizeFoodItem)
          .filter((item): item is FoodItem => item !== null);

        if (isMounted) {
          setCurrentItems(validItems);
          setStorageError(null);
          markStorageReady();
        }
      } catch {
        if (isMounted) {
          setStorageError(
            'The saved inventory could not be loaded, so new items cannot be saved right now.',
          );
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
  }, [markStorageReady, setCurrentItems]);

  /*
   * Save a complete inventory list before updating the visible state.
   */
  const persistItems = useCallback(
    async (nextItems: FoodItem[]) => {
      if (!isStorageReadyRef.current) {
        throw new Error(
          'Unable to save inventory before it has been loaded.',
        );
      }

      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(nextItems),
        );

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
   * Schedule reminders for legacy items that still use rule version 1.
   */
  useEffect(() => {
    if (!isStorageReady || hasReconciledRemindersRef.current) {
      return;
    }

    hasReconciledRemindersRef.current = true;
    let isMounted = true;

    async function reconcileLegacyReminders() {
      const legacyItems = itemsRef.current.filter(
        (item) => item.reminderRuleVersion === 1,
      );

      if (legacyItems.length === 0) {
        return;
      }

      const upgradedItems = new Map<FoodItem, FoodItem>();
      const newlyScheduledIds: string[][] = [];
      let migrationNotice: string | null = null;

      for (const legacyItem of legacyItems) {
        const reminderResult =
          legacyItem.status === 'active'
            ? await scheduleExpiryReminders(legacyItem)
            : ({ status: 'not-needed' } as const);

        if (
          reminderResult.status === 'permission-denied' ||
          reminderResult.status === 'error'
        ) {
          migrationNotice = describeUpgradeFailure(reminderResult);
          continue;
        }

        if (reminderResult.status === 'scheduled') {
          newlyScheduledIds.push(reminderResult.notificationIds);
        }

        upgradedItems.set(
          legacyItem,
          setNotificationIds(
            { ...legacyItem, reminderRuleVersion: 2 },
            reminderResult.status === 'scheduled'
              ? reminderResult.notificationIds
              : undefined,
          ),
        );
      }

      /*
       * Only upgrade records that have not changed during reminder scheduling.
       */
      const currentItems = itemsRef.current;
      const idsToCancel: string[][] = [];
      let didChange = false;

      for (const [legacyItem, upgradedItem] of upgradedItems) {
        if (currentItems.includes(legacyItem)) {
          didChange = true;
        } else if (upgradedItem.notificationIds) {
          idsToCancel.push(upgradedItem.notificationIds);
        }
      }

      if (didChange) {
        try {
          await persistItems(
            currentItems.map(
              (item) => upgradedItems.get(item) ?? item,
            ),
          );
        } catch {
          await Promise.all(
            newlyScheduledIds.map((ids) => cancelExpiryReminders(ids)),
          );
          return;
        }
      }

      const cancellationResults = await Promise.all(
        idsToCancel.map((ids) => cancelExpiryReminders(ids)),
      );

      if (isMounted) {
        setReminderNotice(
          cancellationResults.some((wasSuccessful) => !wasSuccessful)
            ? 'Your reminders were set up, but one or more that are no longer needed could not be cancelled.'
            : migrationNotice,
        );
      }
    }

    void reconcileLegacyReminders();

    return () => {
      isMounted = false;
    };
  }, [isStorageReady, persistItems]);

  /*
   * Create a new inventory item and schedule its expiry reminders.
   */
  const addItem = useCallback(
    async (input: NewFoodItem) => {
      let newItem: FoodItem = {
        id: createItemId(),
        name: input.name,
        quantity: input.quantity,
        expiryDate: input.expiryDate,
        storageLocation: input.storageLocation ?? 'fridge',
        reminderDaysBefore: input.reminderDaysBefore,
        reminderRuleVersion: 2,
        notes: input.notes,
        createdAt: new Date().toISOString(),
        status: 'active',
        ...(input.barcode ? { barcode: input.barcode } : null),
        ...(input.category ? { category: input.category } : null),
      };

      const reminderResult = await scheduleExpiryReminders(newItem);

      if (reminderResult.status === 'scheduled') {
        newItem = setNotificationIds(
          newItem,
          reminderResult.notificationIds,
        );
      }

      const nextItems = [...itemsRef.current, newItem];

      try {
        await persistItems(nextItems);
      } catch (error) {
        if (reminderResult.status === 'scheduled') {
          await cancelExpiryReminders(reminderResult.notificationIds);
        }

        throw error;
      }

      setReminderNotice(describeReminderResult(reminderResult));

      return newItem;
    },
    [persistItems],
  );

  /*
   * Update an item while preserving fields not owned by the form.
   */
  const updateItem = useCallback(
    async (id: string, input: NewFoodItem) => {
      const currentItem = itemsRef.current.find(
        (item) => item.id === id,
      );

      if (!currentItem) {
        return;
      }

      const editedItem: FoodItem = {
        ...currentItem,
        ...input,
        storageLocation:
          input.storageLocation ??
          currentItem.storageLocation ??
          'fridge',
        reminderRuleVersion: 2,
      };

      /*
       * A storage-location-only change does not affect expiry reminders.
       */
      const keepsReminders =
        currentItem.notificationIds !== undefined &&
        editedItem.name === currentItem.name &&
        editedItem.expiryDate === currentItem.expiryDate &&
        editedItem.reminderDaysBefore ===
          currentItem.reminderDaysBefore;

      if (keepsReminders) {
        await persistItems(
          itemsRef.current.map((item) =>
            item.id === id ? editedItem : item,
          ),
        );
        return;
      }

      const reminderResult = await scheduleExpiryReminders(editedItem);

      const updatedItem = setNotificationIds(
        editedItem,
        reminderResult.status === 'scheduled'
          ? reminderResult.notificationIds
          : undefined,
      );

      const nextItems = itemsRef.current.map((item) =>
        item.id === id ? updatedItem : item,
      );

      try {
        await persistItems(nextItems);
      } catch (error) {
        if (reminderResult.status === 'scheduled') {
          await cancelExpiryReminders(
            reminderResult.notificationIds,
          );
        }

        throw error;
      }

      setReminderNotice(describeReminderResult(reminderResult));

      if (
        currentItem.notificationIds &&
        !(await cancelExpiryReminders(currentItem.notificationIds))
      ) {
        setReminderNotice(
          'The item was updated, but one or more previous reminders could not be cancelled.',
        );
      }
    },
    [persistItems],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const deletedItem = itemsRef.current.find(
        (item) => item.id === id,
      );

      await persistItems(
        itemsRef.current.filter((item) => item.id !== id),
      );

      if (
        deletedItem?.notificationIds &&
        !(await cancelExpiryReminders(deletedItem.notificationIds))
      ) {
        setReminderNotice(
          'The item was deleted, but one or more reminders could not be cancelled.',
        );
      }
    },
    [persistItems],
  );

  /*
   * Record the outcome and timestamp used by the weekly summary.
   */
  const resolveItem = useCallback(
    async (id: string, status: ResolvedFoodItemStatus) => {
      const resolvedItem = itemsRef.current.find(
        (item) => item.id === id,
      );

      const nextItems = itemsRef.current.map((item) => {
        if (item.id !== id) {
          return item;
        }

        return setNotificationIds({
          ...item,
          status,
          statusUpdatedAt: new Date().toISOString(),
        });
      });

      await persistItems(nextItems);

      if (
        resolvedItem?.notificationIds &&
        !(await cancelExpiryReminders(resolvedItem.notificationIds))
      ) {
        setReminderNotice(
          'The item was updated, but one or more reminders could not be cancelled.',
        );
      }
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
      reminderNotice,
      isStorageReady,
      addItem,
      updateItem,
      deleteItem,
      resolveItem,
    }),
    [
      items,
      activeItems,
      isLoading,
      storageError,
      reminderNotice,
      isStorageReady,
      addItem,
      updateItem,
      deleteItem,
      resolveItem,
    ],
  );

  return (
    <InventoryContext.Provider value={contextValue}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext);

  if (!context) {
    throw new Error(
      'useInventory must be used inside InventoryProvider.',
    );
  }

  return context;
}
