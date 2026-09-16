import { FoodItem } from '@/types/food-item';
import { daysUntilExpiry } from '@/utils/expiry-date';

export type InventorySection = {
  title: string;
  /** Expired items head the list, so their heading is coloured like their rail. */
  isUrgent: boolean;
  items: FoodItem[];
};

const EAT_SOON_DAYS = 3;
const THIS_WEEK_DAYS = 7;

/**
 * Groups the inventory by how much time is left, most urgent first.
 *
 * Items with an unreadable date fall into Later rather than being dropped, so a
 * bad record is still visible and can be fixed.
 */
export function buildInventorySections(
  items: FoodItem[],
  today = new Date(),
): InventorySection[] {
  const expired: FoodItem[] = [];
  const eatSoon: FoodItem[] = [];
  const thisWeek: FoodItem[] = [];
  const later: FoodItem[] = [];

  for (const item of items) {
    const days = daysUntilExpiry(item.expiryDate, today);

    if (days < 0) {
      expired.push(item);
    } else if (days <= EAT_SOON_DAYS) {
      eatSoon.push(item);
    } else if (days <= THIS_WEEK_DAYS) {
      thisWeek.push(item);
    } else {
      later.push(item);
    }
  }

  const sections: InventorySection[] = [
    { title: 'Expired', isUrgent: true, items: expired },
    { title: 'Eat soon', isUrgent: false, items: eatSoon },
    { title: 'This week', isUrgent: false, items: thisWeek },
    { title: 'Later', isUrgent: false, items: later },
  ];

  return sections.filter((section) => section.items.length > 0);
}
