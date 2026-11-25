// Writes src/files.js: the list of copied files R is given, read from the
// records of the copies (vendor/*/SOURCE.json), so the bundle knows what to
// fetch without a request for a listing. Also holds every copied file to its
// record's checksum.
//
//   node scripts/files.mjs           write src/files.js
//   node scripts/files.mjs --check   fail if it is out of date, or a copied
//                                    file does not match its record

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const record = (directory) =>
  JSON.parse(readFileSync(path.join(root, directory, 'SOURCE.json'), 'utf8'));

/** The copies R is given files of, each with the files R does not read. */
export const COPIES = [
  { directory: 'vendor/gsm.datasim', skip: ['LICENSE.md'] },
  { directory: 'vendor/gsm.mapping-vitals', skip: [] }
];

/** Every way a copied file differs from its record; an empty list means none does. */
export function copyProblems() {
  const problems = [];
  for (const { directory } of COPIES) {
    for (const entry of record(directory).files) {
      const file = path.join(root, directory, entry.file);
      let bytes;
      try {
        bytes = readFileSync(file);
      } catch {
        problems.push(`${directory}/${entry.file} is in the record and not in the folder.`);
        continue;
      }
      const sum = createHash('sha256').update(bytes).digest('hex');
      if (sum !== entry.sha256) {
        problems.push(`${directory}/${entry.file} does not match its record's checksum.`);
      }
    }
  }
  return problems;
}

/** study.builder's own workflow files, by layer folder, as R is given them. */
export function workflowFiles() {
  const folder = path.join(root, 'workflows');
  return readdirSync(folder)
    .sort()
    .flatMap((layer) =>
      readdirSync(path.join(folder, layer))
        .filter((file) => file.endsWith('.yaml'))
        .sort()
        .map((file) => `workflows/${layer}/${file}`)
    );
}

/** The text of src/files.js. */
export function filesModule() {
  const [simulator, vitals] = COPIES.map(({ directory, skip }) =>
    record(directory)
      .files.map((entry) => entry.file)
      .filter((file) => !skip.includes(file))
      .map((file) => `${directory}/${file}`)
  );
  const versions = Object.fromEntries(
    COPIES.map(({ directory }) => {
      const { repository, tag, commit } = record(directory);
      return [directory, { repository, tag, commit }];
    })
  );
  return (
    '// Written by scripts/files.mjs from the records of the copies (vendor/*/SOURCE.json).\n' +
    '// Do not edit: run `npm run files`.\n\n' +
    '/** gsm.datasim’s own files that R reads, by their path under study.builder’s address. */\n' +
    `export const SIMULATOR_FILES = ${JSON.stringify(simulator, null, 2)};\n\n` +
    '/** gsm.mapping’s vital signs mapping workflow. */\n' +
    `export const VITALS_FILE = ${JSON.stringify(vitals[0])};\n\n` +
    '/** study.builder’s own workflows, which build the layers off raw. */\n' +
    `export const WORKFLOW_FILES = ${JSON.stringify(workflowFiles(), null, 2)};\n\n` +
    '/** What each copy was copied from. */\n' +
    `export const COPIED_FROM = ${JSON.stringify(versions, null, 2)};\n`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = path.join(root, 'src/files.js');
  const text = filesModule();
  const problems = copyProblems();
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      // Not written yet: out of date.
    }
    if (current !== text) problems.push('src/files.js is out of date: run `npm run files`.');
    for (const problem of problems) console.error(`✗ ${problem}`);
    if (problems.length) process.exit(1);
    console.log('✓ src/files.js matches the records, and every copied file matches its record.');
  } else {
    writeFileSync(target, text);
    console.log('✓ Wrote src/files.js');
    for (const problem of problems) console.error(`✗ ${problem}`);
    if (problems.length) process.exit(1);
  }
}
