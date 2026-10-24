
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ReanimatedSwipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useInventory } from '@/context/inventory-context';
import { getFoodIcon } from '@/utils/food-icon';
import { FoodItem } from '@/types/food-item';
import { describeDeletion } from '@/utils/delete-confirm';
import {
  daysUntilExpiry,
  getExpiryListPresentation,
  getExpiryPresentation,
} from '@/utils/expiry-date';

type InventoryRowProps = {
  item: FoodItem;
  today: Date;
};

const COLORS = {
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  divider: '#EEEFE5',
  accentSoft: '#F0F7DB',
  urgent: '#A92E26',
  urgentSoft: '#FBEFF2',
  warning: '#8B6B1F',
  warningSoft: '#FFF0D5',
};

function getExpiryBadgeStyle(item: FoodItem, today: Date) {
  const days = daysUntilExpiry(item.expiryDate, today);

  if (days < 0) {
    return {
      backgroundColor: COLORS.urgentSoft,
      color: COLORS.urgent,
    };
  }

  if (days === 0) {
    return {
      backgroundColor: COLORS.accentSoft,
      color: COLORS.primary,
    };
  }

  if (days <= 3) {
    return {
      backgroundColor: '#FFF1F5',
      color: COLORS.urgent,
    };
  }

  if (days <= 7) {
    return {
      backgroundColor: COLORS.warningSoft,
      color: COLORS.warning,
    };
  }

  return {
    backgroundColor: '#F3F3E9',
    color: COLORS.secondary,
  };
}

export function InventoryRow({ item, today }: InventoryRowProps) {
  const { deleteItem } = useInventory();

  const { meta } = getExpiryListPresentation(item.expiryDate, today);
  const expiry = getExpiryPresentation(item.expiryDate, today);
  const badge = getExpiryBadgeStyle(item, today);

  function openItem() {
    router.push({
      pathname: '/item/[id]',
      params: { id: item.id },
    });
  }

  function openEditForm(swipeable: SwipeableMethods) {
    swipeable.close();

    router.push({
      pathname: '/item/edit/[id]',
      params: { id: item.id },
    });
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
      {
        text: 'Keep item',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void removeItem(),
      },
    ]);
  }

  function renderActions(
    _progress: unknown,
    _translation: unknown,
    swipeable: SwipeableMethods,
  ) {
    return (
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}`}
          onPress={() => openEditForm(swipeable)}
          style={({ pressed }) => [
            styles.action,
            styles.editAction,
            pressed && styles.actionPressed,
          ]}
        >
          <Ionicons
            name="create-outline"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.actionLabel}>Edit</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.name}`}
          onPress={() => confirmDelete(swipeable)}
          style={({ pressed }) => [
            styles.action,
            styles.deleteAction,
            pressed && styles.actionPressed,
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.actionLabel}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ReanimatedSwipeable
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={renderActions}
      rightThreshold={36}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens the item"
        accessibilityLabel={`${item.name}, ${expiry.label}`}
        onPress={openItem}
        style={({ pressed }) => [
          styles.row,
          pressed && styles.rowPressed,
        ]}
      >
        <View style={styles.iconBox}>
          <Ionicons
            name={getFoodIcon(item.name)}
            size={27}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.itemDetails}>
          <Text numberOfLines={2} style={styles.name}>
            {item.name}
          </Text>

          {item.quantity.trim() ? (
            <Text numberOfLines={1} style={styles.quantity}>
              {item.quantity}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.expiryBadge,
            { backgroundColor: badge.backgroundColor },
          ]}
        >
          <Text
            style={[
              styles.expiryText,
              { color: badge.color },
            ]}
          >
            {meta}
          </Text>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
  },

  iconBox: {
    width: 46,
    height: 46,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.accentSoft,
  },

  itemDetails: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },

  name: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 16,
    lineHeight: 21,
  },

  quantity: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
  },

  expiryBadge: {
    maxWidth: 105,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  expiryText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    textAlign: 'center',
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
    backgroundColor: '#2F7D32',
  },

  deleteAction: {
    backgroundColor: '#9F2420',
  },

  actionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  rowPressed: {
    backgroundColor: COLORS.accentSoft,
  },

  actionPressed: {
    opacity: 0.75,
  },
});
