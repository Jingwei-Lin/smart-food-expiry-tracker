import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InventoryRow } from '@/components/inventory-row';
import { useInventory } from '@/context/inventory-context';
import { useToday } from '@/hooks/use-today';
import { FoodItem } from '@/types/food-item';
import { daysUntilExpiry } from '@/utils/expiry-date';
import {
  buildInventorySections,
  EAT_SOON_DAYS,
  InventorySection,
} from '@/utils/inventory-sections';

/**
 * Builds the one-line summary under the title. "To eat soon" counts the same
 * food as the Eat soon section: expired food has its own section, so it is
 * not counted again here.
 */
function describeInventory(items: FoodItem[], today: Date): string {
  if (items.length === 0) {
    return 'Nothing tracked yet';
  }

  const itemWord = items.length === 1 ? 'item' : 'items';
  const soonCount = items.filter((item) => {
    const days = daysUntilExpiry(item.expiryDate, today);

    return days >= 0 && days <= EAT_SOON_DAYS;
  }).length;

  if (soonCount === 0) {
    return `${items.length} ${itemWord}`;
  }

  return `${items.length} ${itemWord} · ${soonCount} to eat soon`;
}

/**
 * Inventory screen, and the app's landing screen.
 *
 * Groups what is being tracked by how long it has left, so the food that needs
 * deciding on today is at the top and everything else stays quiet. Each group
 * is one card of single-line rows.
 */
export default function InventoryScreen() {
  const { activeItems, isLoading, reminderNotice, storageError } = useInventory();

  /* This screen has no header or tab bar of its own to sit inside. */
  const insets = useSafeAreaInsets();

  /* So the sections and rows move on a day when the app is opened the next morning. */
  const today = useToday();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2f7d32" />
        <Text style={styles.loadingText}>Loading your inventory...</Text>
      </View>
    );
  }

  function renderSection({ item: section }: { item: InventorySection }) {
    return (
      <View>
        <Text style={[styles.sectionTitle, section.isUrgent ? styles.urgentTitle : null]}>
          {section.title.toUpperCase()}
        </Text>

        <View style={styles.sectionCard}>
          {section.items.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <InventoryRow item={item} today={today} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 124 },
        ]}
        data={buildInventorySections(activeItems, today)}
        keyExtractor={(section) => section.title}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>My Food Inventory</Text>

            <Text style={styles.subtitle}>{describeInventory(activeItems, today)}</Text>

            {storageError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="warning-outline" size={19} color="#8b2c25" />

                <Text style={styles.errorText}>{storageError}</Text>
              </View>
            ) : null}

            {reminderNotice ? (
              <View style={styles.reminderBanner}>
                <Ionicons name="notifications-off-outline" size={19} color="#8b6b1f" />

                <Text style={styles.reminderText}>{reminderNotice}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="basket-outline" size={34} color="#2f7d32" />
            </View>

            <Text style={styles.emptyTitle}>Your food list is empty</Text>

            <Text style={styles.emptyText}>
              Add what you just bought and the app keeps an eye on the use-by dates for you.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/scan')}
              style={({ pressed }) => [styles.emptyButton, pressed ? styles.pressedButton : null]}
            >
              <Text style={styles.emptyButtonText}>Scan your first item</Text>
            </Pressable>
          </View>
        }
        renderItem={renderSection}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f8f3',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f6f8f3',
  },
  loadingText: {
    color: '#59635b',
    fontSize: 15,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  title: {
    color: '#172019',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 5,
    color: '#59635b',
    fontSize: 15,
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#fde7e5',
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: '#8b2c25',
    fontSize: 13,
    lineHeight: 18,
  },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#fff0d5',
    padding: 12,
  },
  reminderText: {
    flex: 1,
    color: '#8b6b1f',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 10,
    color: '#687269',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  urgentTitle: {
    color: '#9f2420',
  },
  sectionCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  divider: {
    height: 1,
    marginLeft: 16,
    backgroundColor: '#eef1ed',
  },
  emptyCard: {
    alignItems: 'center',
    marginTop: 34,
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingHorizontal: 28,
    paddingVertical: 34,
  },
  emptyIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#e7f4e8',
  },
  emptyTitle: {
    marginTop: 16,
    color: '#172019',
    fontSize: 19,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 8,
    color: '#687269',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#2f7d32',
    borderRadius: 12,
    paddingHorizontal: 20,
  },
  emptyButtonText: {
    color: '#2f7d32',
    fontSize: 14,
    fontWeight: '700',
  },
  pressedButton: {
    opacity: 0.72,
  },
});
