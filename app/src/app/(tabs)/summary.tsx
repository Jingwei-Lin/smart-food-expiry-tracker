import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type WeeklyData = {
  week: string;
  eaten: number;
  donated: number;
  discarded: number;
};

const weeklyData: WeeklyData[] = [
  {
    week: 'This week',
    eaten: 8,
    donated: 3,
    discarded: 2,
  },
  {
    week: 'Last week',
    eaten: 6,
    donated: 2,
    discarded: 4,
  },
  {
    week: '2 weeks ago',
    eaten: 5,
    donated: 1,
    discarded: 3,
  },
];

export default function WeeklySummaryScreen() {
  const insets = useSafeAreaInsets();

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
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#172019" />
        </Pressable>

        <Text style={styles.title}>Weekly Summary</Text>

        <Text style={styles.subtitle}>
          See what happened to your food each week.
        </Text>

        {weeklyData.map((week) => (
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
        ))}
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
});