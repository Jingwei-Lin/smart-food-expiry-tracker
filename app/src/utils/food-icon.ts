import type { Ionicons } from '@expo/vector-icons';

/**
 * A rough icon for a food, guessed from its name. Shared by the inventory
 * list and the donation point screen, so a food looks the same on both.
 */
export function getFoodIcon(name: string): keyof typeof Ionicons.glyphMap {
  const value = name.toLowerCase();

  if (/milk|water|juice|drink/.test(value)) {
    return 'water-outline';
  }

  if (/spinach|lettuce|leaf|salad|herb|broccoli/.test(value)) {
    return 'leaf-outline';
  }

  if (/chicken|meat|beef|pork|fish|salmon/.test(value)) {
    return 'fast-food-outline';
  }

  if (/bread|sourdough|toast|bagel/.test(value)) {
    return 'restaurant-outline';
  }

  if (/egg/.test(value)) {
    return 'egg-outline';
  }

  if (/apple|fruit|orange|banana|berry|berries/.test(value)) {
    return 'nutrition-outline';
  }

  if (/cheese|cheddar/.test(value)) {
    return 'pizza-outline';
  }

  if (/yoghurt|yogurt|cream|butter/.test(value)) {
    return 'ice-cream-outline';
  }

  return 'basket-outline';
}
