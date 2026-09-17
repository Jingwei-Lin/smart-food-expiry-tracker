export type FoodItemStatus = 'active' | 'eaten' | 'discarded';

/** The statuses an item can be resolved into once it leaves the inventory. */
export type ResolvedFoodItemStatus = Exclude<FoodItemStatus, 'active'>;

export type FoodItem = {
  id: string;
  name: string;
  quantity: string;
  expiryDate: string;
  notes: string;
  createdAt: string;
  status: FoodItemStatus;
  /** When the item was eaten or thrown out; the weekly summary aggregates on it. */
  statusUpdatedAt?: string;
  /** Absent on an item typed in by hand, and on anything saved before scanning existed. */
  barcode?: string;
};

export type NewFoodItem = Pick<
  FoodItem,
  'name' | 'quantity' | 'expiryDate' | 'notes' | 'barcode'
>;
