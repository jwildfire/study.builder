// Builds studies with real R: webR under Node, given exactly what a page's R
// is given (`rOptions`), calling `builder_run` as a page does. The unit tests
// use a stand-in for R; this is the check that R, gsm.datasim and r/builder.R
// still work together.
//
//   npm run test:r
//
// It downloads R and its packages (about 55 MB) from webr.r-wasm.org and
// repo.r-wasm.org, and serves gsm's own packages from vendor/ on this machine.

import { WebR } from 'webr';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGES, PUBLIC_INDEX, rOptions, studyOf } from '../src/build.js';
import { DOMAINS, readSettings } from '../src/core.js';
import { foldersOf } from '../src/r.js';
import { firstRows } from '../src/csv.js';
import { manifestOf } from '../src/manifest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (what, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `: ${detail}`}`);
  if (!ok) failures.push(what);
};

// gsm's own packages, served as a package repository.
const repo = path.join(root, 'vendor/r-wasm/repo');
const server = http.createServer((request, response) => {
  const file = path.join(repo, decodeURIComponent(request.url.split('?')[0]));
  if (!file.startsWith(repo) || !existsSync(file)) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200);
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const repository = `http://127.0.0.1:${server.address().port}`;

const started = Date.now();
const webR = new WebR({ interactive: false });
await webR.init();
await webR.installPackages([...PACKAGES, 'jsonlite'], {
  quiet: true,
  repos: [repository, PUBLIC_INDEX]
});
// The files a page fetches, read from the repository and written where R keeps them.
const options = rOptions('./');
for (const file of options.files) {
  for (const folder of foldersOf(file.path)) await webR.FS.mkdir(folder).catch(() => {});
  await webR.FS.writeFile(file.path, readFileSync(path.join(root, file.url)));
}
for (const source of options.source) {
  await webR.evalRVoid(`source(${JSON.stringify(source)}, local = FALSE)`);
}
console.log(`R is ready (${Math.round((Date.now() - started) / 1000)} s).`);

/** Ask R for a study as a page does, and read the answer as a page does. */
async function build(settings) {
  const read = readSettings(settings);
  if (!read.args) throw new Error(read.problems.join(' '));
  const args = {
    simulator: '/study.builder/vendor/gsm.datasim',
    ...(read.args.domains.includes('VS')
      ? { vitals: options.files.find((file) => file.path.endsWith('/VS.yaml')).path }
      : {}),
    ...(read.args.layers.includes('adam') ? { workflows: '/study.builder/workflows' } : {}),
    ...read.args,
    layers: ['raw', ...read.args.layers]
  };
  const shelter = await new webR.Shelter();
  try {
    const list = await new shelter.RList(args);
    const answer = await shelter.evalR(
      'jsonlite::toJSON(do.call(.name, .args), auto_unbox = TRUE, null = "null", na = "null", digits = NA)',
      { env: { '.name': 'builder_run', '.args': list } }
    );
    const study = studyOf(JSON.parse(await answer.toString()), read.args);
    study.manifest = await manifestOf(study);
    return study;
  } finally {
    await shelter.purge();
  }
}

const rowsOf = (study, id) => (study.domains.find((domain) => domain.id === id) || {}).rows;

// 1. The default study.
const first = await build({ seed: 7 });
check(
  'the default study has the four core domains and the seven default ones',
  first.domains.length === 11,
  first.domains.map((domain) => domain.id).join(' ')
);
check(
  'one row per participant and per site',
  rowsOf(first, 'SUBJ') === 150 && rowsOf(first, 'SITE') === 20
);
check(
  'the study table says the phase and area asked for',
  /"Oncology".*"P2"/.test(first.domains[0].text)
);
check(
  'no site id is one R would read as a number',
  !/"0X[0-9A-F]+"/i.test(first.domains.find((domain) => domain.id === 'SUBJ').text)
);
check(
  'every domain names its columns and their types',
  first.domains.every(
    (domain) =>
      domain.columns.length > 0 && domain.columns.every((column) => column.name && column.type)
  )
);
check(
  "every domain's text has the header its columns say",
  first.domains.every(
    (domain) =>
      firstRows(domain.text, 1).header.join() === domain.columns.map((column) => column.name).join()
  )
);
check(
  'three standard files: participants, adverse events, vitals',
  first.standard.map((file) => file.id).join() === 'subject,ae,bds'
);
check(
  'every standard column has a line saying where it came from',
  first.standard.every(
    (file) =>
      file.mapping.map((line) => line.column).join() ===
      file.columns.map((column) => column.name).join()
  )
);
const vitals = first.standard.find((file) => file.id === 'bds');
check(
  'the vitals file has eight vital signs',
  new Set(
    vitals.text
      .split('\n')
      .slice(1)
      .map((line) => line.split(',')[7])
  ).size >= 8
);

// The layers built off raw.
check(
  'three layers: raw, Raw.RBQM and ADaM',
  first.layers.map((layer) => layer.id).join() === 'raw,raw.rbqm,adam'
);
const rbqm = first.layers[1].tables;
check(
  'Raw.RBQM has a mapped table for each raw domain, by gsm.mapping workflows',
  rbqm.length === 11 &&
    rbqm.every(
      (table) => table.table === `Mapped_${table.id}` && table.made.workflow === table.table
    ),
  rbqm.map((table) => table.table).join(' ')
);
check(
  'the mapped vital signs carry the site, joined from the mapped participants',
  first.table('raw.rbqm', 'VS').columns.some((column) => column.name === 'invid') &&
    first.table('raw.rbqm', 'VS').made.from.includes('Mapped_SUBJ')
);
check(
  'ADaM is ADSL, ADAE and ADVS, each built by its workflow from raw and ADSL',
  first.layers[2].tables.map((table) => table.id).join() === 'ADSL,ADAE,ADVS' &&
    first.table('adam', 'ADAE').made.from.join() === 'Raw_AE,ADaM_ADSL'
);
const startDays = firstRows(first.table('adam', 'ADAE').text, 500).rows.map((row) => row[8]);
check(
  'a study day counts from day one and is never 0',
  startDays.length > 100 && !startDays.includes('0'),
  startDays.slice(0, 8).join(' ')
);
check(
  'every table of every layer is in the manifest with a checksum',
  first.manifest.tables.length === 25 &&
    first.manifest.tables.every((table) => /^[0-9a-f]{64}$/.test(table.sha256)),
  String(first.manifest.tables.length)
);

// 2. The same seed builds the same study.
const again = await build({ seed: 7 });
check(
  'the same seed builds the same study, table for table',
  again.domains.every((domain, index) => domain.text === first.domains[index].text)
);
check('and the same study has the same key', again.manifest.key === first.manifest.key);
const other = await build({ seed: 8 });
check('a different seed has a different key', other.manifest.key !== first.manifest.key);

// 3. Every optional domain.
const every = await build({
  participants: 60,
  sites: 6,
  months: 4,
  seed: 1,
  domains: DOMAINS.filter((domain) => !domain.core).map((domain) => domain.id)
});
check(
  'every one of the 19 domains can be made',
  every.domains.length === DOMAINS.length,
  every.domains.map((domain) => domain.id).join(' ')
);

// 4. One optional domain, and no table it cannot make.
const small = await build({ participants: 20, sites: 2, months: 3, domains: ['PD'] });
check(
  'a study of one optional domain has five raw tables, and only ADSL in ADaM',
  small.domains.length === 5 && small.standard.map((file) => file.id).join() === 'subject'
);
const rawOnly = await build({ participants: 20, sites: 2, months: 3, domains: ['AE'], layers: [] });
check(
  'a study asked for no layer but raw has only raw',
  rawOnly.layers.length === 1 && rawOnly.standard.length === 0
);

// 5. R refuses what the page refuses.
let refused = '';
try {
  const shelter = await new webR.Shelter();
  const list = await new shelter.RList({
    simulator: '/study.builder/vendor/gsm.datasim',
    sites: 900
  });
  await shelter.evalR('do.call(.name, .args)', { env: { '.name': 'builder_run', '.args': list } });
} catch (error) {
  refused = error.message;
}
check(
  'R refuses a number out of range, in a sentence',
  /Sites must be from 2 to 100/.test(refused),
  refused
);

server.close();
webR.close();
if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed.`);
  process.exit(1);
}
console.log(`\nEvery check passed (${Math.round((Date.now() - started) / 1000)} s).`);
process.exit(0);
