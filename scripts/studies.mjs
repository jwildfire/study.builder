// Writes the studies feed: one list of every study a reader can have, for a
// page or a program that is not study.builder.
//
//   presets/index.json         the ready-made studies and settings (npm run presets)
//   protocols/index.json       the ready-made protocols (npm run protocols)
//   studies/index.json         the feed, made here from the two
//   studies/studies.schema.json  the feed's format, written by hand
//
//   npm run studies          write the feed
//   npm run studies:check    the feed is what the two lists make it now, and
//                            every file it names matches its checksum
//
// An id is `preset:<id>` or `protocol:<id>`, as in this site's addresses. An id
// is never used again for another study.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIES_FORMAT, factsLine, readStudies } from '../src/engine/studies.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const fileOf = (folder, name) => {
  const bytes = readFileSync(path.join(root, folder, name));
  return {
    url: `../${folder}/${name}`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length
  };
};

const studies = [];
for (const preset of read('presets/index.json').presets) {
  const settings = preset.settings;
  const kind = preset.study ? 'study' : 'settings';
  const entry = {
    id: `preset:${preset.id}`,
    kind,
    name: preset.name,
    about: preset.about || '',
    facts: {
      study: settings.name,
      phase: settings.phase,
      area: settings.area,
      participants: settings.participants,
      sites: settings.sites,
      months: settings.months,
      snapshots: settings.snapshots === 'all' ? settings.months : 1,
      ...(settings.protocol ? { protocol: settings.protocol.name } : {})
    }
  };
  entry.line = factsLine(entry);
  if (kind === 'study') entry.file = { ...fileOf('presets', preset.study), key: preset.key };
  else entry.settings = settings;
  studies.push(entry);
}
for (const protocol of read('protocols/index.json')) {
  const entry = {
    id: `protocol:${protocol.id}`,
    kind: 'protocol',
    name:
      protocol.title && protocol.title !== protocol.name
        ? `${protocol.title} (${protocol.name})`
        : protocol.name,
    about: `${protocol.activities} activities scheduled, ${protocol.simulated} simulated. From CDISC DDF-RA, ${protocol.source}.`,
    facts: {
      phase: protocol.phase,
      indication: protocol.indication,
      participants: protocol.participants ? Number(protocol.participants) : null,
      arms: protocol.arms.length,
      visits: protocol.visits
    }
  };
  entry.line = factsLine(entry);
  entry.file = fileOf('protocols', protocol.file);
  studies.push(entry);
}

const feed = { format: STUDIES_FORMAT, studies };
const text = `${JSON.stringify(feed, null, 2)}\n`;
const problems = [];
// What is written must read back whole: every entry kept, every id once.
const back = readStudies(feed, 'https://example.org/studies/index.json');
if (back.length !== studies.length) problems.push('An entry of the feed does not read back.');
// And must be what the schema says, as far as its required names go.
const schema = read('studies/studies.schema.json');
const required = schema.$defs.entry.required;
for (const entry of studies) {
  for (const name of required) {
    if (!(name in entry)) problems.push(`${entry.id} has no ${name}.`);
  }
}

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(path.join(root, 'studies/index.json'), 'utf8');
  } catch {
    // Not written yet.
  }
  if (current !== text) problems.push('studies/index.json is out of date: run `npm run studies`.');
} else {
  writeFileSync(path.join(root, 'studies/index.json'), text);
  console.log(`✓ Wrote studies/index.json: ${studies.length} studies.`);
}
for (const problem of problems) console.error(`✗ ${problem}`);
if (problems.length) process.exit(1);
if (process.argv.includes('--check')) {
  console.log(
    `✓ studies/index.json is the feed of ${studies.length} studies, each file to its checksum.`
  );
}
