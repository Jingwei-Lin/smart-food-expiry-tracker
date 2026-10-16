/*
 * Donation points from OpenStreetMap, through the Overpass API.
 *
 * The parsing is kept apart from the request so it can be tested without a
 * network, in the same way as the Open Food Facts client.
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

/*
 * Free public Overpass servers, tried in order. The main one is often
 * overloaded, so a refusal there moves on to the next.
 */
export const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/*
 * Overpass blocks requests that carry a phone's or library's default
 * User-Agent, so the app names itself, as it does for Open Food Facts.
 */
const USER_AGENT = 'SmartFoodExpiryTracker/1.0 (COMP5216-2026-GP-23 student project)';

export const SEARCH_RADIUS_KM = 10;

/*
 * The snapshot is downloaded by a developer's script, not while a student
 * waits, so a slow server can be given a long time. One that uses up its full
 * limit counts as busy and the next server is tried. The query's own limit is
 * shorter, so a slow server usually says it gave up before the script does.
 */
const SNAPSHOT_QUERY_TIMEOUT_S = 120;
const SNAPSHOT_REQUEST_TIMEOUT_MS = 130000;

export type SnapshotResult =
  | { outcome: 'found'; snapshot: DonationSnapshot }
  | { outcome: 'busy' }
  | { outcome: 'unavailable' };

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
        .replace(/ off$/, ' closed');
    });

  return rules.join(', ');
}

function pointType(tags: Record<string, string>): PointType {
  // A tag can hold several values separated by semicolons, e.g. "food_bank;outreach".
  const facilities = (tags.social_facility ?? '').split(';').map((value) => value.trim());

  if (tags.amenity === 'food_sharing' || facilities.includes('food_sharing')) {
    return 'Community pantry';
  }

  return facilities.includes('soup_kitchen') ? 'Soup kitchen' : 'Food bank';
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
  const tags = element.tags ?? {};
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;

  if (!tags.name || latitude === undefined || longitude === undefined) {
    return null;
  }

  return {
    id: `${element.type}/${element.id}`,
    name: tags.name,
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
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;

    if (!tags.name || lat === undefined || lon === undefined || NOT_A_DROP_OFF.test(tags.name)) {
      continue;
    }

    const keptTags: Record<string, string> = {};

    for (const key of SNAPSHOT_TAGS) {
      if (tags[key]) {
        keptTags[key] = tags[key];
      }
    }

    kept.push({ type: element.type, id: element.id, lat, lon, tags: keptTags });
  }

  return { fetchedAt: fetchedAt.toISOString(), elements: kept };
}

/*
 * Every donation point in Australia. OpenStreetMap lists only a few dozen, so
 * the whole country stays a small file and works wherever the phone is.
 * Community pantries are tagged either way round, so both are asked for. The
 * pattern matches one whole value in a semicolon list, so "food_bank;outreach"
 * counts but "food_bank_volunteers" would not.
 */
export function buildSnapshotQuery(): string {
  return `[out:json][timeout:${SNAPSHOT_QUERY_TIMEOUT_S}];area["ISO3166-1"="AU"][admin_level=2]->.au;(nwr["social_facility"~"(^|;) *(food_bank|soup_kitchen|food_sharing) *(;|$)"](area.au);nwr["amenity"="food_sharing"](area.au););out center tags;`;
}

type ServerAnswer =
  | { outcome: 'found'; elements: OverpassElement[] }
  | { outcome: 'busy' }
  | { outcome: 'unavailable' };

/** Sends one query to one Overpass server. Running out of time counts as busy. */
async function askServer(server: string, query: string, timeoutMs: number): Promise<ServerAnswer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Overpass asks for the query in a POST body rather than in the URL.
    const response = await fetch(server, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      return { outcome: 'busy' };
    }

    const body = (await response.json()) as { elements?: OverpassElement[]; remark?: string };

    /*
     * A query that runs out of time or memory on the server still comes back
     * as a 200, with no elements or only some of them and a remark saying so.
     * Saving that would ship an empty or partial list.
     */
    if (body.remark?.startsWith('runtime error')) {
      return { outcome: 'busy' };
    }

    return { outcome: 'found', elements: body.elements ?? [] };
  } catch {
    return controller.signal.aborted ? { outcome: 'busy' } : { outcome: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Downloads every donation point in Australia as a snapshot dated `now`.
 *
 * Never throws. A server that refuses (406, 429 or 504 with an HTML page),
 * reports a runtime error or runs out of time counts as busy, and the next one
 * is tried. If none of them answers, the result is `busy`. With no signal, or
 * an unreadable answer from every server, it is `unavailable`.
 */
export async function fetchSnapshot(now = new Date()): Promise<SnapshotResult> {
  let anyBusy = false;

  for (const server of OVERPASS_SERVERS) {
    const answer = await askServer(server, buildSnapshotQuery(), SNAPSHOT_REQUEST_TIMEOUT_MS);

    if (answer.outcome === 'found') {
      return { outcome: 'found', snapshot: toSnapshot(answer.elements, now) };
    }

    if (answer.outcome === 'busy') {
      anyBusy = true;
    }
  }

  return anyBusy ? { outcome: 'busy' } : { outcome: 'unavailable' };
}
