// Makes the presets a page offers: ready-made settings, and, for the ones
// marked `hosted`, the study itself, built here with real R and kept as a
// study file so a page opens it with no R and no wait.
//
//   presets/presets.json        written by hand: each preset's name and settings
//   presets/index.json          what a page fetches (made here)
//   presets/<id>.study.json.gz  a hosted preset's study (made here)
//
//   npm run presets            build the hosted studies and write the list
//   npm run presets:check      no R: the list and the study files agree with
//                              presets.json, and every study file opens to its key
//
// Run it again when presets.json, r/builder.R, a workflow or a copied package
// changes; the output is committed.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PRESETS_FORMAT, openStudy, readPresets, savedOf } from '../src/saved.js';
import { readSettings } from '../src/core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'presets');
const source = JSON.parse(readFileSync(path.join(folder, 'presets.json'), 'utf8')).presets;
// A hosted study is kept gzipped: its tables are text, and shrink to a twentieth.
const fileOf = (preset) => `${preset.id}.study.json.gz`;

if (process.argv.includes('--check')) {
  const problems = [];
  let listed = [];
  try {
    listed = readPresets(JSON.parse(readFileSync(path.join(folder, 'index.json'), 'utf8')));
  } catch (error) {
    problems.push(`presets/index.json cannot be read: ${error.message}`);
  }
  for (const preset of source) {
    const entry = listed.find((one) => one.id === preset.id);
    if (!entry) {
      problems.push(`presets/index.json does not list ${preset.id}: run \`npm run presets\`.`);
      continue;
    }
    const asked = JSON.stringify(readSettings(preset.settings).args);
    if (JSON.stringify(readSettings(entry.settings).args) !== asked) {
      problems.push(`${preset.id}: the list's settings are not presets.json's.`);
    }
    if (Boolean(entry.study) !== Boolean(preset.hosted)) {
      problems.push(`${preset.id}: hosted in one of the list and presets.json, and not the other.`);
    }
    if (!preset.hosted) continue;
    const file = path.join(folder, fileOf(preset));
    if (!existsSync(file)) {
      problems.push(`presets/${fileOf(preset)} is not there: run \`npm run presets\`.`);
      continue;
    }
    try {
      const document = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
      const study = await openStudy(document);
      if (study.manifest.key !== entry.key)
        problems.push(`${preset.id}: the list names another key.`);
      if (JSON.stringify(study.args) !== asked) {
        problems.push(
          `${preset.id}: its study was built with other settings: run \`npm run presets\`.`
        );
      }
    } catch (error) {
      problems.push(`presets/${fileOf(preset)}: ${error.message}`);
    }
  }
  for (const problem of problems) console.error(`✗ ${problem}`);
  if (problems.length) process.exit(1);
  console.log(
    `✓ presets/: ${source.length} presets, ${source.filter((one) => one.hosted).length} with a study that opens to its key.`
  );
  process.exit(0);
}

const { startR } = await import('./r-node.mjs');
const started = Date.now();
const { build, close } = await startR();
const presets = [];
for (const preset of source) {
  const entry = {
    id: preset.id,
    name: preset.name,
    about: preset.about,
    settings: preset.settings
  };
  if (preset.hosted) {
    const study = await build(preset.settings);
    const text = JSON.stringify(savedOf(study, { name: preset.name, about: preset.about }));
    const packed = gzipSync(Buffer.from(text), { level: 9 });
    writeFileSync(path.join(folder, fileOf(preset)), packed);
    entry.study = fileOf(preset);
    entry.key = study.manifest.key;
    entry.megabytes = Math.round((packed.length / 1e6) * 10) / 10;
    console.log(
      `✓ ${preset.id}: ${study.said} ${entry.megabytes} MB, key ${entry.key.slice(0, 19)}…`
    );
  } else console.log(`✓ ${preset.id}: settings only.`);
  presets.push(entry);
}
writeFileSync(
  path.join(folder, 'index.json'),
  `${JSON.stringify({ format: PRESETS_FORMAT, presets }, null, 2)}\n`
);
close();
console.log(`Wrote presets/ (${Math.round((Date.now() - started) / 1000)} s).`);
process.exit(0);
