/*
 * Donation points from OpenStreetMap, through the Overpass API.
 *
 * The parsing is kept apart from the request so it can be tested without a
 * network, in the same way as the Open Food Facts client.
 */

export type PointType = 'Food bank' | 'Soup kitchen' | 'Shelter';

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

export type DonationPointsResult =
  { outcome: 'found'; points: DonationPoint[] } | { outcome: 'busy' } | { outcome: 'unavailable' };

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
 * An overloaded server can take over a minute to answer, so the query allows
 * 90 s ([timeout:90]) and the phone waits a little longer for that answer.
 */
const QUERY_TIMEOUT_S = 90;
const REQUEST_TIMEOUT_MS = 95000;

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

function pointType(socialFacility: string | undefined): PointType {
  if (socialFacility === 'shelter') {
    return 'Shelter';
  }

  return socialFacility === 'soup_kitchen' ? 'Soup kitchen' : 'Food bank';
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
    type: pointType(tags.social_facility),
    distanceKm: distanceKm(fromLatitude, fromLongitude, latitude, longitude),
    hours: tags.opening_hours ?? 'Hours not listed',
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

/**
 * Cuts a response down to a snapshot. Elements a card can't show (no name or
 * no coordinates) are dropped, and a way's or relation's centre becomes its
 * coordinates, so every saved element reads like a node.
 */
export function toSnapshot(elements: OverpassElement[], fetchedAt: Date): DonationSnapshot {
  const kept: OverpassElement[] = [];

  for (const element of elements) {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;

    if (!tags.name || lat === undefined || lon === undefined) {
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

export function buildQuery(latitude: number, longitude: number): string {
  const radiusM = SEARCH_RADIUS_KM * 1000;

  return `[out:json][timeout:${QUERY_TIMEOUT_S}];nwr["social_facility"~"food_bank|soup_kitchen|shelter"](around:${radiusM},${latitude},${longitude});out center tags;`;
}

type ServerAnswer = DonationPointsResult | { outcome: 'timed-out' };

/** Asks one Overpass server. */
async function askServer(
  server: string,
  latitude: number,
  longitude: number,
): Promise<ServerAnswer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Overpass asks for the query in a POST body rather than in the URL.
    const response = await fetch(server, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(buildQuery(latitude, longitude))}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      return { outcome: 'busy' };
    }

    const body = (await response.json()) as { elements?: OverpassElement[]; remark?: string };

    /*
     * A query that runs out of time or memory on the server still comes back
     * as a 200, with no elements or only some of them and a remark saying so.
     * Showing that as the result would tell the student nothing is nearby.
     */
    if (body.remark?.startsWith('runtime error')) {
      return { outcome: 'busy' };
    }

    return { outcome: 'found', points: toDonationPoints(body.elements ?? [], latitude, longitude) };
  } catch {
    return controller.signal.aborted ? { outcome: 'timed-out' } : { outcome: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Asks OpenStreetMap for donation points around a place, closest first.
 *
 * Never throws. When a server is overloaded or refuses the app it answers 406,
 * 429 or 504 with an HTML page, or a 200 whose remark reports a runtime error,
 * and the next server is tried. A server that runs out of time ends the
 * search, so the student isn't left waiting for a second slow answer. Either
 * way the result is `busy`. With no signal, or an unreadable answer from every
 * server, it is `unavailable`.
 */
export async function fetchDonationPoints(
  latitude: number,
  longitude: number,
): Promise<DonationPointsResult> {
  let anyBusy = false;

  for (const server of OVERPASS_SERVERS) {
    const answer = await askServer(server, latitude, longitude);

    if (answer.outcome === 'found') {
      return answer;
    }

    if (answer.outcome === 'timed-out') {
      return { outcome: 'busy' };
    }

    if (answer.outcome === 'busy') {
      anyBusy = true;
    }
  }

  return anyBusy ? { outcome: 'busy' } : { outcome: 'unavailable' };
}
