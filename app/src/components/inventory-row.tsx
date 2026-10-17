import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { FoodItem } from '@/types/food-item';
import { getExpiryListPresentation, getExpiryPresentation } from '@/utils/expiry-date';

type InventoryRowProps = {
  item: FoodItem;
  /** Passed in so every row on the screen agrees on what day it is. */
  today: Date;
};

/**
 * One grocery item in the inventory list.
 *
 * The row is deliberately two facts — what it is and when it goes off — with
 * the colour rail repeating the urgency its section heading already states.
 * Tapping opens the item; swiping left is the shortcut past it to the edit
 * form, for the common case of correcting a date at the fridge door.
 */
export function InventoryRow({ item, today }: InventoryRowProps) {
  const { meta, railColor } = getExpiryListPresentation(item.expiryDate, today);

  function openItem() {
    router.push({ pathname: '/item/[id]', params: { id: item.id } });
  }

  function openEditForm(swipeable: SwipeableMethods) {
    swipeable.close();

    router.push({ pathname: '/item/edit/[id]', params: { id: item.id } });
  }

  function renderEditAction(
    _progress: unknown,
    _translation: unknown,
    swipeable: SwipeableMethods,
  ) {
    return (
      <Pressable
        accessibilityLabel={`Edit ${item.name}`}
        accessibilityRole="button"
        onPress={() => openEditForm(swipeable)}
        style={({ pressed }) => [styles.editAction, pressed ? styles.pressed : null]}
      >
        <Ionicons color="#ffffff" name="create-outline" size={20} />
        <Text style={styles.editActionLabel}>Edit</Text>
      </Pressable>
    );
  }

  return (
    <ReanimatedSwipeable
      friction={2}
      /* There are no left actions, so dragging the other way must not move the row. */
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={renderEditAction}
      rightThreshold={36}
    >
      <Pressable
        accessibilityHint="Opens the item"
        accessibilityLabel={`${item.name}, ${getExpiryPresentation(item.expiryDate, today).label}`}
        accessibilityRole="button"
        onPress={openItem}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      >
        <View style={[styles.rail, { backgroundColor: railColor }]} />

        <Text numberOfLines={1} style={styles.name}>
          {item.name}
        </Text>

        <Text style={styles.meta}>{meta}</Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 16,
    backgroundColor: '#ffffff',
  },
  rail: {
    alignSelf: 'stretch',
    width: 4,
  },
  name: {
    flex: 1,
    color: '#172019',
    fontSize: 17,
    fontWeight: '600',
  },
  meta: {
    color: '#687269',
    fontSize: 13,
    fontWeight: '600',
  },
  editAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#2f7d32',
  },
  editActionLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
