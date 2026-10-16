import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import bundledSnapshot from '@/data/donation-points-au.json';
import { parseSnapshot, pointsNear } from '@/utils/donation-snapshot';
import { type DonationPoint, type PointType, SEARCH_RADIUS_KM } from '@/utils/overpass';

type IconName = keyof typeof Ionicons.glyphMap;

/* Each kind of place gets its own tint and icon, in place of a photo. */
const TYPE_LOOK: Record<PointType, { icon: IconName; tint: string; accent: string }> = {
  'Food bank': { icon: 'basket-outline', tint: '#e7f4e8', accent: '#2f7d32' },
  'Soup kitchen': { icon: 'restaurant-outline', tint: '#fbf0dc', accent: '#9a5b12' },
};

const CARD_WIDTH = 290;
const CARD_GAP = 14;

/* The phone's geocoder rate-limits, so only the closest places get an address looked up. */
const ADDRESS_LOOKUPS = 10;
const ADDRESS_PENDING = 'Looking up address…';
const ADDRESS_MISSING = 'Address not listed';

/*
 * The donation points ship with the app (npm run snapshot:donation-points
 * refreshes them), because the public OpenStreetMap servers can keep a
 * request waiting for half a minute. Null only if the bundled file is broken.
 */
const SNAPSHOT = parseSnapshot(bundledSnapshot);

const DATA_DATE = SNAPSHOT
  ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(SNAPSHOT.fetchedAt),
    )
  : null;

/*
 * A position from the last few minutes is close enough for a 10 km list and
 * comes back at once, where a fresh fix can take several seconds indoors.
 */
const RECENT_POSITION_MS = 10 * 60 * 1000;

