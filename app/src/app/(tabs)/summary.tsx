import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInventory } from '@/context/inventory-context';
import type { FoodItem } from '@/types/food-item';

type WeeklyData = {
  week: string;
  eaten: number;
  donated: number;
  discarded: number;
};

function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  // Monday is the first day of the week.
  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);

  return result;
}

function getWeeklyData(items: FoodItem[], now: Date): WeeklyData[] {
  const currentWeekStart = getStartOfWeek(now);

  const weeks: WeeklyData[] = [
    { week: 'This week', eaten: 0, donated: 0, discarded: 0 },
    { week: 'Last week', eaten: 0, donated: 0, discarded: 0 },
    { week: '2 weeks ago', eaten: 0, donated: 0, discarded: 0 },
  ];

  for (const item of items) {
    // Active items have not been resolved and do not count as outcomes.
    if (item.status === 'active' || !item.statusUpdatedAt) {
      continue;
    }

    const outcomeDate = new Date(item.statusUpdatedAt);

    if (Number.isNaN(outcomeDate.getTime())) {
      continue;
    }

    // Find which of the three Monday-to-Monday weeks contains this outcome.
    const daysSinceCurrentWeek =
      currentWeekStart.getTime() - getStartOfWeek(outcomeDate).getTime();

    const weekIndex = Math.round(
      daysSinceCurrentWeek / (7 * 24 * 60 * 60 * 1000),
    );

    if (weekIndex < 0 || weekIndex >= weeks.length) {
      continue;
    }

    if (item.status === 'eaten') {
      weeks[weekIndex].eaten += 1;
    } else if (item.status === 'discarded') {
      weeks[weekIndex].discarded += 1;
    }
  }

  return weeks;
}

export default function WeeklySummaryScreen() {
  const insets = useSafeAreaInsets();
  const { items, isLoading, storageError } = useInventory();

  const weeklyData = useMemo(
    () => getWeeklyData(items, new Date()),
    [items],
  );

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 24,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#172019" />
        </Pressable>

        <Text style={styles.title}>Weekly Summary</Text>

        <Text style={styles.subtitle}>
          See what happened to your food each week.
        </Text>

        {isLoading ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageText}>
              Loading your food statistics...
            </Text>
          </View>
        ) : storageError ? (
          <View style={styles.messageCard}>
            <Ionicons
              name="alert-circle-outline"
              size={26}
              color="#9f2420"
            />
            <Text style={styles.messageText}>
              Your saved inventory could not be loaded. Please try again later.
            </Text>
          </View>
        ) : (
          weeklyData.map((week) => (
            <View key={week.week} style={styles.weekCard}>
              <Text style={styles.weekTitle}>{week.week}</Text>

              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Ionicons
                    name="restaurant-outline"
                    size={24}
                    color="#2f7d32"
                  />

                  <Text style={styles.statNumber}>{week.eaten}</Text>
                  <Text style={styles.statLabel}>Eaten</Text>
                </View>

                <View style={styles.stat}>
                  <Ionicons
                    name="heart-outline"
                    size={24}
                    color="#d28b27"
                  />

                  <Text style={styles.statNumber}>{week.donated}</Text>
                  <Text style={styles.statLabel}>Donated</Text>
                </View>

                <View style={styles.stat}>
                  <Ionicons
                    name="trash-outline"
                    size={24}
                    color="#9f2420"
                  />

                  <Text style={styles.statNumber}>{week.discarded}</Text>
                  <Text style={styles.statLabel}>Discarded</Text>
                </View>
              </View>
            </View>
          ))
        )}

        {!isLoading && !storageError && (
          <Text style={styles.note}>
            Counts are based on food items marked as eaten or discarded.
            Donation tracking is not available yet.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f8f3',
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  title: {
    color: '#172019',
    fontSize: 32,
    fontWeight: '800',
  },

  subtitle: {
    marginTop: 5,
    color: '#59635b',
    fontSize: 15,
    lineHeight: 22,
  },

  weekCard: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 18,
  },

  weekTitle: {
    color: '#172019',
    fontSize: 17,
    fontWeight: '700',
  },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },

  stat: {
    flex: 1,
    alignItems: 'center',
  },

  statNumber: {
    marginTop: 8,
    color: '#172019',
    fontSize: 24,
    fontWeight: '800',
  },

  statLabel: {
    marginTop: 2,
    color: '#687269',
    fontSize: 13,
  },

  messageCard: {
    marginTop: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 24,
  },

  messageText: {
    color: '#59635b',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },

  note: {
    marginTop: 16,
    marginBottom: 24,
    color: '#687269',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});