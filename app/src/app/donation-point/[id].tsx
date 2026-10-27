import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInventory } from '@/context/inventory-context';
import bundledSnapshot from '@/data/donation-points-au.json';
import { useToday } from '@/hooks/use-today';
import type { FoodItem } from '@/types/food-item';
import { TYPE_LOOK } from '@/utils/donation-look';
import { parseSnapshot } from '@/utils/donation-snapshot';
import { joinNames } from '@/utils/expired-warnings';
import { daysUntilExpiry } from '@/utils/expiry-date';
import { getFoodIcon } from '@/utils/food-icon';
import { goBackOr } from '@/utils/navigation';
import { openStatus, parseOpeningHours, weekRows } from '@/utils/opening-hours';
import { type DonationPoint, toDonationPoint } from '@/utils/overpass';

const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  divider: '#EEEFE5',
  accent: '#A6D45A',
  accentSoft: '#F0F7DB',
  link: '#4E7A1F',
  urgent: '#A92E26',
  urgentSoft: '#FBEFF2',
  warning: '#8B6B1F',
  warningSoft: '#FFF0D5',
};

const SNAPSHOT = parseSnapshot(bundledSnapshot);

type DetailParams = {
  /** The OpenStreetMap id with a dash, e.g. "node-123", since a slash would split the route. */
  id: string;
  /** How far away the list said it was, so both screens show the same number. */
  distanceKm?: string;
  /** The address the list showed, which may have come from the phone's geocoder. */
  address?: string;
};

type FoundPoint = {
  point: DonationPoint;
  /** The opening hours as OpenStreetMap writes them, e.g. "Mo-Fr 09:00-15:00". */
  openingHours: string | null;
};

/** Finds the place in the bundled list from the id in the route. */
function findPoint(routeId: string): FoundPoint | null {
  if (!SNAPSHOT) {
    return null;
  }

  const element = SNAPSHOT.elements.find(
    (candidate) => `${candidate.type}-${candidate.id}` === routeId,
  );

  // The distance comes from the list, so where it is measured from doesn't matter here.
  const point = element ? toDonationPoint(element, 0, 0) : null;

  if (!element || !point) {
    return null;
  }

  return { point, openingHours: element.tags?.opening_hours ?? null };
}

