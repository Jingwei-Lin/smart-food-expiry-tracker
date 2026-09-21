import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = keyof typeof Ionicons.glyphMap;

type PointType = 'Food bank' | 'Grocery store' | 'Restaurant' | 'Shelter';

type DonationPoint = {
  id: string;
  name: string;
  type: PointType;
  distanceKm: number;
  hours: string;
  accepts: string;
  closingSoon: boolean;
};

/*
 * Sample data until there is a real source for donation points. Every place
 * here is made up: edit, add or remove entries freely.
 */
const DONATION_POINTS: DonationPoint[] = [
  {
    id: 'riverside-food-bank',
    name: 'Riverside Food Bank',
    type: 'Food bank',
    distanceKm: 0.8,
    hours: 'Open today 9:00 AM - 5:00 PM',
    accepts: 'Canned goods, dry goods, produce',
    closingSoon: false,
  },
  {
    id: 'corner-market-fresh',
    name: 'Corner Market Fresh',
    type: 'Grocery store',
    distanceKm: 1.2,
    hours: 'Open today 8:00 AM - 8:00 PM',
    accepts: 'Fresh produce, bread',
    closingSoon: false,
  },
  {
    id: 'hope-house-shelter',
    name: 'Hope House Shelter',
    type: 'Shelter',
    distanceKm: 1.9,
    hours: 'Open today 10:00 AM - 6:00 PM',
    accepts: 'Cooked meals, packaged food',
    closingSoon: true,
  },
  {
    id: 'harbour-street-kitchen',
    name: 'Harbour Street Kitchen',
    type: 'Restaurant',
    distanceKm: 2.4,
    hours: 'Open today 11:00 AM - 3:00 PM',
    accepts: 'Fresh produce, dairy',
    closingSoon: true,
  },
  {
    id: 'fair-go-community-pantry',
    name: 'Fair Go Community Pantry',
    type: 'Food bank',
    distanceKm: 3.1,
    hours: 'Open today 9:00 AM - 1:00 PM',
    accepts: 'Canned goods, pasta, rice',
    closingSoon: true,
  },
  {
    id: 'green-basket-grocer',
    name: 'Green Basket Grocer',
    type: 'Grocery store',
    distanceKm: 3.6,
    hours: 'Open today 7:00 AM - 9:00 PM',
    accepts: 'Produce, dairy, pantry staples',
    closingSoon: false,
  },
];

/* Each kind of place gets its own tint and icon, in place of a photo. */
const TYPE_LOOK: Record<PointType, { icon: IconName; tint: string; accent: string }> = {
  'Food bank': { icon: 'basket-outline', tint: '#e7f4e8', accent: '#2f7d32' },
  'Grocery store': { icon: 'cart-outline', tint: '#fbf0dc', accent: '#9a5b12' },
  Restaurant: { icon: 'restaurant-outline', tint: '#eaeedb', accent: '#5b6f1f' },
  Shelter: { icon: 'people-outline', tint: '#e2eee9', accent: '#2c6b57' },
};

const CARD_WIDTH = 290;
const CARD_GAP = 14;

function initials(name: string): string {
  return name
    .split(' ')
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

type DonationPointCardProps = {
  point: DonationPoint;
  saved: boolean;
  onToggleSaved: () => void;
};

function DonationPointCard({ point, saved, onToggleSaved }: DonationPointCardProps) {
  const look = TYPE_LOOK[point.type];

  return (
    <View style={styles.card}>
      <View style={[styles.cardHeader, { backgroundColor: look.tint }]}>
        <View pointerEvents="none" style={styles.watermark}>
          <Ionicons name={look.icon} size={96} color={look.accent} />
        </View>

        <View style={styles.cardHeaderTop}>
          <View style={styles.typePill}>
            <Text style={[styles.typePillText, { color: look.accent }]}>{point.type}</Text>
          </View>

          <Pressable
            accessibilityLabel={saved ? `Unsave ${point.name}` : `Save ${point.name}`}
            accessibilityRole="button"
            accessibilityState={{ selected: saved }}
            onPress={onToggleSaved}
            style={({ pressed }) => [styles.heartButton, pressed ? styles.pressed : null]}
          >
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={18}
              color={saved ? '#9f2420' : '#172019'}
            />
          </Pressable>
        </View>

        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: look.accent }]}>
            <Text style={styles.avatarText}>{initials(point.name)}</Text>
          </View>

          <Text numberOfLines={2} style={styles.cardName}>
            {point.name}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.accepts}>
          <Text style={styles.acceptsLabel}>Accepts: </Text>
          {point.accepts}
        </Text>

        <Text style={styles.hours}>{point.hours}</Text>

        <View style={styles.footer}>
          <View
            style={[styles.statusPill, point.closingSoon ? styles.closingPill : styles.openPill]}
          >
            <View
              style={[styles.statusDot, point.closingSoon ? styles.closingDot : styles.openDot]}
            />

            <Text
              style={[styles.statusText, point.closingSoon ? styles.closingText : styles.openText]}
            >
              {point.closingSoon ? 'Closing soon' : 'Open now'}
            </Text>
          </View>

          <Text style={styles.distance}>{point.distanceKm.toFixed(1)} km</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Donation points tab: places where spare food can be dropped off.
 *
 * The location line and the list are sample data for now. Search narrows the
 * list by name, kind of place or what they accept, and the heart keeps a place
 * saved until the app is closed.
 */
