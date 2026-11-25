// Builds studies with real R: webR under Node, given exactly what a page's R
// is given (`rOptions`), calling `builder_run` as a page does. The unit tests
// use a stand-in for R; this is the check that R, gsm.datasim and r/builder.R
// still work together.
//
//   npm run test:r
//
// It downloads R and its packages (about 55 MB) from webr.r-wasm.org and
// repo.r-wasm.org, and serves gsm's own packages from vendor/ on this machine.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMAINS } from '../src/engine/core.js';
import { startR } from './r-node.mjs';
import { firstRows } from '../src/shared/csv.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (what, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `: ${detail}`}`);
  if (!ok) failures.push(what);
};

const started = Date.now();
const { build, webR, close } = await startR();
console.log(`R is ready (${Math.round((Date.now() - started) / 1000)} s).`);

const rowsOf = (study, id) => (study.domains.find((domain) => domain.id === id) || {}).rows;

// 1. The default study.
const first = await build({ seed: 7 });
check(
  'the default study has the four core domains and the eight default ones',
  first.domains.length === 12,
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
  'five standard tables: participants, adverse events, ECGs, labs and vitals; labs and vitals are handed over as one file',
  first.standard.map((file) => file.id).join() === 'subject,ae,eg,bds,bds' &&
    first
      .files()
      .standard.map((file) => file.name)
      .join() === 'adsl.csv,adae.csv,adeg.csv,adlb-advs.csv'
);
check(
  'every standard column has a line saying where it came from',
  first.standard.every(
    (file) =>
      file.mapping.map((line) => line.column).join() ===
      file.columns.map((column) => column.name).join()
  )
);
const vitals = first.standard.find((file) => file.name === 'advs.csv');
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
  'five layers: raw, Raw.RBQM, ADaM, Analysis and Reporting',
  first.layers.map((layer) => layer.id).join() === 'raw,raw.rbqm,adam,analysis,reporting'
);
const rbqm = first.layers[1].tables;
check(
  'Raw.RBQM has a mapped table for each raw domain and one of countries, by gsm.mapping workflows',
  rbqm.length === 12 &&
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
  'ADaM is ADSL, ADAE, ADEG, ADLB and ADVS, each built by its workflow from raw and ADSL',
  first.layers[2].tables.map((table) => table.id).join() === 'ADSL,ADAE,ADEG,ADLB,ADVS' &&
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
  first.manifest.tables.length ===
    first.layers.reduce((sum, layer) => sum + layer.tables.length, 0) &&
    first.manifest.tables.every((table) => /^[0-9a-f]{64}$/.test(table.sha256)),
  String(first.manifest.tables.length)
);

// Analysis and reporting.
const analysis = first.layers[3].tables;
check(
  "Analysis has gsm's eight site metrics, each a summary by site and the input it counted from",
  analysis.filter((table) => /^kri\d+$/.test(table.id)).length === 8 &&
    analysis.filter((table) => /^kri\d+_input$/.test(table.id)).length === 8,
  analysis.map((table) => table.id).join(' ')
);
check(
  'a site metric reads Raw.RBQM, and says so',
  first.table('analysis', 'kri0001').made.from.join() === 'Mapped_AE,Mapped_SUBJ'
);
const summary = firstRows(first.table('analysis', 'AESummary').text, 100);
check(
  'the adverse event summary reads ADaM, and its events add up to the events in ADAE',
  first.table('analysis', 'AESummary').made.from.join() === 'ADaM_ADAE,ADaM_ADSL' &&
    summary.rows.reduce((sum, row) => sum + Number(row[2]), 0) === first.table('adam', 'ADAE').rows
);
check(
  'Reporting has Results, Bounds, Groups and Metrics',
  first.layers[4].tables
    .map((table) => table.id)
    .sort()
    .join() === 'Bounds,Groups,Metrics,Results'
);
const results = firstRows(first.table('reporting', 'Results').text, 5000);
const metricAt = results.header.indexOf('MetricID');
check(
  'Results has a row for each site of each of the eight metrics',
  new Set(results.rows.map((row) => row[metricAt])).size === 8,
  [...new Set(results.rows.map((row) => row[metricAt]))].join(' ')
);

