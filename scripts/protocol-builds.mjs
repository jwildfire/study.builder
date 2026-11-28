// Builds the study kept for each ready-made protocol, with real R, so a page
// opens it with no R and no wait: what `npm run presets` does for the presets.
//
//   protocols/builds.json           written by hand: each protocol's build settings
//   protocols/built.json            what was built (made here): file, key, settings
//   protocols/<id>.study.json.gz    the study (made here)
//
//   npm run protocols:build         build every study and write the list
//   npm run protocols:build:check   no R: the list and the study files agree with
//                                   builds.json, and every study file opens to its key
//
// A build's settings are the ones the builder's form has after it takes the
// protocol (`protocolSettings`, with the builder's usual domains), with
// builds.json's laid over them. Run it again when
// builds.json, a protocol file, r/builder.R, a workflow or a copied package
// changes; the output is committed. The feed (`npm run studies`) gives each
// protocol's entry its build from built.json.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { openStudy, savedOf } from '../src/engine/saved.js';
import { DEFAULT_DOMAINS, LIMITS, readSettings } from '../src/engine/core.js';
import { protocolSettings } from '../src/engine/protocol.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'protocols');
const read = (name) => JSON.parse(readFileSync(path.join(folder, name), 'utf8'));
const listed = read('index.json');
const fileOf = (id) => `${id}.study.json.gz`;

// What each build is asked for: the protocol's own settings, then builds.json's.
const source = read('builds.json').builds.map((build) => {
  const entry = listed.find((one) => one.id === build.id);
  if (!entry) throw new Error(`protocols/builds.json names ${build.id}, which is not a protocol.`);
  const protocol = read(entry.file);
  const taken = protocolSettings(protocol, LIMITS).settings;
  // As in the form: the builder's usual domains, with those the schedule needs.
  const domains = [...new Set([...DEFAULT_DOMAINS, ...(taken.domains || [])])];
  const settings = { ...taken, domains, ...build.settings };
  return { id: build.id, name: entry.name, settings, asked: { ...settings, protocol } };
});

if (process.argv.includes('--check')) {
  const problems = [];
  let built = [];
  try {
    built = read('built.json').builds;
  } catch (error) {
    problems.push(`protocols/built.json cannot be read: ${error.message}`);
  }
  for (const extra of built.filter((one) => !source.some((build) => build.id === one.id))) {
    problems.push(`protocols/built.json lists ${extra.id}, which builds.json does not.`);
  }
  for (const build of source) {
    const entry = built.find((one) => one.id === build.id);
    if (!entry) {
      problems.push(
        `protocols/built.json does not list ${build.id}: run \`npm run protocols:build\`.`
      );
      continue;
    }
    if (JSON.stringify(entry.settings) !== JSON.stringify(build.settings)) {
      problems.push(`${build.id}: the list's settings are not what builds.json asks for.`);
    }
    const file = path.join(folder, fileOf(build.id));
    if (!existsSync(file)) {
      problems.push(`protocols/${fileOf(build.id)} is not there: run \`npm run protocols:build\`.`);
      continue;
    }
    try {
      const document = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
      const study = await openStudy(document);
      if (study.manifest.key !== entry.key)
        problems.push(`${build.id}: the list names another key.`);
      if (JSON.stringify(study.args) !== JSON.stringify(readSettings(build.asked).args)) {
        problems.push(
          `${build.id}: its study was built with other settings, or on another protocol file: run \`npm run protocols:build\`.`
        );
      }
    } catch (error) {
      problems.push(`protocols/${fileOf(build.id)}: ${error.message}`);
    }
  }
  for (const problem of problems) console.error(`✗ ${problem}`);
  if (problems.length) process.exit(1);
  console.log(`✓ protocols/: ${source.length} protocols, each with a study that opens to its key.`);
  process.exit(0);
}

const only = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const { startR } = await import('./r-node.mjs');
const started = Date.now();
const { build: run, close } = await startR();
let before = [];
try {
  before = read('built.json').builds;
} catch {
  // Not written yet.
}
const builds = [];
for (const build of source) {
  const kept = before.find((one) => one.id === build.id);
  if (only.length && !only.includes(build.id) && kept) {
    builds.push(kept);
    continue;
  }
  const from = Date.now();
  const study = await run(build.asked);
  const about = `Simulated on the schedule of the example protocol ${build.name}. Every row is synthetic.`;
  const text = JSON.stringify(savedOf(study, { name: build.settings.name, about }));
  const packed = gzipSync(Buffer.from(text), { level: 9 });
  writeFileSync(path.join(folder, fileOf(build.id)), packed);
  const megabytes = Math.round((packed.length / 1e6) * 10) / 10;
  builds.push({
    id: build.id,
    study: fileOf(build.id),
    key: study.manifest.key,
    megabytes,
    settings: build.settings
  });
  console.log(
    `✓ ${build.id}: ${study.said} ${megabytes} MB, key ${study.manifest.key.slice(0, 19)}…, ${Math.round((Date.now() - from) / 1000)} s`
  );
}
writeFileSync(path.join(folder, 'built.json'), `${JSON.stringify({ builds }, null, 2)}\n`);
close();
console.log(`Wrote protocols/ (${Math.round((Date.now() - started) / 1000)} s).`);
process.exit(0);
