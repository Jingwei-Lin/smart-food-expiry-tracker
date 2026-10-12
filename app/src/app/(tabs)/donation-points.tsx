import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,} from 'react-native';

type IconName = keyof typeof Ionicons.glyphMap;

type PointType = 'Food bank' | 'Soup kitchen' | 'Shelter';

type DonationPoint = {
  id: string;
  name: string;
  type: PointType;
  distanceKm: number;
  hours: string;
  address: string;
  latitude: number;
  longitude: number;
};

/* Each kind of place gets its own tint and icon, in place of a photo. */
const TYPE_LOOK: Record<PointType, { icon: IconName; tint: string; accent: string }> = {
  'Food bank': { icon: 'basket-outline', tint: '#e7f4e8', accent: '#2f7d32' },
  'Soup kitchen': { icon: 'restaurant-outline', tint: '#fbf0dc', accent: '#9a5b12' },
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

/** Straight-line distance between two points in km. */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (degrees: number) => (degrees * Math.PI) / 180;
  const h =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;

  return 2 * 6371 * Math.asin(Math.sqrt(h));
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
          <Text style={styles.acceptsLabel}>Address: </Text>
          {point.address}
          </Text>

        <Text style={styles.hours}>{point.hours}</Text>
        <View style={styles.footer}>
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

/** The address OpenStreetMap has for a place, or '' if it has none. */
function osmAddress(tags: Record<string, string>): string {
  if (tags['addr:full']) {
    return tags['addr:full'];
  }

  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const suburb = tags['addr:suburb'] ?? tags['addr:city'];

  return [street, suburb].filter(Boolean).join(', ');
}

/** Asks the phone's geocoder for the address at these coordinates. */
async function lookUpAddress(latitude: number, longitude: number): Promise<string> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });

    if (place) {
      const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
      const line = [street, place.city].filter(Boolean).join(', ');

      if (line) {
        return line;
      }
    }
  } catch {}

  return 'Address not listed';
}

/** Asks OpenStreetMap for donation points within 10 km of a place. */
async function fetchPointsAround(latitude: number, longitude: number): Promise<DonationPoint[]> {
  const query = `[out:json];nwr["social_facility"~"food_bank|soup_kitchen|shelter"](around:10000,${latitude},${longitude});out center tags;`;
  const response = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
  );
  const text = await response.text();
  console.log('Overpass status:', response.status, text.slice(0, 300));
  const data = JSON.parse(text);

  const points: DonationPoint[] = data.elements
    .filter((e: any) => e.tags?.name)
    .map((e: any): DonationPoint => {
      const lat = e.lat ?? e.center.lat;
      const lon = e.lon ?? e.center.lon;

      return {
        id: `${e.type}/${e.id}`,
        name: e.tags.name,
        type:
          e.tags.social_facility === 'shelter'
            ? 'Shelter'
            : e.tags.social_facility === 'soup_kitchen'
              ? 'Soup kitchen'
              : 'Food bank',
        distanceKm: distanceKm(latitude, longitude, lat, lon),
        hours: e.tags.opening_hours ?? 'Hours not listed',
        address: osmAddress(e.tags),
        latitude: lat,
        longitude: lon,
      };
    });

  // Closest first, so address lookups go to the places people see first.
  points.sort((a, b) => a.distanceKm - b.distanceKm);

  // Fill in missing addresses for the 10 closest. One at a time, so the geocoder doesn't refuse.
  for (const point of points.slice(0, 10)) {
    if (!point.address) {
      point.address = await lookUpAddress(point.latitude, point.longitude);
    }
  }

  // Anything further away without an address gets the fallback.
  for (const point of points) {
    if (!point.address) {
      point.address = 'Address not listed';
    }
  }

  return points;
}

export default function DonationPointsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [points, setPoints] = useState<DonationPoint[]>([]);
  const [placeName, setPlaceName] = useState('Your location');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [suburbQuery, setSuburbQuery] = useState('');
  const [isEditingSuburb, setIsEditingSuburb] = useState(false);

  /** Finds where the typed suburb is, then loads donation points around it. */
  async function searchSuburb() {
    const suburb = suburbQuery.trim();

    if (!suburb) {
      return;
    }

    setIsEditingSuburb(false);
    setIsLoading(true);
    setError(null);
    setPoints([]);

    try {
      const [result] = await Location.geocodeAsync(`${suburb}, NSW, Australia`);

      if (!result) {
        setError(`Couldn't find "${suburb}". Check the spelling and try again.`);
        return;
      }

      setPlaceName(suburb);
      setPoints(await fetchPointsAround(result.latitude, result.longitude));
    } catch (err) {
      console.log('Suburb search failed:', err);
      setError(`Couldn't load donation points near "${suburb}".`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        // 1. Ask for permission, as in class.
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          setError('Allow location access in Settings to see donation points near you.');
          return;
        }

        // 2. Where is the phone?
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = current.coords;

        // 3. Suburb name for the header. This can throw, so it has its own try.
        try {
          const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (place) {
            setPlaceName([place.city, place.region].filter(Boolean).join(', '));
          }
        } catch {}

        // 4. Donation points near the phone.
        setPoints(await fetchPointsAround(latitude, longitude));
      } catch (err) {
        console.log('Donation points failed:', err);
        setError("Couldn't load donation points. Check your connection and reopen this tab.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const search = query.trim().toLowerCase();
  const matches = points.filter((point) =>
    `${point.name} ${point.type} ${point.address}`.toLowerCase().includes(search),
  );
  const closest = [...matches].sort((a, b) => a.distanceKm - b.distanceKm);

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
        <Pressable
        accessibilityLabel="Change suburb"
        accessibilityRole="button"
        onPress={() => setIsEditingSuburb(!isEditingSuburb)}
        style={styles.locationLine}
      >
        <Ionicons name="navigate" size={16} color="#2f7d32" />

        <Text style={styles.locationName}>
          {isLoading ? 'Finding your location…' : placeName}
        </Text>

        <Ionicons name={isEditingSuburb ? 'chevron-up' : 'chevron-down'} size={16} color="#2f7d32" />
      </Pressable>

        <Text style={styles.locationRadius}>within 10 km</Text>
        {isEditingSuburb ? (
        <View style={styles.searchBox}>
          <Ionicons name="location-outline" size={20} color="#687269" />

          <TextInput
            accessibilityLabel="Suburb"
            autoFocus
            onChangeText={setSuburbQuery}
            onSubmitEditing={searchSuburb}
            placeholder="Enter a suburb, e.g. Newtown"
            placeholderTextColor="#7b857d"
            returnKeyType="search"
            style={styles.searchInput}
            value={suburbQuery}
          />
        </View>
      ) : null}

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

      {isLoading ? <ActivityIndicator color="#2f7d32" size="large" style={styles.spinner} /> : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!isLoading && !error && matches.length === 0 ? (
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
  spinner: {
  marginTop: 40,
  },
  errorText: {
    marginTop: 24,
    marginHorizontal: 20,
    color: '#9f2420',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});