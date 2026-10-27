import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { useInventory } from '@/context/inventory-context';
import { useToday } from '@/hooks/use-today';
import { toExpiryDateString } from '@/utils/expiry-date';
import {
  DayOutcomes,
  getDiscardedItems,
  getStartOfWeek,
  getSummaryDays,
  SummaryPeriod,
  sumOutcomes,
} from '@/utils/weekly-summary';

const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  divider: '#EEEFE5',
  accent: '#A6D45A',
  accentSoft: '#F0F7DB',
  donated: '#55614D',
  discarded: '#FFC0D2',
  discardedSoft: '#FFF1F5',
  error: '#8B2C25',
};

/*
 * A month can hold many thrown-out items, and a long list would push the
 * note below it out of sight, so the rest wait behind a "Show" button.
 */
const MAX_DISCARDED_SHOWN = 10;

function describeDay(day: DayOutcomes, dayName: string): string {
  const { eaten, donated, discarded } = day;

  if (eaten + donated + discarded === 0) {
    return `${dayName}, nothing recorded`;
  }

  const counts = [`${eaten} eaten`];

  if (donated > 0) counts.push(`${donated} donated`);
  counts.push(`${discarded} thrown out`);

  return `${dayName}, ${counts.join(', ')}`;
}

function getPeriodLabel(today: Date, period: SummaryPeriod): string {
  if (period === 'month') {
    return today.toLocaleDateString('en-AU', {
      month: 'long',
      year: 'numeric',
    });
  }

  const monday = getStartOfWeek(today);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startLabel = monday.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });

  const endLabel = sunday.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });

  return `${startLabel}–${endLabel}`;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

