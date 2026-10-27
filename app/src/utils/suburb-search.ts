import suburbData from '@/data/au-suburbs.json';

/** An Australian suburb, with where it is so the list can load without a geocoder. */
export type Suburb = {
  name: string;
  state: string;
  postcode: string;
  latitude: number;
  longitude: number;
};

type Point = { latitude: number; longitude: number };

/* The JSON stores each suburb as [name, state, postcode, latitude, longitude] to keep it small. */
type SuburbTuple = [string, string, string, number, number];

const SUBURBS: Suburb[] = (suburbData.suburbs as unknown as SuburbTuple[]).map(
  ([name, state, postcode, latitude, longitude]) => ({
    name,
    state,
    postcode,
    latitude,
    longitude,
  }),
);

/** Rough distance in km. Only used to put nearer suburbs first, so it needn't be exact. */
function roughKm(a: Point, b: Point): number {
  const x =
    (b.longitude - a.longitude) * Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
  const y = b.latitude - a.latitude;

  return Math.sqrt(x * x + y * y) * 111.32;
}

/**
 * Suburbs whose name starts with what was typed, e.g. "mar" or "newtown n".
 * The ones nearest `near` come first, so "Mar" in Sydney shows Marrickville
 * before a Maryborough in Queensland. Nothing until two letters are typed.
 */
export function findSuburbs(text: string, near: Point | null, limit = 5): Suburb[] {
  const typed = text.trim().toLowerCase().replace(/\s+/g, ' ');

  if (typed.length < 2) {
    return [];
  }

  const found = SUBURBS.filter((suburb) =>
    `${suburb.name} ${suburb.state}`.toLowerCase().startsWith(typed),
  );

  if (near) {
    found.sort((a, b) => roughKm(near, a) - roughKm(near, b));
  }

  return found.slice(0, limit);
}
