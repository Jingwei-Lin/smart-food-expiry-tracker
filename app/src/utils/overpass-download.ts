/*
 * Downloads every donation point in Australia from the Overpass API, for the
 * developer's script that regenerates the list the app ships with. The app
 * itself never imports this file, so none of it ends up in the app.
 *
 * Node runs the script's TypeScript directly but can't resolve an import path
 * without its extension, so this file imports only types, which Node drops.
 */
import type { OverpassElement } from './overpass';

/*
 * Free public Overpass servers, tried in order. The main one is often
 * overloaded, so a refusal there moves on to the next.
 */
export const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/*
 * Overpass blocks requests that carry a library's default User-Agent, so the
 * app names itself, as it does for Open Food Facts.
 */
const USER_AGENT = 'SmartFoodExpiryTracker/1.0 (COMP5216-2026-GP-23 student project)';

/*
 * The download runs from a developer's script, not while a student waits, so a
 * slow server can be given a long time. One that uses up its full limit counts
 * as busy and the next server is tried. The query's own limit is shorter, so a
 * slow server usually says it gave up before the script does.
 */
const QUERY_TIMEOUT_S = 120;
const REQUEST_TIMEOUT_MS = 130000;

export type DownloadResult =
  | { outcome: 'found'; elements: OverpassElement[] }
  | { outcome: 'busy' }
  | { outcome: 'unavailable' };

/*
 * Every donation point in Australia. OpenStreetMap lists only a few dozen, so
 * the whole country stays a small file and works wherever the phone is.
 * Community pantries are tagged either way round, so both are asked for. The
 * pattern matches one whole value in a semicolon list, so "food_bank;outreach"
 * counts but "food_bank_volunteers" would not.
 */
export function buildSnapshotQuery(): string {
  return `[out:json][timeout:${QUERY_TIMEOUT_S}];area["ISO3166-1"="AU"][admin_level=2]->.au;(nwr["social_facility"~"(^|;) *(food_bank|soup_kitchen|food_sharing) *(;|$)"](area.au);nwr["amenity"="food_sharing"](area.au););out center tags;`;
}

/** Sends one query to one Overpass server. Running out of time counts as busy. */
async function askServer(server: string, query: string): Promise<DownloadResult> {
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
 * Downloads the elements for every donation point in Australia.
 *
 * Never throws. A server that refuses (406, 429 or 504 with an HTML page),
 * reports a runtime error or runs out of time counts as busy, and the next one
 * is tried. If none of them answers, the result is `busy`. With no signal, or
 * an unreadable answer from every server, it is `unavailable`.
 */
export async function fetchDonationElements(): Promise<DownloadResult> {
  let anyBusy = false;

  for (const server of OVERPASS_SERVERS) {
    const answer = await askServer(server, buildSnapshotQuery());

    if (answer.outcome === 'found') {
      return answer;
    }

    if (answer.outcome === 'busy') {
      anyBusy = true;
    }
  }

  return anyBusy ? { outcome: 'busy' } : { outcome: 'unavailable' };
}