export default function WeeklySummaryScreen() {
  const insets = useSafeAreaInsets();
  const { items, isLoading, isStorageReady } = useInventory();
  const today = useToday();
  const [period, setPeriod] = useState<SummaryPeriod>('week');
  const [showAllDiscarded, setShowAllDiscarded] = useState(false);

  const days = getSummaryDays(items, today, period);
  const todayKey = toExpiryDateString(today);
  const totals = sumOutcomes(days);

  const saved = totals.eaten + totals.donated;
  const resolved = saved + totals.discarded;

  const maxBarValue = Math.max(1, ...days.map((day) => day.eaten + day.donated + day.discarded));

  const discardedItems = getDiscardedItems(items, days);
  const extraDiscardedCount = Math.max(0, discardedItems.length - MAX_DISCARDED_SHOWN);
  const shownDiscardedItems = showAllDiscarded
    ? discardedItems
    : discardedItems.slice(0, MAX_DISCARDED_SHOWN);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 124,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        subtitle={`${period === 'week' ? 'This week' : 'This month'} · ${getPeriodLabel(today, period)}`}
        title="Waste summary"
      />

      <View style={styles.periodSwitch}>
        {(['week', 'month'] as const).map((option) => {
          const selected = period === option;

          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={option === 'week' ? 'Show this week' : 'Show this month'}
              accessibilityState={{ selected }}
              onPress={() => setPeriod(option)}
              style={[styles.periodOption, selected && styles.periodOptionSelected]}
            >
              <Text style={[styles.periodOptionText, selected && styles.periodOptionTextSelected]}>
                {option === 'week' ? 'Week' : 'Month'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.messageCard}>
          <Text style={styles.messageText}>Loading your food statistics...</Text>
        </View>
      ) : !isStorageReady ? (
        <View style={styles.messageCard}>
          <Ionicons name="alert-circle-outline" size={26} color={COLORS.error} />
          <Text style={styles.messageText}>
            Your saved inventory could not be loaded. Please try again later.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.overviewCard}>
            <View style={styles.savedHeading}>
              <Text style={styles.savedNumber}>{saved}</Text>
              <Text style={styles.savedDescription}>of {resolved} items saved</Text>
            </View>

            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.progressTrack}
            >
              {resolved > 0 ? (
                <>
                  {totals.eaten > 0 && (
                    <View
                      style={[
                        styles.progressSegment,
                        {
                          flex: totals.eaten,
                          backgroundColor: COLORS.accent,
                        },
                      ]}
                    />
                  )}

                  {totals.donated > 0 && (
                    <View
                      style={[
                        styles.progressSegment,
                        {
                          flex: totals.donated,
                          backgroundColor: COLORS.donated,
                        },
                      ]}
                    />
                  )}

                  {totals.discarded > 0 && (
                    <View
                      style={[
                        styles.progressSegment,
                        {
                          flex: totals.discarded,
                          backgroundColor: COLORS.discarded,
                        },
                      ]}
                    />
                  )}
                </>
              ) : (
                <View style={styles.progressEmpty} />
              )}
            </View>

            <View style={styles.totalsRow}>
              <View style={styles.totalColumn}>
                <LegendItem color={COLORS.accent} label="Eaten" />
                <Text style={styles.totalNumber}>{totals.eaten}</Text>
              </View>

              <View style={styles.totalColumn}>
                <LegendItem color={COLORS.donated} label="Donated" />
                <Text style={styles.totalNumber}>{totals.donated}</Text>
              </View>

              <View style={styles.totalColumn}>
                <LegendItem color={COLORS.discarded} label="Thrown out" />
                <Text style={styles.totalNumber}>{totals.discarded}</Text>
              </View>
            </View>
          </View>

          {period === 'week' && (
            <>
              <Text style={styles.sectionHeading}>DAY BY DAY</Text>

              <View style={styles.chartCard}>
                <View style={styles.chart}>
                  {days.map((day) => {
                    const isToday = day.key === todayKey;
                    const dayName = day.date.toLocaleDateString('en-AU', { weekday: 'short' });
                    const total = day.eaten + day.donated + day.discarded;

                    const chartHeight = total === 0 ? 2 : Math.max(8, (total / maxBarValue) * 112);

                    return (
                      <View
                        key={day.key}
                        accessible
                        accessibilityLabel={describeDay(day, dayName)}
                        style={styles.chartColumn}
                      >
                        <View
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                          style={[styles.barStack, { height: chartHeight }]}
                        >
                          {day.discarded > 0 && (
                            <View
                              style={[
                                styles.barSegment,
                                {
                                  flex: day.discarded,
                                  backgroundColor: COLORS.discarded,
                                },
                              ]}
                            />
                          )}

                          {day.donated > 0 && (
                            <View
                              style={[
                                styles.barSegment,
                                {
                                  flex: day.donated,
                                  backgroundColor: COLORS.donated,
                                },
                              ]}
                            />
                          )}

                          {day.eaten > 0 && (
                            <View
                              style={[
                                styles.barSegment,
                                {
                                  flex: day.eaten,
                                  backgroundColor: COLORS.accent,
                                },
                              ]}
                            />
                          )}
                        </View>

                        <Text
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                          style={[styles.chartLabel, isToday && styles.chartLabelToday]}
                        >
                          {dayName}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.chartLegend}
                >
                  <LegendItem color={COLORS.accent} label="Eaten" />
                  <LegendItem color={COLORS.donated} label="Donated" />
                  <LegendItem color={COLORS.discarded} label="Thrown out" />
                </View>
              </View>
            </>
          )}

          <Text style={styles.sectionHeading}>THROWN OUT</Text>

          {discardedItems.length === 0 ? (
            <View style={styles.emptyWasteCard}>
              <Ionicons name="leaf-outline" size={28} color={COLORS.secondary} />

              <Text style={styles.emptyWasteTitle}>No food thrown out</Text>

              <Text style={styles.emptyWasteText}>
                Food you mark as thrown out during this period will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.discardedCard}>
              {shownDiscardedItems.map((item, index) => (
                <View key={item.id}>
                  {index > 0 && <View style={styles.itemDivider} />}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View details for ${item.name}`}
                    onPress={() =>
                      router.push({
                        pathname: '/item/[id]',
                        params: { id: item.id },
                      })
                    }
                    style={({ pressed }) => [
                      styles.discardedRow,
                      pressed && styles.discardedRowPressed,
                    ]}
                  >
                    <View style={styles.discardedIcon}>
                      <Ionicons name="nutrition-outline" size={24} color={COLORS.primary} />
                    </View>

                    <View style={styles.discardedInfo}>
                      <Text style={styles.discardedName}>{item.name}</Text>

                      <Text style={styles.discardedDate}>
                        {new Date(item.statusUpdatedAt!).toLocaleDateString('en-AU', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
                  </Pressable>
                </View>
              ))}

              {extraDiscardedCount > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showAllDiscarded
                      ? 'Show fewer thrown-out items'
                      : `Show ${extraDiscardedCount} more thrown out`
                  }
                  onPress={() => setShowAllDiscarded((current) => !current)}
                  style={({ pressed }) => [
                    styles.discardedMore,
                    pressed && styles.discardedRowPressed,
                  ]}
                >
                  <Text style={styles.discardedMoreText}>
                    {showAllDiscarded ? 'Show fewer' : `Show ${extraDiscardedCount} more`}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          <Text style={styles.note}>
            Counts reflect each item&apos;s most recently recorded outcome.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },

  // Period selector
  periodSwitch: {
    flexDirection: 'row',
    marginTop: 0,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
  },
  periodOption: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    paddingHorizontal: 12,
  },
  periodOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  periodOptionText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
  },
  periodOptionTextSelected: {
    color: COLORS.surface,
    fontFamily: 'Fredoka_600SemiBold',
  },

  // Overview
  overviewCard: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 30,
    backgroundColor: COLORS.accentSoft,
    padding: 20,
  },
  savedHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  savedNumber: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_700Bold',
    fontSize: 42,
    lineHeight: 50,
  },
  savedDescription: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  progressTrack: {
    height: 10,
    flexDirection: 'row',
    gap: 3,
    overflow: 'hidden',
    marginTop: 14,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
  },
  progressSegment: {
    minWidth: 3,
  },
  progressEmpty: {
    flex: 1,
    backgroundColor: COLORS.border,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 18,
  },
  totalColumn: {
    flex: 1,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    flexShrink: 1,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  totalNumber: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 21,
    lineHeight: 28,
  },

  // Section headings
  sectionHeading: {
    marginTop: 24,
    marginBottom: 16,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    letterSpacing: 0.8,
  },

  // Weekly chart
  chartCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
    padding: 16,
  },
  chart: {
    minHeight: 140,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 5,
    paddingTop: 8,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  barStack: {
    width: '100%',
    maxWidth: 44,
    minHeight: 2,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: COLORS.divider,
  },
  barSegment: {
    minHeight: 0,
  },
  chartLabel: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
  },
  chartLabelToday: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },

  // Empty state
  emptyWasteCard: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  emptyWasteTitle: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 19,
    textAlign: 'center',
  },
  emptyWasteText: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },

  // Discarded food
  discardedCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
  },
  discardedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  discardedRowPressed: {
    opacity: 0.7,
  },
  discardedIcon: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: COLORS.discardedSoft,
  },
  discardedInfo: {
    flex: 1,
    gap: 4,
  },
  discardedName: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
  },
  discardedDate: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  discardedMore: {
    justifyContent: 'center',
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingVertical: 12,
  },
  discardedMoreText: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  itemDivider: {
    height: 1,
    marginLeft: 70,
    backgroundColor: COLORS.divider,
  },

  // Messages and notes
  messageCard: {
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    padding: 18,
  },
  messageText: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  note: {
    marginTop: 16,
    marginBottom: 24,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
