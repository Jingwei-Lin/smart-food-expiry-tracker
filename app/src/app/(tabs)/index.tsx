import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InventoryRow } from '@/components/inventory-row';
import { useInventory } from '@/context/inventory-context';
import { useToday } from '@/hooks/use-today';
import { FoodItem, FoodStorageLocation } from '@/types/food-item';
import { daysUntilExpiry, EAT_SOON_DAYS } from '@/utils/expiry-date';

const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  divider: '#EEEFE5',
  accent: '#A6D45A',
  accentSoft: '#F0F7DB',
  urgent: '#A92E26',
  urgentSoft: '#FBEFF2',
  warning: '#8B6B1F',
  warningSoft: '#FFF0D5',
  error: '#8B2C25',
  errorSoft: '#FDE7E5',
};

const LOCATIONS: FoodStorageLocation[] = ['fridge', 'freezer', 'pantry'];

function getWeekDates(today: Date): Date[] {
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);

  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function describeInventory(items: FoodItem[], today: Date): string {
  if (items.length === 0) return 'Nothing tracked yet';

  const itemWord = items.length === 1 ? 'item' : 'items';
  const soonCount = items.filter((item) => {
    const days = daysUntilExpiry(item.expiryDate, today);
    return days >= 0 && days <= EAT_SOON_DAYS;
  }).length;

  if (soonCount === 0) return `${items.length} ${itemWord}`;

  return `${items.length} ${itemWord} · ${soonCount} to eat soon`;
}

function getLocationLabel(location: FoodStorageLocation): string {
  return location.charAt(0).toUpperCase() + location.slice(1);
}

