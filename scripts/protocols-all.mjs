// Runs every USDM example it is pointed at through the reader and what follows
// it, and says what each came to. It is how the reader is held to more than
// the one protocol it was written on.
//
//   node scripts/protocols-all.mjs <folder or file> [...]   a line a file
//   node scripts/protocols-all.mjs --json <folder>          the same, as JSON
//
// With nothing named it reads the copies in vendor/cdisc-ddf-ra.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  designSaid,
  efficacyOf,
  isUsdm,
  planOf,
  protocolSettings,
  readUsdm
} from '../src/engine/protocol.js';
import { LIMITS, readSettings } from '../src/engine/core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every JSON file under a path. */
function filesUnder(at) {
  if (statSync(at).isFile()) return at.endsWith('.json') ? [at] : [];
  return readdirSync(at)
    .filter((name) => name !== '.git' && name !== 'node_modules')
    .flatMap((name) => filesUnder(path.join(at, name)));
}

/**
 * What one file comes to: read or refused, and what was read.
 * @param {string} file The file's path.
 * @returns {?Object} The line, or null when the file is not a USDM study definition.
 */
export function tried(file) {
  let document;
  try {
    document = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  if (!isUsdm(document)) return null;
  const line = { file: path.basename(file), version: document.usdmVersion || '' };
  try {
    const protocol = readUsdm(document);
    const filled = protocolSettings(protocol, LIMITS);
    const read = readSettings({ ...filled.settings, protocol });
    const plan = planOf(protocol);
    const at = new Set(Object.values(protocol.schedule).flat());
    const scheduled = protocol.activities.filter((activity) => at.has(activity.id));
    const design = designSaid(protocol);
    const efficacy = efficacyOf(protocol);
    return {
      ...line,
      read: true,
      name: protocol.name,
      timeline: protocol.source.timeline,
      visits: protocol.visits.length,
      days: [protocol.visits[0].day, protocol.visits.at(-1).day],
      activities: scheduled.length,
      simulated: scheduled.filter((activity) => activity.domain).length,
      vitals: plan.filter((visit) => visit.vs).length,
      labs: plan.filter((visit) => visit.lb.length).length,
      arms: protocol.arms.length,
      design,
      efficacy: efficacy ? efficacy.name : null,
      builds: read.problems.length === 0,
      problems: read.problems,
      notes: [...filled.notes, ...(protocol.notes || [])]
    };
  } catch (error) {
    return { ...line, read: false, said: error && error.message ? error.message : String(error) };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const asked = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const places = asked.length ? asked : [path.join(root, 'vendor/cdisc-ddf-ra')];
  const lines = places.flatMap(filesUnder).map(tried).filter(Boolean);
  if (process.argv.includes('--json')) console.log(JSON.stringify(lines, null, 2));
  else {
    for (const line of lines) {
      console.log(
        line.read
          ? `${line.builds ? '✓' : '✗'} ${line.file} (USDM ${line.version}): ${line.visits} visits, day ${line.days[0]} to ${line.days[1]}; ${line.activities} activities, ${line.simulated} simulated; ${line.arms} arms; design ${line.design ? `${line.design.objectives} objectives, ${line.design.endpoints} endpoints, ${line.design.estimands} estimands` : 'none'}; score ${line.efficacy || 'none'}${line.problems.length ? `; ${line.problems.join(' ')}` : ''}${line.notes.length ? `\n    ${line.notes.join('\n    ')}` : ''}`
          : `✗ ${line.file} (USDM ${line.version}): ${line.said}`
      );
    }
    const good = lines.filter((line) => line.read && line.builds).length;
    console.log(`${good} of ${lines.length} read and would build.`);
  }
}
