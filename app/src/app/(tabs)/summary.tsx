import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInventory } from '@/context/inventory-context';
import { getWeeklyData } from '@/utils/weekly-summary';

export default function WeeklySummaryScreen() {
  const insets = useSafeAreaInsets();
  const { items, isLoading, isStorageReady } = useInventory();

  /* Not memoised: the weeks must follow the clock, not only changes to the inventory. */
  const weeklyData = getWeeklyData(items, new Date());

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        /* The tab bar is drawn over the screen, so the last card must scroll clear of it. */
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 124 },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      testID="summary-scroll"
    >
      <Text style={styles.title}>Weekly Summary</Text>

      <Text style={styles.subtitle}>See what happened to your food each week.</Text>

      {isLoading ? (
        <View style={styles.messageCard}>
          <Text style={styles.messageText}>Loading your food statistics...</Text>
        </View>
      ) : !isStorageReady ? (
        <View style={styles.messageCard}>
          <Ionicons name="alert-circle-outline" size={26} color="#9f2420" />
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
                <Ionicons name="restaurant-outline" size={24} color="#2f7d32" />

                <Text style={styles.statNumber}>{week.eaten}</Text>
                <Text style={styles.statLabel}>Eaten</Text>
              </View>

              <View style={styles.stat}>
                <Ionicons name="heart-outline" size={24} color="#d28b27" />

                <Text style={styles.statNumber}>{week.donated}</Text>
                <Text style={styles.statLabel}>Donated</Text>
              </View>

              <View style={styles.stat}>
                <Ionicons name="trash-outline" size={24} color="#9f2420" />

                <Text style={styles.statNumber}>{week.discarded}</Text>
                <Text style={styles.statLabel}>Discarded</Text>
              </View>
            </View>
          </View>
        ))
      )}

      {!isLoading && isStorageReady && (
        <Text style={styles.note}>
          Counts are based on food items marked as eaten or discarded. Donation tracking is not
          available yet.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f8f3',
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
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
