import { type Href, router } from 'expo-router';

/**
 * Pops one screen, or opens `fallback` when there is nothing underneath.
 *
 * A pushed screen is usually opened from the one below it, so popping keeps a
 * single copy of each tab in the stack. A reminder or a deep link can open it
 * with nothing underneath, which is the case the fallback covers.
 */
export function goBackOr(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}

/** Returns to the inventory once an item has been saved, resolved or deleted. */
export function returnToInventory(): void {
  goBackOr('/');
}