/** Opens the phone's maps app with directions to the place. */
function openDirections(point: DonationPoint) {
  const destination = `${point.latitude},${point.longitude}`;
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${destination}&q=${encodeURIComponent(point.name)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

  void Linking.openURL(url).catch(() => undefined);
}

/** "Address not listed" and "Looking up address…" are placeholders, not addresses. */
function realAddress(address: string | undefined): string {
  if (!address || address === 'Address not listed' || address.endsWith('…')) {
    return '';
  }

  return address;
}

/** "Today", "1 day", "5 days", coloured like the inventory's expiry badges. */
function expiryBadge(days: number): { label: string; background: string; color: string } {
  if (days === 0) {
    return { label: 'Today', background: COLORS.primary, color: COLORS.surface };
  }

  const label = `${days} ${days === 1 ? 'day' : 'days'}`;

  if (days <= 3) {
    return { label, background: COLORS.urgentSoft, color: COLORS.urgent };
  }

  if (days <= 7) {
    return { label, background: COLORS.warningSoft, color: COLORS.warning };
  }

  return { label, background: COLORS.divider, color: COLORS.secondary };
}

type FridgeTileProps = {
  item: FoodItem;
  days: number;
  checked: boolean;
  onToggle: () => void;
};

/** One item from the inventory the student can tick to bring along. */
function FridgeTile({ item, days, checked, onToggle }: FridgeTileProps) {
  const badge = expiryBadge(days);

  return (
    <Pressable
      accessibilityLabel={`${item.name}, ${days === 0 ? 'expires today' : `${badge.label} left`}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.tile,
        checked ? styles.tileChecked : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
        {checked ? <Ionicons color={COLORS.surface} name="checkmark" size={16} /> : null}
      </View>

      <Text numberOfLines={1} style={styles.tileName}>
        {item.name}
      </Text>

      <Ionicons color={COLORS.primary} name={getFoodIcon(item.name)} size={34} />

      <View style={[styles.tileBadge, { backgroundColor: badge.background }]}>
        <Text style={[styles.tileBadgeText, { color: badge.color }]}>{badge.label}</Text>
      </View>
    </Pressable>
  );
}

const goBack = () => goBackOr('/donation-points');

/**
 * One donation point: what kind of place it is, how far away, its hours,
 * directions, and the food to bring, which is marked as donated from here.
 */
export default function DonationPointScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<DetailParams>();
  const found = findPoint(params.id);
  /* When the screen opened, for "Open now". A lazy initial value, so it isn't read on every render. */
  const [now] = useState(() => new Date());
  const today = useToday();
  const { activeItems, resolveItem } = useInventory();
  /* The ids of the items ticked to bring. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDonating, setIsDonating] = useState(false);
  const [donateError, setDonateError] = useState<string | null>(null);
  /* The names just marked as donated, for the thank-you message; null until then. */
  const [donatedNames, setDonatedNames] = useState<string[] | null>(null);

  if (!found) {
    return (
      <View style={[styles.screen, styles.missing, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.missingTitle}>This place isn&apos;t in the list any more</Text>
        <Text style={styles.missingText}>Go back and pick another donation point.</Text>

        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.missingButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.missingButtonText}>Back to donation points</Text>
        </Pressable>
      </View>
    );
  }

  const { point, openingHours } = found;
  const look = TYPE_LOOK[point.type];
  const address = realAddress(params.address) || point.address;
  const distance = params.distanceKm ? `${params.distanceKm} km away` : null;

  /* Null when there are no hours, or they're written in a way the table can't show. */
  const week = openingHours ? parseOpeningHours(openingHours) : null;
  const status = week ? openStatus(week, now) : null;
  const heroDetail = [status?.detail, distance].filter(Boolean).join(' · ');

  /*
   * Every item still in date, soonest first, since that is what's most worth
   * giving away. All of it is offered: this page is the only place food is
   * marked as donated, so "Donate it" on any item must lead to that item here.
   * Food that has already expired is left out: a food bank can't take it.
   */
  const offered = activeItems
    .map((item) => ({ item, days: daysUntilExpiry(item.expiryDate, today) }))
    .filter(({ days }) => Number.isFinite(days) && days >= 0)
    .sort((a, b) => a.days - b.days);

  /* Only ticked items still on offer count, in case one was eaten on another screen. */
  const chosen = offered
    .filter(({ item }) => selectedIds.includes(item.id))
    .map(({ item }) => item);

  function toggle(id: string) {
    setDonateError(null);
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id],
    );
  }

  /** Moves the ticked items out of the inventory as donated, which the weekly summary counts. */
  async function donate() {
    if (chosen.length === 0 || isDonating) {
      return;
    }

    setIsDonating(true);
    setDonateError(null);

    try {
      // One at a time, since each save writes the whole inventory.
      for (const item of chosen) {
        await resolveItem(item.id, 'donated');
      }

      setDonatedNames(chosen.map((item) => item.name));
      setSelectedIds([]);
    } catch {
      setDonateError("Some items couldn't be marked as donated. Please try again.");
    } finally {
      setIsDonating(false);
    }
  }

  const donateLabel =
    chosen.length === 0
      ? 'Mark food to bring'
      : `Mark ${chosen.length} ${chosen.length === 1 ? 'item' : 'items'} as donated`;

  function share() {
    const where = `https://maps.apple.com/?q=${encodeURIComponent(point.name)}&ll=${point.latitude},${point.longitude}`;

    void Share.share({
      message: [point.name, address, where].filter(Boolean).join('\n'),
    }).catch(() => undefined);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: tinted like the place's icon tile on the list */}
        <View style={[styles.hero, { backgroundColor: look.tint, paddingTop: insets.top + 12 }]}>
          <Ionicons color={look.accent} name={look.icon} size={190} style={styles.heroArt} />

          <View style={styles.heroButtons}>
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              hitSlop={8}
              onPress={goBack}
              style={({ pressed }) => [styles.roundButton, pressed ? styles.pressed : null]}
            >
              <Ionicons color={COLORS.primary} name="chevron-back" size={24} />
            </Pressable>

            <Pressable
              accessibilityLabel={`Share ${point.name}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={share}
              style={({ pressed }) => [styles.roundButton, pressed ? styles.pressed : null]}
            >
              <Ionicons color={COLORS.primary} name="share-outline" size={22} />
            </Pressable>
          </View>

          <View style={styles.typePill}>
            <Text style={[styles.typePillText, { color: look.accent }]}>{point.type}</Text>
          </View>

          <Text accessibilityRole="header" style={styles.name}>
            {point.name}
          </Text>

          <View style={styles.heroMetaRow}>
            {status ? (
              <>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: status.isOpen ? COLORS.link : COLORS.secondary },
                  ]}
                />
                <Text style={[styles.statusLabel, status.isOpen ? null : styles.statusClosed]}>
                  {status.label}
                </Text>
              </>
            ) : null}

            {heroDetail ? (
              <Text style={styles.heroMeta}>{status ? ` · ${heroDetail}` : heroDetail}</Text>
            ) : null}
          </View>
        </View>

        {/* Directions */}
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel={`Directions to ${point.name}`}
            accessibilityRole="button"
            onPress={() => openDirections(point)}
            style={({ pressed }) => [styles.directionsButton, pressed ? styles.pressed : null]}
          >
            <Ionicons color={COLORS.surface} name="navigate" size={18} />
            <Text style={styles.directionsText}>Directions</Text>
          </Pressable>
        </View>

        {/* Address and opening hours */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons color={COLORS.secondary} name="location-outline" size={22} />
            <Text style={styles.infoText}>{address || 'Address not listed'}</Text>
          </View>

          <View style={[styles.infoRow, styles.infoDivider]}>
            <Ionicons color={COLORS.secondary} name="time-outline" size={22} />

            {week ? (
              <View style={styles.hoursTable}>
                {weekRows(week, now).map((row) => (
                  <View key={row.days} style={styles.hoursRow}>
                    <Text style={[styles.hoursDays, row.isToday ? styles.hoursToday : null]}>
                      {row.isToday ? `${row.days} (today)` : row.days}
                    </Text>
                    <Text style={[styles.hoursTime, row.isToday ? styles.hoursToday : null]}>
                      {row.hours}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.infoText}>{point.hours}</Text>
            )}
          </View>
        </View>

        {/* What to bring */}
        <View style={styles.bringSection}>
          <View style={styles.bringHeading}>
            <Text style={styles.sectionTitle}>FOOD TO BRING</Text>
            {offered.length > 0 ? <Text style={styles.bringHint}>Expiring soonest</Text> : null}
          </View>

          {offered.length > 0 ? (
            <View style={styles.tiles}>
              {offered.map(({ item, days }) => (
                <FridgeTile
                  key={item.id}
                  checked={selectedIds.includes(item.id)}
                  days={days}
                  item={item}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.bringEmpty}>
              None of your food is still in date to bring. Add food with the + button.
            </Text>
          )}
        </View>

        <Text style={styles.footnote}>
          OpenStreetMap doesn&apos;t list what each place accepts, so check with the place before
          bringing fresh or chilled food. Data © OpenStreetMap contributors.
        </Text>
      </ScrollView>

      {/* Fixed to the bottom: the donate button, or a thank-you once it's done */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {donatedNames ? (
          <View style={styles.thanks}>
            <Ionicons color={COLORS.link} name="checkmark-circle" size={26} />

            <Text style={styles.thanksText}>
              Thank you! {joinNames(donatedNames)} {donatedNames.length === 1 ? 'is' : 'are'} marked
              as donated.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={goBack}
              style={({ pressed }) => [styles.doneButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {donateError ? <Text style={styles.donateError}>{donateError}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: chosen.length === 0, busy: isDonating }}
              disabled={chosen.length === 0 || isDonating}
              onPress={() => void donate()}
              style={({ pressed }) => [
                styles.donateButton,
                chosen.length === 0 ? styles.donateButtonDisabled : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text
                style={[styles.donateText, chosen.length === 0 ? styles.donateTextDisabled : null]}
              >
                {isDonating ? 'Saving…' : donateLabel}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pressed: {
    opacity: 0.72,
  },

  /* Hero */
  hero: {
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroArt: {
    position: 'absolute',
    right: -28,
    bottom: -36,
    opacity: 0.14,
  },
  heroButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  roundButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
  },
  typePill: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
  },
  typePillText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
  },
  name: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 28,
    lineHeight: 34,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    marginRight: 6,
    borderRadius: 4,
  },
  statusLabel: {
    color: COLORS.link,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  statusClosed: {
    color: COLORS.secondary,
  },
  heroMeta: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
  },

  /* Directions */
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  directionsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  directionsText: {
    color: COLORS.surface,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
  },

  /* Address and opening hours */
  infoCard: {
    marginTop: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  infoText: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  hoursTable: {
    flex: 1,
    gap: 8,
  },
  hoursRow: {
    flexDirection: 'row',
  },
  hoursDays: {
    flex: 1,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
  },
  hoursTime: {
    flex: 1,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
  },
  hoursToday: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
  },

  /* What to bring */
  bringSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  bringHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    letterSpacing: 0.9,
  },
  bringHint: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
  },
  bringEmpty: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  tile: {
    alignItems: 'center',
    gap: 8,
    width: '32%',
    paddingTop: 30,
    paddingBottom: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  tileChecked: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 7,
    backgroundColor: COLORS.surface,
  },
  checkboxChecked: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  tileName: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
  },
  tileBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tileBadgeText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
  },
  footnote: {
    marginTop: 16,
    paddingHorizontal: 20,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
    lineHeight: 17,
  },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.background,
  },
  donateButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
  },
  donateButtonDisabled: {
    backgroundColor: COLORS.divider,
  },
  donateText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
  },
  donateTextDisabled: {
    color: COLORS.secondary,
  },
  donateError: {
    marginBottom: 8,
    color: COLORS.urgent,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  thanks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
  },
  thanksText: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
    lineHeight: 20,
  },
  doneButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  doneText: {
    color: COLORS.surface,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },

  /* Shown when the place can't be found */
  missing: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  missingTitle: {
    marginTop: 80,
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    textAlign: 'center',
  },
  missingText: {
    marginTop: 8,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    textAlign: 'center',
  },
  missingButton: {
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 24,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  missingButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
});
