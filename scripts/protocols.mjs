// Writes the ready-made protocols a page offers, each read from a public
// example with study.builder's own reader:
//
//   vendor/cdisc-ddf-ra/*.json        CDISC's five example study definitions
//                                     in USDM 4 (CC-BY-4.0)
//   protocols/*.protocol.json         each, as study.builder reads it (made here)
//
//   npm run protocols          write them
//   npm run protocols:check    the copies match their record, and the
//                              protocols are what the reader makes of them now

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { designSaid, planOf, readUsdm } from '../src/engine/protocol.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = 'vendor/cdisc-ddf-ra';
const record = JSON.parse(readFileSync(path.join(root, folder, 'SOURCE.json'), 'utf8'));
const MADE = [
  { from: 'CDISC_Pilot_Study.json', to: 'protocols/cdisc-pilot.protocol.json' },
  { from: 'devices.json', to: 'protocols/cdisc-pilot-devices.protocol.json' },
  { from: 'Alexion_NCT04573309_Wilsons.json', to: 'protocols/alexion-wilsons.protocol.json' },
  {
    from: 'EliLilly_NCT03421379_Diabetes.json',
    to: 'protocols/lilly-nasal-glucagon.protocol.json'
  },
  { from: 'observational.json', to: 'protocols/observational.protocol.json' }
];

/** What was done to CDISC's file to make a protocol here: CC-BY asks that changes are said. */
const CHANGES =
  'Changed from CDISC’s file: read by study.builder’s reader and cut down to what a simulated study follows (visits, arms, epochs, objectives, endpoints and activities). Not CDISC’s own form of the protocol, and not endorsed by CDISC or by any sponsor it names.';
const problems = [];
for (const entry of record.files) {
  const sum = createHash('sha256')
    .update(readFileSync(path.join(root, folder, entry.file)))
    .digest('hex');
  if (sum !== entry.sha256) problems.push(`${folder}/${entry.file} does not match its record.`);
}
const checking = process.argv.includes('--check');
const listed = [];
for (const { from, to } of MADE) {
  const protocol = readUsdm(readFileSync(path.join(root, folder, from), 'utf8'));
  // Where it came from, for whoever opens the file.
  protocol.source = {
    ...protocol.source,
    file: `${record.repository} · ${from}`,
    repository: record.repository,
    commit: record.commit,
    path: record.files.find((entry) => entry.file === from).source,
    license: record.license,
    license_url: record.license_url,
    attribution: record.attribution,
    changes: CHANGES
  };
  const text = `${JSON.stringify(protocol, null, 2)}\n`;
  const plan = planOf(protocol);
  const at = new Set(Object.values(protocol.schedule).flat());
  const scheduled = protocol.activities.filter((activity) => at.has(activity.id));
  listed.push({
    id: path.basename(to, '.protocol.json'),
    file: path.basename(to),
    name: protocol.name,
    title: protocol.title,
    phase: protocol.phase,
    indication: protocol.indication,
    participants: protocol.participants,
    arms: protocol.arms,
    visits: protocol.visits.length,
    days: [protocol.visits[0].day, protocol.visits.at(-1).day],
    activities: scheduled.length,
    simulated: scheduled.filter((activity) => activity.domain).length,
    vitals: plan.filter((visit) => visit.vs).length,
    labs: plan.filter((visit) => visit.lb.length).length,
    design: designSaid(protocol),
    notes: protocol.notes || [],
    source: from,
    license: record.license,
    license_url: record.license_url,
    attribution: record.attribution,
    changes: CHANGES
  });
  if (checking) {
    let current = '';
    try {
      current = readFileSync(path.join(root, to), 'utf8');
    } catch {
      // Not written yet.
    }
    if (current !== text) problems.push(`${to} is out of date: run \`npm run protocols\`.`);
  } else {
    writeFileSync(path.join(root, to), text);
    console.log(
      `✓ Wrote ${to}: ${protocol.visits.length} visits, ${protocol.activities.length} activities`
    );
  }
}
// The list a page shows of them: each with what it comes to, counted.
const listText = `${JSON.stringify(listed, null, 2)}\n`;
if (checking) {
  let current = '';
  try {
    current = readFileSync(path.join(root, 'protocols/index.json'), 'utf8');
  } catch {
    // Not written yet.
  }
  if (current !== listText)
    problems.push('protocols/index.json is out of date: run `npm run protocols`.');
} else writeFileSync(path.join(root, 'protocols/index.json'), listText);
for (const problem of problems) console.error(`✗ ${problem}`);
if (problems.length) process.exit(1);
if (checking) console.log('✓ protocols/ is what the reader makes of the copied examples.');
