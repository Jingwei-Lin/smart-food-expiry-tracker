import React from 'react';
import { View } from 'react-native';
import { Apple, Beef, Fish, Leaf, Milk, Package, Wheat } from 'lucide-react-native';
import type { FoodCategory } from '@/types/food-item';

type FoodCategoryIconProps = {
  category?: FoodCategory;
  size?: number;
  color?: string;
  backgroundColor?: string;
};

const CATEGORY_ICONS = {
  Veg: Leaf,
  Fruit: Apple,
  Dairy: Milk,
  Meat: Beef,
  Bread: Wheat,
  Seafood: Fish,
  Others: Package,
} as const;

const DEFAULT_COLOR = '#55614D';
const DEFAULT_BACKGROUND = '#F0F7DB';

export function FoodCategoryIcon({
  category,
  size = 24,
  color = DEFAULT_COLOR,
  backgroundColor = DEFAULT_BACKGROUND,
}: FoodCategoryIconProps) {
  const Icon = CATEGORY_ICONS[category ?? 'Others'];

  // The circle grows with the icon but never gets so tight that small icons touch its edge.
  const padding = Math.max(8, Math.round(size * 0.65));

  return (
    <CircleBadge size={size + padding * 2} backgroundColor={backgroundColor}>
      <Icon size={size} color={color} strokeWidth={1.8} />
    </CircleBadge>
  );
}

function CircleBadge({
  size,
  backgroundColor,
  children,
}: {
  size: number;
  backgroundColor: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}
