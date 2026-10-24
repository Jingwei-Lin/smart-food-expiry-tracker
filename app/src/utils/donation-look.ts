import type { Ionicons } from '@expo/vector-icons';

import type { PointType } from '@/utils/overpass';

type IconName = keyof typeof Ionicons.glyphMap;

/*
 * Each kind of place gets its own tint and icon, in place of a photo. Shared
 * by the list and the detail screen so a place looks the same on both.
 */
export const TYPE_LOOK: Record<PointType, { icon: IconName; tint: string; accent: string }> = {
  'Food bank': { icon: 'basket-outline', tint: '#F0F7DB', accent: '#4E7A1F' },
  'Soup kitchen': { icon: 'restaurant-outline', tint: '#FBEFF2', accent: '#A92E26' },
  'Community pantry': { icon: 'file-tray-stacked-outline', tint: '#FFF0D5', accent: '#8B6B1F' },
};