// The metadata: every key it names is a key of the data.
const broken = [];
for (const spec of first.metadata.tables.filter((one) => one.keys.length)) {
  const table = first.table(spec.layer, spec.id);
  const { header, rows } = firstRows(table.text, Infinity);
  const at = spec.keys.map((key) => header.indexOf(key));
  const seen = new Set(rows.map((row) => at.map((index) => row[index]).join('\u0001')));
  if (at.includes(-1) || seen.size !== rows.length) broken.push(`${spec.layer}:${spec.id}`);
}
check(
  'every key the metadata names has one row for each of its values',
  broken.length === 0 && first.metadata.tables.filter((one) => one.keys.length).length >= 20,
  broken.join(' ')
);
const joins = first.metadata.tables.flatMap((spec) =>
  spec.columns.filter((column) => column.joins).map((column) => ({ spec, column }))
);
check(
  'every join the metadata names is to a column the other table has',
  joins.length > 20 &&
    joins.every(({ column }) =>
      first
        .table(column.joins.layer, column.joins.id)
        .columns.some((other) => other.name === column.joins.column)
    ),
  String(joins.length)
);
check(
  "every ADaM and analysis column of study.builder's own has a label",
  [...first.layers[2].tables, first.table('analysis', 'AESummary')].every((table) =>
    first.spec(table.layer, table.id).columns.every((column) => column.label)
  )
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
const reportingOnly = await build({
  participants: 60,
  sites: 6,
  months: 4,
  seed: 1,
  domains: ['AE', 'PD'],
  layers: ['reporting']
});
check(
  'asking for reporting alone brings the layers it is made from, and only the metrics the domains allow',
  reportingOnly.layers.map((layer) => layer.id).join() === 'raw,raw.rbqm,adam,analysis,reporting' &&
    reportingOnly.layers[3].tables.filter((table) => /^kri\d+$/.test(table.id)).length === 5,
  reportingOnly.layers[3].tables.map((table) => table.id).join(' ')
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

// A protocol's schedule: the CDISC pilot study, read from its USDM file.
const { planOf, protocolSettings, readUsdm } = await import('../src/engine/protocol.js');
const { LIMITS } = await import('../src/engine/core.js');
const protocol = readUsdm(
  readFileSync(path.join(root, 'vendor/cdisc-ddf-ra/CDISC_Pilot_Study.json'), 'utf8')
);
const planned = planOf(protocol);
const scheduled = await build({
  ...protocolSettings(protocol, LIMITS).settings,
  domains: ['VISIT', 'VS', 'LB', 'AE'],
  participants: 60,
  sites: 6,
  seed: 11,
  protocol
});
const visitRows = firstRows(scheduled.table('raw', 'VISIT').text, Infinity);
const visitAt = visitRows.header.indexOf('visit');
const visitNames = new Set(visitRows.rows.map((row) => row[visitAt]));
check(
  'with a protocol, every visit made is one the schedule names, and the early ones are all there',
  [...visitNames].every((name) => planned.some((visit) => visit.name === name)) &&
    ['Screening 1', 'Baseline', 'Week 2'].every((name) => visitNames.has(name)),
  [...visitNames].join(', ')
);
const subjRows = firstRows(scheduled.table('raw', 'SUBJ').text, Infinity);
const dateOf = Object.fromEntries(
  subjRows.rows.map((row) => [
    row[subjRows.header.indexOf('subjid')],
    row[subjRows.header.indexOf('firstdosedate')] || row[subjRows.header.indexOf('enrolldt')]
  ])
);
const [subjAt, dateAt] = ['subjid', 'visit_dt'].map((name) => visitRows.header.indexOf(name));
const lateness = visitRows.rows
  .filter((row) => dateOf[row[subjAt]])
  .map((row) => {
    const visit = planned.find((one) => one.name === row[visitAt]);
    const days = Math.round((new Date(row[dateAt]) - new Date(dateOf[row[subjAt]])) / 864e5);
    const offset = visit.day > 0 ? visit.day - 1 : visit.day;
    return days - offset >= -visit.before && days - offset <= visit.after;
  });
check(
  'every visit of an enrolled participant is on its planned day, within its window',
  lateness.length > 0 && lateness.every(Boolean),
  `${lateness.filter((ok) => !ok).length} of ${lateness.length} outside`
);
const vsRows = firstRows(scheduled.table('raw', 'VS').text, Infinity);
const vsVisits = new Set(vsRows.rows.map((row) => row[vsRows.header.indexOf('visit')]));
check(
  'vital signs are taken only at the visits the schedule takes them',
  [...vsVisits].every((name) => planned.find((visit) => visit.name === name).vs) &&
    !vsVisits.has('Week 8 Home'),
  [...vsVisits].join(', ')
);
const lbRows = firstRows(scheduled.table('raw', 'LB').text, Infinity);
const lbAt = ['visnam', 'battrnam', 'lbtstnam'].map((name) => lbRows.header.indexOf(name));
const chemistry = new Set(
  lbRows.rows.filter((row) => row[lbAt[1]] === 'CHEMISTRY').map((row) => row[lbAt[2]])
);
check(
  'labs are drawn where the schedule draws them: chemistry has the seven tests the protocol lists, and Screening 2 has none',
  chemistry.size === 7 &&
    !lbRows.rows.some((row) => row[lbAt[0]] === 'Screening 2') &&
    lbRows.rows.some((row) => row[lbAt[1]] === 'HEMATOLOGY'),
  `${chemistry.size} chemistry tests`
);
check(
  'the study keeps its protocol, says so in its notes, and still builds every layer',
  scheduled.protocol.visits.length === 16 &&
    scheduled.notes.some((note) =>
      /follow the protocol's schedule: 16 planned visits/.test(note)
    ) &&
    scheduled.layers.length === 5 &&
    scheduled.table('adam', 'ADVS').rows > 0 &&
    scheduled.table('reporting', 'Results').rows > 0
);

// A saved study opens to the study it was saved from, with no R.
const { openStudy, savedOf } = await import('../src/engine/saved.js');
const reopened = await openStudy(JSON.parse(JSON.stringify(savedOf(first))));
check(
  'a saved study opens to the same key, metadata and files',
  reopened.manifest.key === first.manifest.key &&
    JSON.stringify(reopened.metadata) === JSON.stringify(first.metadata) &&
    JSON.stringify(reopened.files()) === JSON.stringify(first.files())
);
// A hosted preset is the study its settings build today.
const { gunzipSync } = await import('node:zlib');
const hosted = JSON.parse(readFileSync(path.join(root, 'presets/index.json'), 'utf8')).presets.find(
  (preset) => preset.study
);
const rebuilt = await build(hosted.settings);
const kept = await openStudy(
  JSON.parse(gunzipSync(readFileSync(path.join(root, 'presets', hosted.study))).toString('utf8'))
);
check(
  `the hosted preset ${hosted.id} is the study its settings build`,
  rebuilt.manifest.key === hosted.key && kept.manifest.key === hosted.key,
  `${rebuilt.manifest.key} built, ${hosted.key} listed`
);

close();
if (failures.length) {
  console.error(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed.`);
  process.exit(1);
}
console.log(`\nEvery check passed (${Math.round((Date.now() - started) / 1000)} s).`);
process.exit(0);
