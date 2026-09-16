import { router } from 'expo-router';

/**
 * Returns to the inventory once an item has been saved, resolved or deleted.
 *
 * Every item screen is pushed over the inventory, so popping is the right move
 * and keeps a single inventory in the stack. A deep link can open one of those
 * screens with nothing underneath, which is the case the fallback covers.
 */
export function returnToInventory(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace('/');
}
