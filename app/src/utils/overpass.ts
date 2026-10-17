/*
 * Donation points from OpenStreetMap, as the Overpass API returns them.
 *
 * Only the parsing is here, which the app needs to read its bundled list. The
 * download that builds that list is in overpass-download.ts, for the
 * developer's script.
 */

/*
 * A community pantry or fridge is where anyone can leave spare food for others
 * to take, the closest fit for a student who can't finish something. Shelters
 * are left out: they don't take food from the public, and a refuge's address
 * shouldn't be promoted in a public app.
 */
export type PointType = 'Food bank' | 'Soup kitchen' | 'Community pantry';

export type DonationPoint = {
  id: string;
  name: string;
  type: PointType;
  distanceKm: number;
  hours: string;
  /** Empty when OpenStreetMap has no address, so the screen can look one up. */
  address: string;
  latitude: number;
  longitude: number;
};

/**
 * One element of an Overpass `out center tags` response. Nodes carry their own
 * coordinates; ways and relations carry a centre instead.
 */
export type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Donation points saved for use without a network: the elements of one
 * Overpass response, cut down to what a card shows.
 */
export type DonationSnapshot = {
  /** When the data was downloaded from OpenStreetMap, as an ISO time. */
  fetchedAt: string;
  elements: OverpassElement[];
};

/* The only tags toDonationPoint and osmAddress read; the rest would just make the file bigger. */
const SNAPSHOT_TAGS = [
  'name',
  'amenity',
  'social_facility',
  'opening_hours',
  'addr:full',
  'addr:housenumber',
  'addr:street',
  'addr:suburb',
  'addr:city',
];

export const SEARCH_RADIUS_KM = 10;

/** Straight-line distance between two points in km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (degrees: number) => (degrees * Math.PI) / 180;
  const h =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;

  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The address OpenStreetMap has for a place, or '' if it has none. */
export function osmAddress(tags: Record<string, string>): string {
  if (tags['addr:full']) {
    return tags['addr:full'];
  }

  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const suburb = tags['addr:suburb'] ?? tags['addr:city'];

  return [street, suburb].filter(Boolean).join(', ');
}

const DAY_NAMES: Record<string, string> = {
  Mo: 'Mon',
  Tu: 'Tue',
  We: 'Wed',
  Th: 'Thu',
  Fr: 'Fri',
  Sa: 'Sat',
  Su: 'Sun',
};

/*
 * OpenStreetMap writes opening hours in a compact code ("Mo-Sa 12:00-16:00;
 * Su off"). Spells out the days and the common phrases so a student can read
 * it at a glance; anything else is left as written rather than guessed at.
 * A rule can hold commas of its own ("Mo-Fr 09:00-12:00,13:00-16:00"), so
 * rules are set apart with a dot rather than another comma.
 */
export function formatOpeningHours(raw: string): string {
  const rules = raw
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      if (rule === '24/7') {
        return 'Open 24 hours';
      }

      if (/^PH (off|closed)$/.test(rule)) {
        return 'closed on public holidays';
      }

      return rule
        .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (day) => DAY_NAMES[day])
        .replace(/\bPH\b/g, 'public holidays')
        .replace(/,(?=\S)/g, ', ')
        .replace(/ off$/, ' closed');
    });

  return rules.join(' · ');
}

function pointType(tags: Record<string, string>): PointType {
  // A tag can hold several values separated by semicolons, e.g. "food_bank;outreach".
  const facilities = (tags.social_facility ?? '').split(';').map((value) => value.trim());

  if (tags.amenity === 'food_sharing' || facilities.includes('food_sharing')) {
    return 'Community pantry';
  }

  return facilities.includes('soup_kitchen') ? 'Soup kitchen' : 'Food bank';
}

/*
 * The name and coordinates a card needs, or null if the element lacks either.
 * A way or relation has no coordinates of its own, so its centre is used.
 * Shared by the app and the snapshot download, so both keep the same places.
 */
function cardPosition(
  element: OverpassElement,
): { name: string; latitude: number; longitude: number } | null {
  const name = element.tags?.name;
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;

  if (!name || latitude === undefined || longitude === undefined) {
    return null;
  }

  return { name, latitude, longitude };
}

/**
 * Turns one Overpass element into a donation point, measured from the given
 * place. Returns null for elements without a name or coordinates, which can't
 * be shown on a card.
 */
export function toDonationPoint(
  element: OverpassElement,
  fromLatitude: number,
  fromLongitude: number,
): DonationPoint | null {
  const position = cardPosition(element);

  if (!position) {
    return null;
  }

  const { name, latitude, longitude } = position;
  const tags = element.tags ?? {};

  return {
    id: `${element.type}/${element.id}`,
    name,
    type: pointType(tags),
    distanceKm: distanceKm(fromLatitude, fromLongitude, latitude, longitude),
    hours: tags.opening_hours ? formatOpeningHours(tags.opening_hours) : 'Hours not listed',
    address: osmAddress(tags),
    latitude,
    longitude,
  };
}

/** Maps a whole response, closest first. */
export function toDonationPoints(
  elements: OverpassElement[],
  fromLatitude: number,
  fromLongitude: number,
): DonationPoint[] {
  return elements
    .map((element) => toDonationPoint(element, fromLatitude, fromLongitude))
    .filter((point): point is DonationPoint => point !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/*
 * OpenStreetMap tags many Meals on Wheels services as food banks, but they
 * deliver meals to people at home rather than take food in from the public,
 * so a student sent to one would find nowhere to drop food off.
 */
const NOT_A_DROP_OFF = /meals on wheels/i;

/**
 * Cuts a response down to a snapshot. Elements a card can't show (no name or
 * no coordinates) are dropped, as are places that don't take donations, and a
 * way's or relation's centre becomes its coordinates, so every saved element
 * reads like a node.
 */
export function toSnapshot(elements: OverpassElement[], fetchedAt: Date): DonationSnapshot {
  const kept: OverpassElement[] = [];

  for (const element of elements) {
    const position = cardPosition(element);

    if (!position || NOT_A_DROP_OFF.test(position.name)) {
      continue;
    }

    const tags = element.tags ?? {};
    const keptTags: Record<string, string> = {};

    for (const key of SNAPSHOT_TAGS) {
      if (tags[key]) {
        keptTags[key] = tags[key];
      }
    }

    kept.push({
      type: element.type,
      id: element.id,
      lat: position.latitude,
      lon: position.longitude,
      tags: keptTags,
    });
  }

  return { fetchedAt: fetchedAt.toISOString(), elements: kept };
}