function initials(name: string): string {
  return name
    .split(' ')
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function DonationPointCard({ point }: { point: DonationPoint }) {
  const look = TYPE_LOOK[point.type];

  return (
    <View style={styles.card}>
      <View style={[styles.cardHeader, { backgroundColor: look.tint }]}>
        <View pointerEvents="none" style={styles.watermark}>
          <Ionicons name={look.icon} size={96} color={look.accent} />
        </View>

        <View style={styles.typePill}>
          <Text style={[styles.typePillText, { color: look.accent }]}>{point.type}</Text>
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
        <Text numberOfLines={2} style={styles.address}>
          <Text style={styles.addressLabel}>Address: </Text>
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

  return ADDRESS_MISSING;
}

/**
 * Donation points tab: food banks and soup kitchens from the bundled
 * OpenStreetMap list within 10 km of the phone, or of a suburb the student
 * types in. Nothing is downloaded, so the list shows as soon as the location
 * is known, and the location never leaves the phone.
 *
 * Search narrows the list by name, kind of place or address. Only the newest
 * load is shown, so a slow GPS load can't overwrite a suburb search made while
 * it was running.
 */
export default function DonationPointsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [points, setPoints] = useState<DonationPoint[]>([]);
  const [placeName, setPlaceName] = useState('Your location');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [suburbQuery, setSuburbQuery] = useState('');
  const [isEditingSuburb, setIsEditingSuburb] = useState(false);
  /* The suburb the list is for, or null while it is around the phone. */
  const [searchedSuburb, setSearchedSuburb] = useState<string | null>(null);

  const latestRequest = useRef(0);

  /** Starts a new load, and returns a check that turns false once a newer one starts. */
  function startRequest(): () => boolean {
    latestRequest.current += 1;
    const id = latestRequest.current;

    return () => id === latestRequest.current;
  }

  /*
   * Clears the screen for a load the student asked for. The first load needs
   * no clearing, because the screen starts out loading with an empty list.
   */
  function showLoading() {
    setIsLoading(true);
    setError(null);
    setPoints([]);
  }

  function fail(message: string) {
    setError(message);
    setIsLoading(false);
  }

  /** Shows the list straight away, then fills in missing addresses one at a time. */
  async function showPoints(found: DonationPoint[], isCurrent: () => boolean) {
    const toLookUp = found.slice(0, ADDRESS_LOOKUPS).filter((point) => !point.address);

    setPoints(
      found.map((point) =>
        point.address
          ? point
          : { ...point, address: toLookUp.includes(point) ? ADDRESS_PENDING : ADDRESS_MISSING },
      ),
    );
    setIsLoading(false);

    // One at a time, so the geocoder doesn't refuse.
    for (const point of toLookUp) {
      const address = await lookUpAddress(point.latitude, point.longitude);

      if (!isCurrent()) {
        return;
      }

      setPoints((current) =>
        current.map((shown) => (shown.id === point.id ? { ...shown, address } : shown)),
      );
    }
  }

  /** Lists the bundled donation points within reach of a place. */
  function showPointsNear(latitude: number, longitude: number, isCurrent: () => boolean) {
    if (!SNAPSHOT) {
      fail("The list of donation points couldn't be read. Please update the app.");
      return;
    }

    void showPoints(pointsNear(SNAPSHOT, latitude, longitude, SEARCH_RADIUS_KM), isCurrent);
  }

  async function loadNearPhone() {
    const isCurrent = startRequest();

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (!isCurrent()) {
        return;
      }

      if (status !== 'granted') {
        fail(
          'Location access is off for this app. Search a suburb instead, or allow location in Settings.',
        );
        return;
      }

      if (!(await Location.hasServicesEnabledAsync())) {
        if (isCurrent()) {
          fail('Location services are turned off. Turn them on, or search a suburb instead.');
        }
        return;
      }

      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: RECENT_POSITION_MS })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const { latitude, longitude } = position.coords;

      if (!isCurrent()) {
        return;
      }

      // The header can do without a suburb name, so it doesn't hold up the list.
      Location.reverseGeocodeAsync({ latitude, longitude })
        .then(([place]) => {
          if (place && isCurrent()) {
            setPlaceName([place.city, place.region].filter(Boolean).join(', '));
          }
        })
        .catch(() => undefined);

      showPointsNear(latitude, longitude, isCurrent);
    } catch {
      if (isCurrent()) {
        fail("Couldn't find where you are. Try again, or search a suburb instead.");
      }
    }
  }

  /** Finds where the typed suburb is, then loads donation points around it. */
  async function searchSuburb(text: string) {
    const suburb = text.trim();

    if (!suburb) {
      return;
    }

    setIsEditingSuburb(false);
    setSearchedSuburb(suburb);
    setPlaceName(suburb);
    showLoading();
    const isCurrent = startRequest();

    try {
      // Suburb names repeat across states (there is a Newtown in NSW, Victoria
      // and Tasmania), so the box asks for the state as well.
      const [place] = await Location.geocodeAsync(`${suburb}, Australia`);

      if (!isCurrent()) {
        return;
      }

      if (!place) {
        fail(`Couldn't find "${suburb}". Check the spelling, add the state, and try again.`);
        return;
      }

      showPointsNear(place.latitude, place.longitude, isCurrent);
    } catch {
      if (isCurrent()) {
        fail(`Couldn't look up "${suburb}". Check your connection and try again.`);
      }
    }
  }

  /** Goes back to the places around the phone after a suburb search. */
  function backToMyLocation() {
    setIsEditingSuburb(false);
    setSearchedSuburb(null);
    setPlaceName('Your location');
    showLoading();
    void loadNearPhone();
  }

  /** Repeats whichever load failed: the phone's location or the last suburb. */
  function retry() {
    if (searchedSuburb) {
      void searchSuburb(searchedSuburb);
    } else {
      showLoading();
      void loadNearPhone();
    }
  }

  useEffect(() => {
    /*
     * loadNearPhone only sets state after its first await, but the lint rule
     * against setting state inside an effect can't see that through a direct
     * call, so it is started from an async wrapper.
     */
    (async () => {
      await loadNearPhone();
    })();

    // Anything still loading when the tab goes away is ignored.
    return () => {
      latestRequest.current += 1;
    };
    // Runs once, when the tab first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = query.trim().toLowerCase();
  const matches = points.filter((point) =>
    `${point.name} ${point.type} ${point.address}`.toLowerCase().includes(search),
  );

  function renderSection(title: string, sectionPoints: DonationPoint[]) {
    if (sectionPoints.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>

        <ScrollView
          contentContainerStyle={styles.carousel}
          decelerationRate="fast"
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_GAP}
        >
          {sectionPoints.map((point) => (
            <DonationPointCard key={point.id} point={point} />
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
            {isLoading && !searchedSuburb ? 'Finding your location…' : placeName}
          </Text>

          <Ionicons
            name={isEditingSuburb ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#2f7d32"
          />
        </Pressable>

        <Text style={styles.locationRadius}>within {SEARCH_RADIUS_KM} km</Text>

        {isEditingSuburb ? (
          <View style={styles.searchBox}>
            <Ionicons name="location-outline" size={20} color="#687269" />

            <TextInput
              accessibilityLabel="Suburb"
              autoFocus
              onChangeText={setSuburbQuery}
              onSubmitEditing={() => void searchSuburb(suburbQuery)}
              placeholder="Enter a suburb and state, e.g. Newtown NSW"
              placeholderTextColor="#7b857d"
              returnKeyType="search"
              style={styles.searchInput}
              value={suburbQuery}
            />
          </View>
        ) : null}

        {isEditingSuburb && searchedSuburb ? (
          <Pressable
            accessibilityRole="button"
            onPress={backToMyLocation}
            style={({ pressed }) => [styles.myLocationButton, pressed ? styles.pressed : null]}
          >
            <Ionicons name="navigate" size={16} color="#2f7d32" />

            <Text style={styles.myLocationText}>Use my location</Text>
          </Pressable>
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

      {renderSection(searchedSuburb ? `Closest to ${placeName}` : 'Closest to you', matches)}

      {isLoading ? <ActivityIndicator color="#2f7d32" size="large" style={styles.spinner} /> : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>

          <View style={styles.errorActions}>
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setIsEditingSuburb(true)}
              style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.secondaryButtonText}>Search a suburb</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!isLoading && !error && matches.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search-outline" size={32} color="#2f7d32" />
          </View>

          {search ? (
            <>
              <Text style={styles.emptyTitle}>No matches</Text>

              <Text style={styles.emptyText}>
                Try a different name or another kind of place, such as a food bank.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>No donation points nearby</Text>

              <Text style={styles.emptyText}>
                None are listed within {SEARCH_RADIUS_KM} km of {searchedSuburb ? placeName : 'you'}
                . Try searching another suburb.
              </Text>
            </>
          )}
        </View>
      ) : null}

      {!isLoading && !error && DATA_DATE ? (
        <Text style={styles.attribution}>Data © OpenStreetMap contributors, as of {DATA_DATE}</Text>
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
  myLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2f7d32',
    borderRadius: 12,
    backgroundColor: '#e7f4e8',
  },
  myLocationText: {
    color: '#1f5a22',
    fontSize: 15,
    fontWeight: '700',
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
  typePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '800',
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
  address: {
    color: '#172019',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  addressLabel: {
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
  distance: {
    color: '#2f7d32',
    fontSize: 18,
    fontWeight: '800',
  },
  attribution: {
    marginTop: 10,
    paddingHorizontal: 20,
    color: '#687269',
    fontSize: 12,
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
  errorBox: {
    alignItems: 'center',
    marginTop: 24,
    marginHorizontal: 20,
  },
  errorText: {
    color: '#9f2420',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: '#2f7d32',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#2f7d32',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#2f7d32',
    fontSize: 14,
    fontWeight: '700',
  },
});