export default function InventoryScreen() {
  const { activeItems, isLoading, isStorageReady, reminderNotice, storageError } = useInventory();

  const insets = useSafeAreaInsets();
  const today = useToday();

  const [selectedLocation, setSelectedLocation] = useState<FoodStorageLocation>('fridge');

  const weekDates = getWeekDates(today);

  /*
   * With the saved inventory unread, the empty list below would be a guess, and
   * its prompt to scan an item would invite food that cannot be saved.
   */
  const inventoryUnreadable = !isStorageReady;

  const locationItems = activeItems
    .filter((item) => item.storageLocation === selectedLocation)
    .sort((a, b) => daysUntilExpiry(a.expiryDate, today) - daysUntilExpiry(b.expiryDate, today));

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your inventory...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 124,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headingRow}>
            <View style={styles.headingText}>
              <Text style={styles.dateHeading}>
                {today.toLocaleDateString('en-AU', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>

              <Text style={styles.title}>What&apos;s in my fridge?</Text>
            </View>
          </View>

          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.weekStrip}
          >
            {weekDates.map((date) => {
              const isToday = date.toDateString() === today.toDateString();

              return (
                <View key={date.toISOString()} style={styles.weekDay}>
                  <Text style={[styles.weekDayLabel, isToday && styles.weekDayLabelToday]}>
                    {date.toLocaleDateString('en-AU', {
                      weekday: 'short',
                    })}
                  </Text>

                  <View style={[styles.dayCircle, isToday && styles.dayCircleToday]}>
                    <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
                      {date.getDate()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {inventoryUnreadable ? null : (
            <View style={styles.summaryRow}>
              <View style={styles.summaryTextRow}>
                <Ionicons name="checkbox-outline" size={25} color={COLORS.primary} />

                <Text style={styles.subtitle}>{describeInventory(locationItems, today)}</Text>
              </View>
            </View>
          )}

          {storageError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={19} color={COLORS.error} />

              <Text style={styles.errorText}>{storageError}</Text>
            </View>
          ) : null}

          {reminderNotice ? (
            <View style={styles.reminderBanner}>
              <Ionicons name="notifications-off-outline" size={19} color={COLORS.warning} />

              <Text style={styles.reminderText}>{reminderNotice}</Text>
            </View>
          ) : null}
        </View>

        {inventoryUnreadable ? null : (
          <View style={styles.fridgeArea}>
            <View style={styles.fridgeCard}>
              <View style={styles.locationTabs}>
                {LOCATIONS.map((location) => {
                  const selected = selectedLocation === location;
                  const count = activeItems.filter(
                    (item) => item.storageLocation === location,
                  ).length;

                  return (
                    <Pressable
                      key={location}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${getLocationLabel(location)}, ${count} ${count === 1 ? 'item' : 'items'}`}
                      onPress={() => setSelectedLocation(location)}
                      style={({ pressed }) => [
                        styles.locationTab,
                        selected && styles.locationTabSelected,
                        pressed && styles.locationTabPressed,
                      ]}
                    >
                      <Text
                        style={[styles.locationTabText, selected && styles.locationTabTextSelected]}
                      >
                        {getLocationLabel(location)}
                      </Text>

                      <Text
                        style={[styles.locationCount, selected && styles.locationTabTextSelected]}
                      >
                        {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.fridgeDivider} />

              {locationItems.length > 0 ? (
                <View style={styles.foodList}>
                  {locationItems.map((item, index) => (
                    <View key={item.id}>
                      {index > 0 ? <View style={styles.inventoryDivider} /> : null}

                      <InventoryRow item={item} today={today} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="basket-outline" size={34} color={COLORS.primary} />
                  </View>

                  <Text style={styles.emptyTitle}>Nothing in your {selectedLocation}</Text>

                  <Text style={styles.emptyText}>
                    Add food to your {selectedLocation} and the app will keep an eye on its use-by
                    dates for you.
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Scan a food item"
                    onPress={() => router.push('/scan')}
                    style={({ pressed }) => [styles.emptyButton, pressed && styles.pressedButton]}
                  >
                    <Ionicons name="scan-outline" size={18} color={COLORS.primary} />

                    <Text style={styles.emptyButtonText}>Scan a food item</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View pointerEvents="none" style={styles.fridgeFeet}>
              <View style={styles.fridgeFoot} />
              <View style={styles.fridgeFoot} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  headingRow: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingText: {
    flex: 1,
  },
  dateHeading: {
    marginBottom: 6,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 18,
  },
  title: {
    marginTop: 4,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 26,
    lineHeight: 34,
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  weekDayLabel: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
  },
  weekDayLabelToday: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
  },
  dayCircle: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
  },
  dayCircleToday: {
    borderWidth: 3,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.accentSoft,
  },
  dayNumber: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
  },
  dayNumberToday: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  summaryTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  subtitle: {
    flexShrink: 1,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  fridgeArea: {
    position: 'relative',
    marginBottom: 16,
    paddingBottom: 10,
  },
  fridgeCard: {
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: COLORS.primary,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
  },
  locationTabs: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  locationTab: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 24,
    paddingHorizontal: 3,
  },
  locationTabSelected: {
    backgroundColor: COLORS.primary,
  },
  locationTabPressed: {
    opacity: 0.75,
  },
  locationTabText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
  },
  locationTabTextSelected: {
    color: COLORS.surface,
  },
  locationCount: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
  },
  fridgeDivider: {
    height: 3,
    backgroundColor: COLORS.primary,
  },
  foodList: {
    backgroundColor: COLORS.surface,
    paddingBottom: 12,
  },
  inventoryDivider: {
    height: 1,
    marginLeft: 70,
    backgroundColor: COLORS.divider,
  },
  fridgeFeet: {
    position: 'absolute',
    bottom: 0,
    left: '8%',
    right: '8%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  fridgeFoot: {
    width: 40,
    height: 12,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    backgroundColor: COLORS.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: COLORS.errorSoft,
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: COLORS.warningSoft,
    padding: 12,
  },
  reminderText: {
    flex: 1,
    color: COLORS.warning,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 28,
    backgroundColor: COLORS.surface,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: COLORS.accentSoft,
  },
  emptyTitle: {
    marginTop: 14,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 19,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 24,
    paddingHorizontal: 18,
  },
  emptyButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
  },
  pressedButton: {
    opacity: 0.72,
  },
});
