import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useInventory } from '@/context/inventory-context';
import { FoodItem } from '@/types/food-item';
import { describeDeletion } from '@/utils/delete-confirm';
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
 * Tapping opens the item. Swiping left offers two shortcuts past it: Edit,
 * for the common case of correcting a date at the fridge door, and Delete,
 * for food added by mistake.
 */
export function InventoryRow({ item, today }: InventoryRowProps) {
  const { deleteItem } = useInventory();
  const { meta, railColor } = getExpiryListPresentation(item.expiryDate, today);

  function openItem() {
    router.push({ pathname: '/item/[id]', params: { id: item.id } });
  }

  function openEditForm(swipeable: SwipeableMethods) {
    swipeable.close();

    router.push({ pathname: '/item/edit/[id]', params: { id: item.id } });
  }

  async function removeItem() {
    try {
      await deleteItem(item.id);
    } catch {
      const title = "Couldn't delete";
      const message = 'This item could not be deleted. Please try again.';

      if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${message}`);
      } else {
        Alert.alert(title, message);
      }
    }
  }

  /*
   * Asks first, with the item screen's wording, so a stray swipe and tap can
   * still be backed out of. A native dialog, because a row has no room for the
   * item screen's inline confirm card. react-native-web's Alert does nothing,
   * so the web build asks with the browser's own dialog instead.
   */
  function confirmDelete(swipeable: SwipeableMethods) {
    swipeable.close();

    const { title, message } = describeDeletion(item);

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        void removeItem();
      }

      return;
    }

    Alert.alert(title, message, [
      { text: 'Keep item', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeItem() },
    ]);
  }

  function renderActions(_progress: unknown, _translation: unknown, swipeable: SwipeableMethods) {
    return (
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`Edit ${item.name}`}
          accessibilityRole="button"
          onPress={() => openEditForm(swipeable)}
          style={({ pressed }) => [
            styles.action,
            styles.editAction,
            pressed ? styles.pressed : null,
          ]}
        >
          <Ionicons color="#ffffff" name="create-outline" size={20} />
          <Text style={styles.actionLabel}>Edit</Text>
        </Pressable>

        <Pressable
          accessibilityLabel={`Delete ${item.name}`}
          accessibilityRole="button"
          onPress={() => confirmDelete(swipeable)}
          style={({ pressed }) => [
            styles.action,
            styles.deleteAction,
            pressed ? styles.pressed : null,
          ]}
        >
          <Ionicons color="#ffffff" name="trash-outline" size={20} />
          <Text style={styles.actionLabel}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ReanimatedSwipeable
      friction={2}
      /* There are no left actions, so dragging the other way must not move the row. */
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={renderActions}
      rightThreshold={36}
    >
      <Pressable
        accessibilityHint="Opens the item"
        accessibilityLabel={`${item.name}, ${getExpiryPresentation(item.expiryDate, today).label}`}
        accessibilityRole="button"
        onPress={openItem}
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
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
  actions: {
    flexDirection: 'row',
  },
  action: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  editAction: {
    backgroundColor: '#2f7d32',
  },
  /* The item screen's colour for deleting. */
  deleteAction: {
    backgroundColor: '#9f2420',
  },
  actionLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  /*
   * The swipe actions sit right behind the row and become visible the moment
   * it moves, while a finger starting a swipe still counts as a press. Fading
   * the row would let them show through, so a press darkens it instead.
   */
  rowPressed: {
    backgroundColor: '#eef2ec',
  },
  pressed: {
    opacity: 0.72,
  },
});
