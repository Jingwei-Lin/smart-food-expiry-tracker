/*
 * Regenerates the donation points the app ships with, from OpenStreetMap:
 *
 *   npm run snapshot:donation-points
 *
 * The app reads this file instead of asking Overpass when the tab opens,
 * because the public servers often queue a request for half a minute. Run it
 * now and then (before a release, say) and commit the result.
 *
 * Node runs this TypeScript directly, but can't resolve the app's @/ alias,
 * which is why it imports the utils by their paths.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { toSnapshot } from '../src/utils/overpass.ts';
import { fetchDonationElements } from '../src/utils/overpass-download.ts';

const OUTPUT = fileURLToPath(new URL('../src/data/donation-points-au.json', import.meta.url));

const result = await fetchDonationElements();

if (result.outcome === 'found') {
  const snapshot = toSnapshot(result.elements, new Date());

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Saved ${snapshot.elements.length} donation points to ${OUTPUT}`);
} else {
  // Leave the current file alone, so a failed run never ships an empty list.
  console.error(
    result.outcome === 'busy'
      ? 'Every Overpass server is busy. Try again in a few minutes.'
      : 'Could not reach Overpass. Check the connection.',
  );
  process.exitCode = 1;
}
