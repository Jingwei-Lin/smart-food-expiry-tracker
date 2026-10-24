import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
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
import { formatDayMonthYear } from '@/utils/expiry-date';
import { type DonationPoint, type PointType, SEARCH_RADIUS_KM } from '@/utils/overpass';
import { ScreenHeader } from '@/components/screen-header';
import { findSuburbs, type Suburb } from '@/utils/suburb-search';

const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  divider: '#EEEFE5',
  accent: '#A6D45A',
  accentSoft: '#F0F7DB',
  link: '#4E7A1F',      // dark lime, for green text and icons on cream
  urgent: '#A92E26',
  urgentSoft: '#FBEFF2',
  warning: '#8B6B1F',
  warningSoft: '#FFF0D5',
  error: '#8B2C25',
};

type IconName = keyof typeof Ionicons.glyphMap;

/* Each kind of place gets its own tint and icon, in place of a photo. */
const TYPE_LOOK: Record<PointType, { icon: IconName; tint: string; accent: string }> = {
  'Food bank': { icon: 'basket-outline', tint: COLORS.accentSoft, accent: COLORS.link },
  'Soup kitchen': { icon: 'restaurant-outline', tint: COLORS.urgentSoft, accent: COLORS.urgent },
  'Community pantry': { icon: 'file-tray-stacked-outline', tint: COLORS.warningSoft, accent: COLORS.warning },
};

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

const DATA_DATE = SNAPSHOT ? formatDayMonthYear(new Date(SNAPSHOT.fetchedAt)) : null;

/*
 * A position from the last few minutes is close enough for a 10 km list and
 * comes back at once, where a fresh fix can take several seconds indoors. A
 * coarse one (a network fix can be off by kilometres) would skew distances
 * shown to 0.1 km, so it must be within 500 m; otherwise a fresh fix is used.
 */
const RECENT_POSITION_MS = 10 * 60 * 1000;
const RECENT_POSITION_ACCURACY_M = 500;

