/*
 * Regenerates the donation points the app ships with, from OpenStreetMap:
 *
 *   npm run snapshot:donation-points
 *
 * The app reads this file instead of asking Overpass when the tab opens,
 * because the public servers often queue a request for half a minute. Run it
 * now and then (before a release, say) and commit the result.
 *
 * Needs Node 22.18 or newer, the first to run TypeScript directly without a
 * flag; older versions stop with ERR_UNKNOWN_FILE_EXTENSION. Node can't
 * resolve the app's @/ alias, which is why it imports the utils by their paths.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { toSnapshot } from '../src/utils/overpass.ts';
import { fetchDonationElements, snapshotProblem } from '../src/utils/overpass-download.ts';

const OUTPUT = fileURLToPath(new URL('../src/data/donation-points-au.json', import.meta.url));

/** How many places the current file lists, or 0 if there is no readable file. */
function currentCount(): number {
  try {
    const { elements } = JSON.parse(readFileSync(OUTPUT, 'utf8')) as { elements?: unknown };

    return Array.isArray(elements) ? elements.length : 0;
  } catch {
    return 0;
  }
}

const result = await fetchDonationElements();

if (result.outcome === 'found') {
  const snapshot = toSnapshot(result.elements, new Date());
  const problem = snapshotProblem(snapshot.elements.length, currentCount());

  if (problem) {
    // Keep the current file, so a bad download never reaches the app.
    console.error(`${problem} Kept ${OUTPUT} as it was.`);
    process.exitCode = 1;
  } else {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`Saved ${snapshot.elements.length} donation points to ${OUTPUT}`);
  }
} else {
  // Leave the current file alone when no server answered.
  console.error(
    result.outcome === 'busy'
      ? 'Every Overpass server is busy. Try again in a few minutes.'
      : 'Could not reach Overpass. Check the connection.',
  );
  process.exitCode = 1;
}
