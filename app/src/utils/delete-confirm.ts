import type { FoodItem } from '@/types/food-item';

/**
 * The question asked before an item is deleted, shared by the list's swipe
 * and the item screen so the two always say the same thing.
 *
 * Only a resolved item counts towards the waste summary, so only its warning
 * says it leaves the summary too.
 */
export function describeDeletion(item: Pick<FoodItem, 'name' | 'status'>): {
  title: string;
  message: string;
} {
  const removes =
    item.status === 'active'
      ? 'This removes the item from your inventory.'
      : 'This removes the item from your inventory and from the waste summary.';

  return {
    title: `Delete ${item.name}?`,
    message: `${removes} It cannot be undone.`,
  };
}
