export type FoodItemStatus = 'active' | 'eaten' | 'discarded';

/** The statuses an item can be resolved into once it leaves the inventory. */
export type ResolvedFoodItemStatus = Exclude<FoodItemStatus, 'active'>;

export type FoodItem = {
  id: string;
  name: string;
  quantity: string;
  expiryDate: string;
  /** User-selected advance notice, constrained to one through seven days. */
  reminderDaysBefore: number;
  /** Internal version used to upgrade reminders created under the earlier one-alert rule. */
  reminderRuleVersion: 1 | 2;
  notes: string;
  createdAt: string;
  status: FoodItemStatus;
  /** When the item was eaten or thrown out; the weekly summary aggregates on it. */
  statusUpdatedAt?: string;
  /** Absent on an item typed in by hand, and on anything saved before scanning existed. */
  barcode?: string;
  /** Native identifiers for the advance and expiry-day local reminders. */
  notificationIds?: string[];
};

export type NewFoodItem = Pick<
  FoodItem,
  'name' | 'quantity' | 'expiryDate' | 'reminderDaysBefore' | 'notes' | 'barcode'
>;
