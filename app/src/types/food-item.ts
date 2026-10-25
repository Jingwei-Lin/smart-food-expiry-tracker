export type FoodItemStatus = 'active' | 'eaten' | 'discarded' | 'donated';

/** The statuses an item can be resolved into once it leaves the inventory. */
export type ResolvedFoodItemStatus = Exclude<FoodItemStatus, 'active'>;

/** Where the food item is stored in the user's home. */
export type FoodStorageLocation = 'fridge' | 'freezer' | 'pantry';

export type FoodCategory =
  | 'Veg'
  | 'Fruit'
  | 'Dairy'
  | 'Meat'
  | 'Bread'
  | 'Seafood'
  | 'Others';

export type FoodItem = {
  id: string;
  name: string;
  quantity: string;
  expiryDate: string;

  /** Where the item is stored; older saved items default to the fridge. */
  storageLocation: FoodStorageLocation;

  /** User-selected advance notice, constrained to one through seven days. */
  reminderDaysBefore: number;

  /** 1 marks an item saved by v1.0 whose reminders still need scheduling; 2 is everything since. */
  reminderRuleVersion: 1 | 2;

  notes: string;
  createdAt: string;
  status: FoodItemStatus;

  /** When the item was eaten, thrown out or donated; the weekly summary aggregates on it. */
  statusUpdatedAt?: string;

  /** Absent on an item typed in by hand, and on anything saved before scanning existed. */
  barcode?: string;

  category?: FoodCategory;

  /** Native identifiers for the advance and expiry-day local reminders. */
  notificationIds?: string[];
};

export type NewFoodItem = Pick<
  FoodItem,
  | 'name'
  | 'quantity'
  | 'expiryDate'
  | 'reminderDaysBefore'
  | 'notes'
  | 'barcode'
  | 'storageLocation'
  | 'category'
>;
