import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useInventory } from '@/context/inventory-context';
import { FoodItem } from '@/types/food-item';

export default function InventoryScreen() {
  const { items, isLoading, storageError } = useInventory();

  function renderInventoryItem({ item }: { item: FoodItem }) {
    return (
      <View style={styles.itemCard}>
        <View style={styles.itemIcon}>
          <Ionicons name="nutrition-outline" size={24} color="#2f7d32" />
        </View>

        <View style={styles.itemInformation}>
          <Text style={styles.itemName}>{item.name}</Text>

          <Text style={styles.itemDetail}>Quantity: {item.quantity}</Text>

          <Text style={styles.itemDetail}>Expiry date: {item.expiryDate}</Text>

          {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2f7d32" />
        <Text style={styles.loadingText}>Loading your inventory...</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.listContent}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          <Text style={styles.eyebrow}>SMART PANTRY</Text>
          <Text style={styles.title}>My food</Text>

          <Text style={styles.subtitle}>
            {items.length === 0
              ? 'Add your first grocery item to begin tracking it.'
              : `${items.length} ${items.length === 1 ? 'item' : 'items'} saved on this device.`}
          </Text>

          {storageError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={19} color="#8b2c25" />

              <Text style={styles.errorText}>{storageError}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/add')}
            style={({ pressed }) => [
              styles.addButton,
              pressed ? styles.pressedButton : null,
            ]}
          >
            <Ionicons name="add" size={21} color="#ffffff" />
            <Text style={styles.addButtonText}>Add grocery item</Text>
          </Pressable>

          {items.length > 0 ? <Text style={styles.sectionTitle}>SAVED ITEMS</Text> : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="basket-outline" size={34} color="#2f7d32" />
          </View>

          <Text style={styles.emptyTitle}>Your inventory is empty</Text>

          <Text style={styles.emptyText}>
            Add a grocery item manually to start tracking its expiry date.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/add')}
            style={({ pressed }) => [
              styles.emptyButton,
              pressed ? styles.pressedButton : null,
            ]}
          >
            <Text style={styles.emptyButtonText}>Add your first item</Text>
          </Pressable>
        </View>
      }
      renderItem={renderInventoryItem}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#f6f8f3',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  eyebrow: {
    color: '#2f7d32',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 6,
    color: '#172019',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 7,
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
  addButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    borderRadius: 14,
    backgroundColor: '#2f7d32',
    paddingHorizontal: 18,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 10,
    color: '#687269',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  itemIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#e7f4e8',
  },
  itemInformation: {
    flex: 1,
  },
  itemName: {
    color: '#172019',
    fontSize: 18,
    fontWeight: '700',
  },
  itemDetail: {
    marginTop: 5,
    color: '#59635b',
    fontSize: 13,
  },
  itemNotes: {
    marginTop: 8,
    color: '#718075',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
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
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#2f7d32',
    borderRadius: 12,
    paddingHorizontal: 18,
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