function DonationPointRow({ point, isFirst }: { point: DonationPoint; isFirst: boolean }) {
  const look = TYPE_LOOK[point.type];

  return (
    <View style={[styles.row, isFirst ? null : styles.rowDivider]}>
      <View style={[styles.rowIcon, { backgroundColor: look.tint }]}>
        <Ionicons name={look.icon} size={22} color={look.accent} />
      </View>

      <View style={styles.rowText}>
        <Text numberOfLines={2} style={styles.rowName}>
          {point.name}
        </Text>

        <Text numberOfLines={1} style={styles.rowMeta}>
          <Text style={styles.rowType}>{point.type}</Text>
          {` · ${point.address}`}
        </Text>

        <Text style={styles.hours}>{point.hours}</Text>
      </View>

      <Text style={styles.distance}>{point.distanceKm.toFixed(1)} km</Text>
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
  /* Where the list is centred, so suburb suggestions can put the nearest first. */
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  /* How far down the screen the floating suburb panel starts. */
  const [panelTop, setPanelTop] = useState(insets.top + 140);
  const locationRef = useRef<View>(null);

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

  /**
   * Shows the list straight away, then asks the geocoder for the header's
   * suburb name (when `nameAt` is given) and for the missing addresses.
   */
  async function showPoints(
    found: DonationPoint[],
    isCurrent: () => boolean,
    nameAt?: { latitude: number; longitude: number },
  ) {
    const toLookUp = found.slice(0, ADDRESS_LOOKUPS).filter((point) => !point.address);

    setPoints(
      found.map((point) =>
        point.address
          ? point
          : { ...point, address: toLookUp.includes(point) ? ADDRESS_PENDING : ADDRESS_MISSING },
      ),
    );
    setIsLoading(false);

    // One at a time, header first, so the geocoder doesn't refuse.
    if (nameAt) {
      try {
        const [place] = await Location.reverseGeocodeAsync(nameAt);

        if (place && isCurrent()) {
          setPlaceName([place.city, place.region].filter(Boolean).join(', '));
        }
      } catch {
        // The header can do without a suburb name.
      }

      if (!isCurrent()) {
        return;
      }
    }

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

  /**
   * Lists the bundled donation points within reach of a place, and names the
   * place in the header if asked to.
   */
  function showPointsNear(
    latitude: number,
    longitude: number,
    isCurrent: () => boolean,
    nameHeader = false,
  ) {
    if (!SNAPSHOT) {
      fail("The list of donation points couldn't be read. Please update the app.");
      return;
    }

    setCenter({ latitude, longitude });

    void showPoints(
      pointsNear(SNAPSHOT, latitude, longitude, SEARCH_RADIUS_KM),
      isCurrent,
      nameHeader ? { latitude, longitude } : undefined,
    );
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
        (await Location.getLastKnownPositionAsync({
          maxAge: RECENT_POSITION_MS,
          requiredAccuracy: RECENT_POSITION_ACCURACY_M,
        })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const { latitude, longitude } = position.coords;

      if (!isCurrent()) {
        return;
      }

      showPointsNear(latitude, longitude, isCurrent, true);
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

  /** Drops a suburb search and clears the screen for a load near the phone. */
  function clearSuburb() {
    setIsEditingSuburb(false);
    setSearchedSuburb(null);
    setPlaceName('Your location');
    showLoading();
  }

  /** Goes back to the places around the phone after a suburb search. */
  function backToMyLocation() {
    clearSuburb();
    void loadNearPhone();
  }

  /** Opens the suburb panel just under the location line. */
  function openSuburbPanel() {
    setIsEditingSuburb(true);
    locationRef.current?.measureInWindow((_x, y, _width, height) => {
      if (height > 0) {
        setPanelTop(y + height + 8);
      }
    });
  }

  function closeSuburbPanel() {
    setIsEditingSuburb(false);
    setSuburbQuery('');
  }

  /** Picking a suggestion: its location is already known, so no geocoder lookup. */
  function chooseSuburb(suburb: Suburb) {
    closeSuburbPanel();
    setSearchedSuburb(`${suburb.name} ${suburb.state}`);
    setPlaceName(suburb.name);
    showLoading();
    showPointsNear(suburb.latitude, suburb.longitude, startRequest());
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

  /*
   * "Find donation point" on an item's screen opens this tab with near=phone.
   * The tab stays mounted once opened, so without this it would still show
   * whatever it showed last: another suburb, a search or an error. It is
   * applied while rendering, React's pattern for state that follows a changing
   * param. On a cold open the first load is near the phone anyway, so the
   * param it opened with counts as applied.
   */
  const { near } = useLocalSearchParams<{ near?: string }>();
  const [appliedNear, setAppliedNear] = useState(near ?? null);
  /* Each change starts a load near the phone: the first when the tab opens, then one per "Find donation point". */
  const [phoneLoads, setPhoneLoads] = useState(0);

  if ((near ?? null) !== appliedNear) {
    setAppliedNear(near ?? null);

    if (near === 'phone') {
      setQuery('');
      clearSuburb();
      setPhoneLoads((count) => count + 1);
    }
  }

  /* Clear the param, so the next "Find donation point" counts as a change. */
  useEffect(() => {
    if (appliedNear) {
      router.setParams({ near: undefined });
    }
  }, [appliedNear]);

  useEffect(() => {
    /*
     * loadNearPhone only sets state after its first await, but the lint rule
     * against setting state inside an effect can't see that through a direct
     * call, so it is started from an async wrapper.
     */
    (async () => {
      await loadNearPhone();
    })();

    // Anything still loading when the tab goes away, or a newer load starts, is ignored.
    return () => {
      latestRequest.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneLoads]);

  const search = query.trim().toLowerCase();
  const suburbMatches = findSuburbs(suburbQuery, center);
  const matches = points.filter((point) =>
    `${point.name} ${point.type} ${point.address}`.toLowerCase().includes(search),
  );

  function renderSection(title: string, sectionPoints: DonationPoint[]) {
    if (sectionPoints.length === 0) {
      return null;
    }

    const count = `${sectionPoints.length} ${sectionPoints.length === 1 ? 'place' : 'places'}`;

    /*
     * One list the student scrolls down with the screen. There are rarely more
     * than a handful of places within 10 km, and a sideways row showed only
     * one of them at a time.
     */
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{`${title} · ${count}`.toUpperCase()}</Text>

        <View style={styles.list} testID="donation-points-list">
          {sectionPoints.map((point, index) => (
            <DonationPointRow key={point.id} isFirst={index === 0} point={point} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 124 }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <View style={styles.header}>
        <ScreenHeader
          style={styles.screenHeader}
          title="Give it away"
          subtitle={
            <Pressable
                ref={locationRef}
                accessibilityLabel="Change suburb"
                accessibilityRole="button"
                onPress={() => (isEditingSuburb ? closeSuburbPanel() : openSuburbPanel())}
                style={styles.locationLine}
              >
              <Ionicons name="navigate" size={16} color={COLORS.link} />

              <Text style={styles.locationName}>
                {isLoading && !searchedSuburb ? 'Finding your location…' : placeName}
              </Text>

              <Text style={styles.locationRadius}>· within {SEARCH_RADIUS_KM} km</Text>

              <Ionicons
                name={isEditingSuburb ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.link}
              />
            </Pressable>
          }
        />

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={COLORS.secondary} />

          <TextInput
            accessibilityLabel="Search donation points"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Search donation points"
            placeholderTextColor={COLORS.secondary}
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
              <Ionicons name="close-circle" size={18} color={COLORS.secondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {renderSection(searchedSuburb ? `Closest to ${placeName}` : 'Closest to you', matches)}

      {isLoading ? <ActivityIndicator color={COLORS.link} size="large" style={styles.spinner} /> : null}

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
              onPress={openSuburbPanel}
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
            <Ionicons name="search-outline" size={32} color={COLORS.link} />
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

    {isEditingSuburb ? (
      <>
        {/* Dims the list. Tapping it closes the panel. */}
        <Pressable
          accessibilityLabel="Close suburb search"
          onPress={closeSuburbPanel}
          style={[styles.scrim, { top: panelTop - 4 }]}
        />

        <View style={[styles.suburbPanel, { top: panelTop }]}>
          <View style={[styles.searchBox, styles.suburbBox]}>
            <Ionicons name="search-outline" size={20} color={COLORS.secondary} />

            <TextInput
              accessibilityLabel="Suburb"
              autoCorrect={false}
              autoFocus
              onChangeText={setSuburbQuery}
              onSubmitEditing={() => void searchSuburb(suburbQuery)}
              placeholder="Search a suburb"
              placeholderTextColor={COLORS.secondary}
              returnKeyType="search"
              style={styles.searchInput}
              value={suburbQuery}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={backToMyLocation}
            style={({ pressed }) => [styles.suburbRow, pressed ? styles.pressed : null]}
          >
            <Ionicons name="navigate" size={18} color={COLORS.link} />
            <Text style={styles.currentLocationText}>Use my current location</Text>
          </Pressable>

          {suburbMatches.length > 0 ? (
            <View style={styles.suburbList}>
              <Text style={styles.sectionTitle}>SUBURBS</Text>

              {suburbMatches.map((suburb) => (
                <Pressable
                  key={`${suburb.name}-${suburb.state}`}
                  accessibilityLabel={`${suburb.name}, ${suburb.state} ${suburb.postcode}`}
                  accessibilityRole="button"
                  onPress={() => chooseSuburb(suburb)}
                  style={({ pressed }) => [styles.suburbRow, pressed ? styles.pressed : null]}
                >
                  <Ionicons name="location-outline" size={20} color={COLORS.secondary} />

                  <Text numberOfLines={1} style={styles.suburbName}>
                    <Text style={styles.suburbNameMatch}>
                      {suburb.name.slice(0, suburbQuery.trim().length)}
                    </Text>
                    {suburb.name.slice(suburbQuery.trim().length)}
                  </Text>

                  <Text style={styles.suburbPostcode}>
                    {suburb.state} {suburb.postcode}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
  },

  /* Location line under the title */
  locationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  locationName: {
    color: COLORS.link,
    fontSize: 16,
    fontFamily: 'Fredoka_600SemiBold',
  },
  locationRadius: {
    color: COLORS.link,
    fontSize: 13,
    fontFamily: 'Fredoka_600SemiBold',
  },

  /* Search boxes */
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    marginTop: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
  },

  /* Floating suburb panel */
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 42, 22, 0.28)',
  },
  suburbPanel: {
    position: 'absolute',
    left: 20,
    right: 20,
    gap: 6,
    padding: 14,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  suburbBox: {
    marginTop: 0,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  suburbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  currentLocationText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  suburbList: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  suburbName: {
    flex: 1,
    color: COLORS.primary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
  },
  suburbNameMatch: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  suburbPostcode: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
  },

  /* Filter chips (step 6) */
  chips: {
    gap: 8,
    marginTop: 14,
  },
  chip: {
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  chipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
  },
  chipTextSelected: {
    color: COLORS.surface,
  },

  /* The list of places (step 7) */
  section: {
    marginTop: 22,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    marginBottom: 10,
    color: COLORS.secondary,
    fontSize: 11,
    fontFamily: 'Fredoka_500Medium',
    letterSpacing: 0.9,
  },
  list: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  rowIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
  },
  rowMeta: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
  },
  rowType: {
    fontFamily: 'Fredoka_500Medium',
  },
  hours: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
  },
  distance: {
    color: COLORS.link,
    fontSize: 16,
    fontFamily: 'Fredoka_600SemiBold',
  },
  attribution: {
    marginTop: 10,
    paddingHorizontal: 20,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.72,
  },

  /* Empty and error states */
  emptyCard: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 34,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 28,
    paddingVertical: 34,
  },
  emptyIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: COLORS.accentSoft,
  },
  emptyTitle: {
    marginTop: 16,
    color: COLORS.primary,
    fontSize: 19,
    fontFamily: 'Fredoka_600SemiBold',
  },
  emptyText: {
    marginTop: 8,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
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
    color: COLORS.error,
    fontFamily: 'Fredoka_400Regular',
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
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontFamily: 'Fredoka_600SemiBold',
  },
  secondaryButton: {
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: COLORS.link,
    fontSize: 14,
    fontFamily: 'Fredoka_600SemiBold',
  },
  screenHeader: {
  marginBottom: 4,
  },
});