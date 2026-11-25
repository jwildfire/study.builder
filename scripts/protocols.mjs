// Writes the ready-made protocols a page offers, each read from a public
// example with study.builder's own reader:
//
//   vendor/cdisc-ddf-ra/CDISC_Pilot_Study.json   CDISC's pilot study as a USDM
//                                                study definition (CC-BY-4.0)
//   protocols/cdisc-pilot.protocol.json          the same, as study.builder
//                                                reads it (made here)
//
//   npm run protocols          write them
//   npm run protocols:check    the copies match their record, and the
//                              protocols are what the reader makes of them now

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readUsdm } from '../src/engine/protocol.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = 'vendor/cdisc-ddf-ra';
const record = JSON.parse(readFileSync(path.join(root, folder, 'SOURCE.json'), 'utf8'));
const MADE = [{ from: 'CDISC_Pilot_Study.json', to: 'protocols/cdisc-pilot.protocol.json' }];

const problems = [];
for (const entry of record.files) {
  const sum = createHash('sha256')
    .update(readFileSync(path.join(root, folder, entry.file)))
    .digest('hex');
  if (sum !== entry.sha256) problems.push(`${folder}/${entry.file} does not match its record.`);
}
const checking = process.argv.includes('--check');
for (const { from, to } of MADE) {
  const protocol = readUsdm(readFileSync(path.join(root, folder, from), 'utf8'));
  // Where it came from, for whoever opens the file.
  protocol.source = {
    ...protocol.source,
    file: `${record.repository} · ${from}`,
    license: record.license
  };
  const text = `${JSON.stringify(protocol, null, 2)}\n`;
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
for (const problem of problems) console.error(`✗ ${problem}`);
if (problems.length) process.exit(1);
if (checking) console.log('✓ protocols/ is what the reader makes of the copied examples.');
