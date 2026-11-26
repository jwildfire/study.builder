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
  'no raw table holds a site id R would read as a number, in any column',
  first.domains.every((domain) => !/"0X[0-9A-F]+"/i.test(domain.text)),
  first.domains
    .filter((domain) => /"0X[0-9A-F]+"/i.test(domain.text))
    .map((domain) => domain.id)
    .join(' ')
);
check(
  'a raw table says what gsm.datasim called each column it names as gsm does',
  first.domains.some((domain) => (domain.renamed || []).length > 0) &&
    first.domains.every((domain) =>
      (domain.renamed || []).every(
        (line) => line.was && domain.columns.some((column) => column.name === line.column)
      )
    ),
  first.domains.map((domain) => `${domain.id}:${(domain.renamed || []).length}`).join(' ')
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
  'Raw.RBQM keeps only the mapped tables that differ from raw: a copy of a raw table is dropped',
  rbqm.length < 12 &&
    rbqm.length >= 4 &&
    rbqm.every(
      (table) => table.table === `Mapped_${table.id}` && table.made.workflow === table.table
    ) &&
    ['SUBJ', 'SITE', 'STUDY', 'COUNTRY'].every((id) => rbqm.some((table) => table.id === id)) &&
    !rbqm.some((table) => table.id === 'AE' || table.id === 'LB'),
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
  'a site metric reads raw where the mapped table was a copy of it, and says so',
  first.table('analysis', 'kri0001').made.from.join() === 'Raw_AE,Mapped_SUBJ',
  first.table('analysis', 'kri0001').made.from.join()
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

// 1b. Every table built by a workflow carries that workflow as it is written.
const built = first.layers.slice(1).flatMap((layer) => layer.tables);
check(
  'every table built by a workflow carries it as written: what it says of itself, its input spec and its steps',
  built.length > 0 &&
    built.every(
      (table) =>
        table.definition &&
        table.definition.meta.some((pair) => pair.key === 'ID') &&
        table.definition.steps.length > 0 &&
        table.definition.steps.every((step) => step.name)
    ),
  built
    .filter((table) => !table.definition || !table.definition.steps.length)
    .map((table) => `${table.layer}/${table.id}`)
    .join(' ')
);
check(
  'an ADaM workflow’s steps hold its queries, word for word',
  first
    .table('adam', 'ADAE')
    .definition.steps.some((step) => step.params.some((pair) => /SELECT/.test(pair.value)))
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

// 2b. Every monthly snapshot, everyMonth.
const everyMonth = await build({
  participants: 40,
  sites: 4,
  months: 4,
  seed: 7,
  snapshots: 'all'
});
const lastOnly = await build({ participants: 40, sites: 4, months: 4, seed: 7 });
check(
  'a study asked for every snapshot has one a month, oldest first',
  everyMonth.history.length === 4 &&
    everyMonth.history.every((entry, index) => entry.number === index + 1) &&
    [...everyMonth.history]
      .sort((a, b) => a.date.localeCompare(b.date))
      .every((entry, index) => entry === everyMonth.history[index]),
  everyMonth.history.map((entry) => entry.date).join(' ')
);
check(
  'every earlier snapshot was built, through every layer',
  everyMonth.history.every(
    (entry) => !entry.problem && entry.study().layers.length === everyMonth.layers.length
  ),
  everyMonth.history.map((entry) => entry.problem || 'ok').join(' | ')
);
check(
  'a snapshot never holds more participants than the one after it',
  everyMonth.history.every(
    (entry, index) =>
      index === 0 ||
      everyMonth.history[index - 1].study().table('raw', 'SUBJ').rows <=
        entry.study().table('raw', 'SUBJ').rows
  ),
  everyMonth.history.map((entry) => entry.study().table('raw', 'SUBJ').rows).join(' ')
);
check(
  'keeping the earlier snapshots leaves the last as it is with none kept',
  everyMonth.layers.every((layer, at) =>
    layer.tables.every((table, index) => table.text === lastOnly.layers[at].tables[index].text)
  ),
  everyMonth.layers
    .flatMap((layer, at) =>
      layer.tables.filter((table, index) => table.text !== lastOnly.layers[at].tables[index].text)
    )
    .map((table) => `${table.layer}/${table.id}`)
    .join(' ')
);
check(
  'and its key covers them',
  everyMonth.manifest.snapshots.length === 3 && everyMonth.manifest.key !== lastOnly.manifest.key
);

// Vital signs are gsm.datasim's own domain: what a snapshot holds of them is
// in the next one, unchanged.
const vitalsKept = (study) =>
  study.history.slice(0, -1).map((entry, index) => {
    const rows = (text) => text.trim().split('\n').slice(1);
    const now = rows(entry.study().table('raw', 'VS').text);
    const next = new Set(rows(study.history[index + 1].study().table('raw', 'VS').text));
    return `${now.filter((row) => next.has(row)).length}/${now.length}`;
  });
check(
  'a participant’s vital signs at a visit are the same in every snapshot that holds them',
  vitalsKept(everyMonth).every((said) => {
    const [kept, of] = said.split('/').map(Number);
    return of > 0 && kept === of;
  }),
  vitalsKept(everyMonth).join(' ')
);
check(
  'and no note says vital signs differ between snapshots',
  !everyMonth.notes.some((note) => /vital signs/i.test(note) && /snapshot/i.test(note))
);

// 2c. An efficacy score, on a protocol.
const pilotProtocol = JSON.parse(
  readFileSync(path.join(root, 'protocols/cdisc-pilot.protocol.json'), 'utf8')
);
const scheduledMonths = await build({
  name: 'SCHEDULED',
  participants: 60,
  sites: 6,
  months: 5,
  seed: 11,
  protocol: pilotProtocol,
  snapshots: 'all'
});
check(
  'on a protocol’s schedule too, vital signs are the same in every snapshot that holds them',
  scheduledMonths.history.every((entry) => !entry.problem) &&
    vitalsKept(scheduledMonths).every((said) => {
      const [kept, of] = said.split('/').map(Number);
      return kept === of;
    }),
  vitalsKept(scheduledMonths).join(' ')
);
const scored = await build({
  name: 'SCORED',
  participants: 300,
  sites: 20,
  months: 7,
  seed: 505,
  protocol: pilotProtocol,
  efficacy: {
    name: 'ADAS-Cog (11)',
    visits: ['Baseline', 'Week 8', 'Week 16', 'Week 24'],
    baseline: 24,
    sd: 6.5,
    change: 2.5,
    effects: { 'Xanomeline Low Dose': -1.5, 'Xanomeline High Dose': -3 },
    min: 0,
    max: 70
  }
});
const scores = firstRows(scored.table('raw', 'QS').text, Infinity);
const scoreAt = (name) => scores.header.indexOf(name);
check(
  'an efficacy score is a raw scores table: only at the visits asked for, within its range',
  scores.rows.length > 0 &&
    scores.rows.every(
      (row) =>
        ['Baseline', 'Week 8', 'Week 16', 'Week 24'].includes(row[scoreAt('visnam')]) &&
        Number(row[scoreAt('qsresn')]) >= 0 &&
        Number(row[scoreAt('qsresn')]) <= 70
    ),
  `${scores.rows.length} rows`
);
check(
  'ADQS is built from it by workflow, a row for a row, with a baseline and a change',
  scored.table('adam', 'ADQS').rows === scores.rows.length &&
    ['BASE', 'CHG', 'ABLFL'].every((column) =>
      scored.table('adam', 'ADQS').columns.some((one) => one.name === column)
    )
);
const scoreSummary = firstRows(scored.table('analysis', 'EfficacySummary').text, Infinity);
const sumAt = (name) => scoreSummary.header.indexOf(name);
const stat = (arm, visit, statistic) => {
  const found = scoreSummary.rows.find(
    (row) =>
      row[sumAt('ARM')] === arm &&
      row[sumAt('VISIT')] === visit &&
      row[sumAt('STATISTIC')] === statistic
  );
  return found ? Number(found[sumAt('VALUE')]) : null;
};
check(
  'the results table has a row a result: n, mean and sd for each arm and visit, and a difference from the reference arm',
  stat('Placebo', 'Week 8', 'n') > 0 &&
    stat('Placebo', 'Baseline', 'mean') === 0 &&
    stat('Xanomeline High Dose', 'Week 8', 'difference') !== null &&
    stat('Placebo', 'Week 8', 'difference') === null &&
    scoreSummary.rows.every((row) => row[sumAt('REFARM')] === 'Placebo'),
  scoreSummary.rows.length + ' rows'
);
check(
  'the spread of the change is about what was asked for',
  Math.abs(stat('Xanomeline High Dose', 'Week 8', 'sd') - 6.5) < 2,
  String(stat('Xanomeline High Dose', 'Week 8', 'sd'))
);
const unscored = await build({
  name: 'SCORED',
  participants: 300,
  sites: 20,
  months: 7,
  seed: 505,
  protocol: pilotProtocol
});
check(
  'a score changes no other raw table, and with none asked for there is no scores table',
  !unscored.table('raw', 'QS') &&
    unscored.domains.every((domain) => domain.text === scored.table('raw', domain.id).text)
);

// 2d. A trial that behaves like one: adverse events that follow the arm,
// participants who leave early, and a model of the efficacy score.
const trial = await build({
  name: 'TRIAL',
  participants: 500,
  sites: 30,
  months: 12,
  seed: 505,
  protocol: pilotProtocol,
  efficacy: {
    name: 'ADAS-Cog (11)',
    visits: ['Baseline', 'Week 8', 'Week 16', 'Week 24'],
    baseline: 24,
    sd: 6.5,
    change: 2.5,
    effects: { 'Xanomeline Low Dose': -1.5, 'Xanomeline High Dose': -3 },
    min: 0,
    max: 70
  },
  assumptions: { dropout: 0.3, eventRatio: 2 }
});
const rowsAs = (study, layer, id) => {
  const table = study.table(layer, id);
  if (!table) return [];
  const { header, rows } = firstRows(table.text, Infinity);
  return rows.map((row) => Object.fromEntries(header.map((name, index) => [name, row[index]])));
};
const day = (value) => String(value || '').slice(0, 10);
const trialEvents = rowsAs(trial, 'raw', 'AE');
check(
  'adverse events have terms: none is a placeholder, and there are at least 25 different ones in 10 classes',
  trialEvents.length > 0 &&
    trialEvents.every((row) => !/^(term|soc)\d/.test(row.mdrpt_nsv + row.mdrsoc_nsv)) &&
    new Set(trialEvents.map((row) => row.mdrpt_nsv)).size >= 25 &&
    new Set(trialEvents.map((row) => row.mdrsoc_nsv)).size >= 10,
  `${new Set(trialEvents.map((row) => row.mdrpt_nsv)).size} terms`
);
check(
  'a serious event is grade 3 or more, and one that is not serious is 3 or less',
  trialEvents.every((row) =>
    row.aeser === 'Y' ? Number(row.aetoxgr) >= 3 : Number(row.aetoxgr) <= 3
  )
);
// Who has left, and when: the study completion table says. Dropout is of
// enrolled participants; the simulator's rows for people who never enrolled
// are kept as they were and are not looked at here.
const enrolledIds = new Set(rowsAs(trial, 'adam', 'ADSL').map((row) => row.USUBJID));
const enrolledIn = enrolledIds.size;
const leftOn = new Map(
  rowsAs(trial, 'raw', 'STUDCOMP')
    .filter((row) => row.compyn === 'N' && enrolledIds.has(row.subjid))
    .map((row) => [row.subjid, day(row.mincreated_dts)])
);
const later = [
  ['VISIT', 'visit_dt'],
  ['LB', 'lb_dt'],
  ['VS', 'vs_dt'],
  ['EG', 'eg_dt'],
  ['QS', 'qs_dt'],
  ['PD', 'dvdtm'],
  ['AE', 'aest_dt']
].map(([id, column]) => [
  id,
  rowsAs(trial, 'raw', id).filter(
    (row) => leftOn.has(row.subjid) && day(row[column]) > leftOn.get(row.subjid)
  ).length
]);
check(
  'participants leave early, and one who has left has no later row in any domain',
  leftOn.size > 0 && later.every(([, count]) => count === 0),
  `${leftOn.size} left; later rows: ${later.map(([id, count]) => `${id} ${count}`).join(', ')}`
);
check(
  'fewer have left than were asked to by the last visit, since the study is still enrolling: between a third of the share asked for and all of it',
  leftOn.size / enrolledIn > 0.1 && leftOn.size / enrolledIn <= 0.3 + 0.03,
  `${leftOn.size} of ${enrolledIn}`
);
const stoppedDrug = new Set(
  rowsAs(trial, 'raw', 'SDRGCOMP')
    .filter((row) => row.sdrgyn === 'N')
    .map((row) => row.subjid)
);
check(
  'the treatment completion table agrees: everyone who left the study stopped treatment',
  [...leftOn.keys()].every((id) => stoppedDrug.has(id))
);
const modelOf = (arm, statistic) => {
  const found = rowsAs(trial, 'analysis', 'EfficacySummary').find(
    (row) => row.ARM === arm && row.STATISTIC === statistic && /covariance/.test(row.ANALYSIS)
  );
  return found ? Number(found.VALUE) : null;
};
const summaryOf = (arm, statistic) => {
  const rows = rowsAs(trial, 'analysis', 'EfficacySummary').filter(
    (row) => row.ARM === arm && row.STATISTIC === statistic && !/covariance/.test(row.ANALYSIS)
  );
  return rows.length ? Number(rows.at(-1).VALUE) : null;
};
const high = 'Xanomeline High Dose';
check(
  'the efficacy workflow fits a model: an adjusted difference, its standard error, a 95% interval that holds it, and a p-value',
  modelOf(high, 'adjusted difference') !== null &&
    modelOf(high, 'standard error') > 0 &&
    modelOf(high, 'lower 95% limit') < modelOf(high, 'adjusted difference') &&
    modelOf(high, 'upper 95% limit') > modelOf(high, 'adjusted difference') &&
    modelOf(high, 'p-value') >= 0 &&
    modelOf(high, 'p-value') <= 1,
  `${modelOf(high, 'adjusted difference')} (SE ${modelOf(high, 'standard error')}, p ${modelOf(high, 'p-value')})`
);
check(
  'the model’s difference is within 3 standard errors of the −3.0 asked for, and within 1.5 points of the summary’s',
  Math.abs(modelOf(high, 'adjusted difference') + 3) <= 3 * modelOf(high, 'standard error') &&
    Math.abs(modelOf(high, 'adjusted difference') - summaryOf(high, 'difference')) <= 1.5,
  `model ${modelOf(high, 'adjusted difference')}, summary ${summaryOf(high, 'difference')}`
);
const byArm = rowsAs(trial, 'analysis', 'AESummaryByArm');
check(
  'adverse events are summarised by arm: a row for each arm, class and term, and no arm’s share above 100',
  new Set(byArm.map((row) => row.ARM)).size === 3 &&
    byArm.every(
      (row) => Number(row.PERCENT) <= 100 && Number(row.PARTICIPANTS) <= Number(row.BIGN)
    ),
  `${byArm.length} rows`
);

// 2e. The same, measured on a study large enough to hold tight: 6,000
// participants handed straight to gsm.datasim's study results in this R.
const measured = Object.fromEntries(
  (await webR.evalRString(readFileSync(path.join(root, 'scripts/real-r-results.R'), 'utf8')))
    .split(';')
    .map((pair) => pair.split('='))
    .map(([name, value]) => [name, Number(value)])
);
const within = (value, target, tolerance) => Math.abs(value - target) <= tolerance;
check(
  'of 6,000 participants, 0.30 were asked to leave and 0.50 on one arm: the shares that left are within 0.03',
  within(measured.left_placebo, 0.3, 0.03) &&
    within(measured.left_low, 0.3, 0.03) &&
    within(measured.left_high, 0.5, 0.03) &&
    measured.rows_after_leaving === 0,
  `${measured.left_placebo}, ${measured.left_low}, ${measured.left_high}`
);
check(
  'drug-type events were asked to be 2.0 times as common on an active arm: the ratio is within 0.2, and 1.5 unless told',
  within(measured.event_ratio, 2, 0.2) && within(measured.default_event_ratio, 1.5, 0.15),
  `${measured.event_ratio}, default ${measured.default_event_ratio}`
);
check(
  'a simulated rise names an event the participant has: none on placebo, none added, no placeholder left, every grade agreeing',
  measured.signal_events > 0 &&
    measured.signal_on_placebo === 0 &&
    measured.events_plain === measured.events_before &&
    measured.placeholder_terms === 0 &&
    measured.grades_disagree === 0,
  `${measured.signal_events} of ${measured.events_plain} events`
);
check(
  'the score moves as asked: −1.5 and −3.0 from a placebo change of 2.5 with a spread of 6.5, each within 0.6; the model within 3 standard errors',
  within(measured.diff_low, -1.5, 0.6) &&
    within(measured.diff_high, -3, 0.6) &&
    within(measured.change_placebo, 2.5, 0.6) &&
    within(measured.sd_change, 6.5, 0.5) &&
    Math.abs(measured.model_high + 3) <= 3 * measured.model_high_se,
  `${measured.diff_low}, ${measured.diff_high}; model ${measured.model_high} (SE ${measured.model_high_se})`
);
check(
  'the results are the same applied twice, an earlier snapshot’s events are a later one’s, and whoever had left by then has still left',
  measured.same_twice === 1 &&
    measured.early_events_same === 1 &&
    measured.early_left_within === 1 &&
    measured.early_left < measured.late_left &&
    measured.no_dropout_completion_rows === 0,
  `${measured.early_left} then ${measured.late_left}`
);

// 3. Every optional domain.
const every = await build({
  participants: 60,
  sites: 6,
  months: 4,
  seed: 1,
  domains: DOMAINS.filter((domain) => !domain.core && !domain.asked).map((domain) => domain.id)
});
check(
  'every one of the 19 domains can be made',
  every.domains.length === DOMAINS.filter((domain) => !domain.asked).length,
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
// Phase and therapeutic area shape the study results: gsm.datasim's study
// profile. Measured on 12,000 participants handed straight to its study
// results in this R, then seen through four studies built as a page builds one.
const profiled = Object.fromEntries(
  (await webR.evalRString(readFileSync(path.join(root, 'scripts/real-r-profile.R'), 'utf8')))
    .split(';')
    .map((pair) => pair.split('='))
    .map(([name, value]) => [name, Number(value)])
);
check(
  'Phase 2 with no area is neutral: the study results are the same with its profile, with none, and with the profile turned off',
  profiled.neutral_same === 1
);
check(
  'a phase changes how often a lab is out of range: on sodium about 0.9% at Phase 1, 2.5% at Phase 2 and 4.3% at Phase 3, each within a third',
  within(profiled.out_p1, 0.009, 0.003) &&
    within(profiled.out_p2, 0.025, 0.008) &&
    within(profiled.out_p3, 0.043, 0.014),
  `${profiled.out_p1}, ${profiled.out_p2}, ${profiled.out_p3}`
);
check(
  'at Phase 1, 30% of serious events are not serious and events are milder; at Phase 3 the events are as at Phase 2',
  within(profiled.serious_p1 / profiled.serious_p2, 0.7, 0.04) &&
    profiled.grade_p1 < profiled.grade_p2 - 0.05 &&
    profiled.serious_same_p3 === 1,
  `serious ${profiled.serious_p1} against ${profiled.serious_p2}; grade ${profiled.grade_p1} against ${profiled.grade_p2}`
);
check(
  'in Oncology, 8% of events that are not serious become serious, events are more severe, labs spread wider and liver rises on a drug are about 1.5 times as common',
  within((profiled.serious_onc - profiled.serious_p2) / (1 - profiled.serious_p2), 0.08, 0.02) &&
    profiled.grade_onc > profiled.grade_p2 + 0.05 &&
    profiled.out_onc > profiled.out_p2 * 1.3 &&
    within(profiled.liver_onc / profiled.liver_p2, 1.5, 0.35),
  `serious ${profiled.serious_onc} against ${profiled.serious_p2}; liver ${profiled.liver_onc} against ${profiled.liver_p2}; out of range ${profiled.out_onc}`
);
check(
  'an area makes its classes of event commoner: gastrointestinal in Oncology, musculoskeletal in Inflammation, infections in Virology, each at least 1.15 times its share',
  profiled.gi_onc > 1.15 * profiled.gi_p2 &&
    profiled.msk_inf > 1.15 * profiled.msk_p2 &&
    profiled.inf_vir > 1.15 * profiled.inf_p2,
  `${profiled.gi_onc}/${profiled.gi_p2}, ${profiled.msk_inf}/${profiled.msk_p2}, ${profiled.inf_vir}/${profiled.inf_p2}`
);
check(
  'in Virology, about twice as many participants have raised liver tests from the start; Inflammation leaves the labs as they are',
  within(profiled.start_vir / profiled.start_p2, 2, 0.4) && profiled.labs_same_inf === 1,
  `${profiled.start_vir} against ${profiled.start_p2}`
);
check(
  'a profile adds, removes and moves no event, and every grade still agrees with whether the event is serious',
  profiled.same_events === 1 && profiled.disagree === 0
);
const { PROFILE_SAID } = await import('../src/engine/core.js');
const shaped = async (phase, area) =>
  build({
    name: 'SHAPED',
    participants: 200,
    sites: 10,
    months: 6,
    seed: 77,
    phase,
    area,
    layers: []
  });
const early = await shaped('P1', 'Inflammation');
const late = await shaped('P3', 'Inflammation');
const tumours = await shaped('P2', 'Oncology');
const joints = await shaped('P2', 'Inflammation');
// The columns in which two studies' tables differ, table by table.
const differ = (one, other) =>
  Object.fromEntries(
    one.domains
      .map((domain) => {
        const mine = rowsAs(one, 'raw', domain.id);
        const theirs = rowsAs(other, 'raw', domain.id);
        if (mine.length !== theirs.length) return [domain.id, ['rows']];
        const columns = new Set();
        mine.forEach((row, index) => {
          for (const name of Object.keys(row))
            if (row[name] !== theirs[index][name]) columns.add(name);
        });
        return [domain.id, [...columns].sort()];
      })
      .filter(([, columns]) => columns.length)
  );
const byPhase = differ(early, late);
const byArea = differ(tumours, joints);
const only = (found, allowed) =>
  Object.entries(found).every(
    ([table, columns]) => allowed[table] && columns.every((name) => allowed[table].includes(name))
  );
check(
  'two studies of one seed that differ in phase differ only in the study table’s phase, lab results, and which events are serious and how severe',
  only(byPhase, { STUDY: ['phase'], LB: ['lbresn'], AE: ['aeser', 'aetoxgr'] }) &&
    Boolean(byPhase.LB && byPhase.AE),
  JSON.stringify(byPhase)
);
check(
  'two that differ in area differ only in the study table’s area and indication, lab results, and the events’ terms, classes, seriousness, grades and whether related',
  only(byArea, {
    STUDY: ['therapeutic_area', 'protocol_indication'],
    LB: ['lbresn'],
    AE: ['aeser', 'aetoxgr', 'mdrpt_nsv', 'mdrsoc_nsv', 'aerel']
  }) && Boolean(byArea.LB && byArea.AE && byArea.STUDY),
  JSON.stringify(byArea)
);
const indicationOf = (study) => rowsAs(study, 'raw', 'STUDY')[0].protocol_indication;
check(
  'the study table says an indication that fits the area, and a protocol’s own when there is one',
  indicationOf(tumours) === 'Advanced solid tumours' &&
    indicationOf(joints) === 'Rheumatoid arthritis' &&
    Boolean(protocol.indication) &&
    indicationOf(scheduled) === protocol.indication,
  `${indicationOf(tumours)}; ${indicationOf(joints)}; ${indicationOf(scheduled)} for ${protocol.indication}`
);
check(
  'a study’s notes say what its phase and area changed, in the words the form uses',
  early.notes.some(
    (note) =>
      note.includes(PROFILE_SAID.phases.P1) && note.includes(PROFILE_SAID.areas.Inflammation)
  ) &&
    tumours.notes.some((note) => note.includes(PROFILE_SAID.areas.Oncology)) &&
    late.notes.some((note) => note.includes(PROFILE_SAID.phases.P3)),
  early.notes.find((note) => note.includes('study profile')) || 'no such note'
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
// What changed for a study that asks for none of this: only its adverse events'
// terms and grades. Every other raw table, and every site metric, is as it was.
const sameText = (layer, id) =>
  (rebuilt.table(layer, id) || {}).text === (kept.table(layer, id) || {}).text;
const changedRaw = rebuilt.domains.filter((domain) => !sameText('raw', domain.id)).map((d) => d.id);
const eventsNow = rowsAs(rebuilt, 'raw', 'AE');
const eventsThen = rowsAs(kept, 'raw', 'AE');
check(
  'a hosted study’s raw tables are what its settings build today, every one',
  changedRaw.every((id) => id === 'AE'),
  changedRaw.join(' ')
);
check(
  'and its adverse events are the same events: who, when and whether serious are unchanged; only terms and grades differ',
  eventsNow.length === eventsThen.length &&
    eventsNow.every(
      (row, index) =>
        row.subjid === eventsThen[index].subjid &&
        row.aest_dt === eventsThen[index].aest_dt &&
        row.aeen_dt === eventsThen[index].aeen_dt &&
        row.aeser === eventsThen[index].aeser
    ),
  `${eventsNow.length} now, ${eventsThen.length} then`
);
const metricsChanged = rebuilt.layers
  .find((layer) => layer.id === 'analysis')
  .tables.filter((table) => /^kri/.test(table.id) && !sameText('analysis', table.id))
  .map((table) => table.id);
check('so every site metric is as it was', metricsChanged.length === 0, metricsChanged.join(' '));
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