export default function DonationPointsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const search = query.trim().toLowerCase();
  const matches = DONATION_POINTS.filter((point) =>
    `${point.name} ${point.type} ${point.accepts}`.toLowerCase().includes(search),
  );
  const closest = [...matches].sort((a, b) => a.distanceKm - b.distanceKm);
  const closingSoon = matches.filter((point) => point.closingSoon);

  function toggleSaved(id: string) {
    setSavedIds((current) =>
      current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id],
    );
  }

  function renderSection(title: string, points: DonationPoint[], urgent = false) {
    if (points.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, urgent ? styles.urgentTitle : null]}>
          {title.toUpperCase()}
        </Text>

        <ScrollView
          contentContainerStyle={styles.carousel}
          decelerationRate="fast"
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_GAP}
        >
          {points.map((point) => (
            <DonationPointCard
              key={point.id}
              onToggleSaved={() => toggleSaved(point.id)}
              point={point}
              saved={savedIds.includes(point.id)}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 124 }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={styles.header}>
        <View style={styles.locationLine}>
          <Ionicons name="navigate" size={16} color="#2f7d32" />

          <Text style={styles.locationName}>Camperdown, Sydney</Text>

          <Ionicons name="chevron-down" size={16} color="#2f7d32" />
        </View>

        <Text style={styles.locationRadius}>within 10 km</Text>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#687269" />

          <TextInput
            accessibilityLabel="Search donation points"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Search donation points"
            placeholderTextColor="#7b857d"
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />

          {query.length > 0 ? (
            <Pressable
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setQuery('')}
            >
              <Ionicons name="close-circle" size={18} color="#7b857d" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {renderSection('Closest to you', closest)}

      {renderSection('Closing soon', closingSoon, true)}

      {matches.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search-outline" size={32} color="#2f7d32" />
          </View>

          <Text style={styles.emptyTitle}>No donation points found</Text>

          <Text style={styles.emptyText}>
            Try a different name or another kind of place, such as a food bank.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f8f3',
  },
  header: {
    paddingHorizontal: 20,
  },
  locationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationName: {
    color: '#2f7d32',
    fontSize: 16,
    fontWeight: '800',
  },
  locationRadius: {
    marginTop: 2,
    marginLeft: 22,
    color: '#687269',
    fontSize: 13,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#172019',
    fontSize: 15,
  },
  section: {
    marginTop: 26,
  },
  sectionTitle: {
    marginBottom: 10,
    paddingHorizontal: 20,
    color: '#687269',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  urgentTitle: {
    color: '#9f2420',
  },
  carousel: {
    paddingHorizontal: 20,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  cardHeader: {
    height: 112,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: 12,
  },
  watermark: {
    position: 'absolute',
    right: -6,
    bottom: -14,
    opacity: 0.16,
  },
  cardHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typePill: {
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  heartButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  cardName: {
    flex: 1,
    color: '#172019',
    fontSize: 17,
    fontWeight: '800',
  },
  cardBody: {
    flex: 1,
    gap: 4,
    padding: 14,
  },
  accepts: {
    color: '#172019',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  acceptsLabel: {
    color: '#687269',
    fontWeight: '600',
  },
  hours: {
    color: '#687269',
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  openPill: {
    backgroundColor: '#e7f4e8',
  },
  closingPill: {
    backgroundColor: '#fde7e5',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  openDot: {
    backgroundColor: '#2f7d32',
  },
  closingDot: {
    backgroundColor: '#9f2420',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  openText: {
    color: '#2f7d32',
  },
  closingText: {
    color: '#9f2420',
  },
  distance: {
    color: '#2f7d32',
    fontSize: 18,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  emptyCard: {
    alignItems: 'center',
    marginHorizontal: 20,
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
});