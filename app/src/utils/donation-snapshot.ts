import {
  type DonationPoint,
  type DonationSnapshot,
  type OverpassElement,
  toDonationPoints,
} from '@/utils/overpass';

const ELEMENT_TYPES: OverpassElement['type'][] = ['node', 'way', 'relation'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** One saved element, or null if it can't be read back as one. */
function parseElement(value: unknown): OverpassElement | null {
  if (
    !isRecord(value) ||
    !ELEMENT_TYPES.includes(value.type as OverpassElement['type']) ||
    typeof value.id !== 'number' ||
    !isCoordinate(value.lat) ||
    !isCoordinate(value.lon) ||
    !isRecord(value.tags)
  ) {
    return null;
  }

  const tags: Record<string, string> = {};

  for (const [key, tag] of Object.entries(value.tags)) {
    if (typeof tag === 'string') {
      tags[key] = tag;
    }
  }

  return {
    type: value.type as OverpassElement['type'],
    id: value.id,
    lat: value.lat,
    lon: value.lon,
    tags,
  };
}

/**
 * Reads the bundled snapshot. Returns null when it has no usable date or no
 * element list, so the screen can say so instead of crashing. Single elements
 * that can't be read are dropped rather than losing the whole list.
 */
export function parseSnapshot(value: unknown): DonationSnapshot | null {
  if (
    !isRecord(value) ||
    typeof value.fetchedAt !== 'string' ||
    Number.isNaN(Date.parse(value.fetchedAt)) ||
    !Array.isArray(value.elements)
  ) {
    return null;
  }

  return {
    fetchedAt: value.fetchedAt,
    elements: value.elements
      .map(parseElement)
      .filter((element): element is OverpassElement => element !== null),
  };
}

/** Donation points in the snapshot within `radiusKm` of a place, closest first. */
export function pointsNear(
  snapshot: DonationSnapshot,
  latitude: number,
  longitude: number,
  radiusKm: number,
): DonationPoint[] {
  return toDonationPoints(snapshot.elements, latitude, longitude).filter(
    (point) => point.distanceKm <= radiusKm,
  );
}
