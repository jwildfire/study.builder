// study.builder with no page: build a study from settings and get its data
// back. This is what another package calls to load simulated data.
//
//   const study = await StudyBuilder.buildStudy({ participants: 200, sites: 15 });
//   study.domains      every raw domain: id, name, rows, columns, text
//   study.standard     the standard files made from them, each with its mapping
//   study.files()      { raw: [{ name, text }], standard: [{ name, text }] }

import { DOMAINS, LAYERS, STANDARD, readSettings, studySaid } from './core.js';
import { createConnection } from './r.js';
import {
  FILES_STAMP,
  GSM_FILES,
  SIMULATOR_FILES,
  VITALS_FILE,
  WORKFLOW_FILES,
  WORKFLOW_HELPERS
} from './files.js';
import { metadataOf } from './metadata.js';
import { readProtocol } from './protocol.js';
import { manifestOf } from './manifest.js';

/** The packages R installs: the ones gsm.datasim's code calls, and three of gsm's own. */
export const PACKAGES = Object.freeze([
  'dplyr',
  'lubridate',
  'purrr',
  'glue',
  'logger',
  'magrittr',
  'rlang',
  'stringr',
  'tictoc',
  'yaml',
  'workr',
  'gsm.core',
  'gsm.mapping',
  'gsm.reporting'
]);

/** Where the packages gsm's own are not come from. */
export const PUBLIC_INDEX = 'https://repo.r-wasm.org';

/** What starting R downloads the first time, for a page to say. */
export const DOWNLOADS = Object.freeze([
  Object.freeze({ what: 'R itself', host: 'webr.r-wasm.org', megabytes: 13 }),
  Object.freeze({ what: 'its packages', host: 'repo.r-wasm.org', megabytes: 40 }),
  Object.freeze({ what: 'gsm’s packages and gsm.datasim', host: null, megabytes: 2 })
]);

/** Where R keeps study.builder's files. */
const ROOT = '/study.builder';
const SIMULATOR = `${ROOT}/vendor/gsm.datasim`;
const VITALS = `${ROOT}/${VITALS_FILE}`;
const WORKFLOWS = `${ROOT}/workflows`;
const KRI = `${ROOT}/vendor/gsm.kri`;
const REPORTING = `${ROOT}/vendor/gsm.reporting`;

/** An error whose message is a sentence a page can show, with every problem found. */
export class StudyBuilderError extends Error {
  constructor(message, problems = [message]) {
    super(message);
    this.name = 'StudyBuilderError';
    this.problems = problems;
  }
}

const withSlash = (base) => (base.endsWith('/') ? base : `${base}/`);

/**
 * What R is given, as the options of a connection: the packages and where to
 * install them from, and study.builder's R and gsm.datasim's own source, each
 * with the address it is fetched from and the path R keeps it at.
 * @param {string} base The address study.builder's files are served under: its `r/` and `vendor/` folders.
 * @param {{repository?: string}} [where] `repository` is where gsm's own packages are installed from, for a page that already serves them; `vendor/r-wasm/repo` under the base unless told.
 * @returns {{packages: string[], repos: string[], files: Array<{path: string, url: string}>, source: string[]}} The options.
 */
export function rOptions(base, { repository = null } = {}) {
  const from = withSlash(base);
  const files = [
    'r/builder.R',
    ...SIMULATOR_FILES,
    VITALS_FILE,
    ...GSM_FILES,
    ...WORKFLOW_FILES,
    ...WORKFLOW_HELPERS
  ].map((file) => ({
    path: `${ROOT}/${file}`,
    // The stamp keeps a page and the files it fetches of one release (files.js).
    url: `${from}${file}?v=${FILES_STAMP}`
  }));
  return {
    packages: [...PACKAGES],
    repos: [repository || `${from}vendor/r-wasm/repo`, PUBLIC_INDEX],
    files,
    source: [`${ROOT}/r/builder.R`]
  };
}

/**
 * A builder: one connection to R, kept, so a second study is built without
 * starting R again.
 * @param {Object} [options]
 * @param {string} [options.base] The address study.builder's `r/` and `vendor/` folders are served under.
 * @param {{run: Function}} [options.connection] A connection to R the page already has, in place of one of study.builder's own. Its R must have been given what `rOptions(base)` lists.
 * @param {(options: Object) => {run: Function}} [options.createConnection] Something else to make the connection with: a page that shares one R between its parts hands its own factory, which is called on the first build with what `rOptions` lists and an `onStage`.
 * @param {string} [options.repository] Where gsm's own packages are installed from, for a page that already serves them.
 * @param {(stage: string) => void} [options.onStage] Told each step as it begins: `runtime`, `packages`, `files`, `source`, then `simulate`.
 * @returns {{build: (settings?: Object) => Promise<Object>, close: () => Promise<void>, started: () => boolean}} The builder.
 */
export function createBuilder({
  base = './',
  connection: given = null,
  createConnection: connect = createConnection,
  repository = null,
  onStage = null
} = {}) {
  let connection = given;
  let started = Boolean(given);
  const stage = (name) => {
    if (typeof onStage !== 'function') return;
    try {
      onStage(name);
    } catch {
      // What the page does with a step's name cannot stop the build.
    }
  };

  return {
    /** Whether R has been asked for: a page says what the first build downloads until it has. */
    started: () => started,

    /**
     * Build one study.
     * @param {Object} [settings] As `readSettings` takes them; a setting left out is the default's.
     * @returns {Promise<Object>} The study. Rejects with a StudyBuilderError that says why, in a sentence.
     */
    async build(settings = {}) {
      const read = readSettings(settings);
      if (!read.args) throw new StudyBuilderError(read.problems.join(' '), read.problems);
      if (!connection) connection = connect({ ...rOptions(base, { repository }), onStage: stage });
      const wasStarted = started;
      started = true;
      // An R that is already up has nothing to say of starting.
      if (wasStarted) stage('simulate');
      const answer = await connection.run('builder_run', {
        args: {
          simulator: SIMULATOR,
          ...(read.args.domains.includes('VS') ? { vitals: VITALS } : {}),
          ...(read.args.layers.includes('adam') ? { workflows: WORKFLOWS } : {}),
          ...(read.args.layers.includes('analysis') ? { kri: KRI } : {}),
          ...(read.args.layers.includes('reporting') ? { reporting: REPORTING } : {}),
          ...read.args,
          // Raw is always named: an empty list does not cross to R.
          layers: ['raw', ...read.args.layers]
        }
      });
      if (!answer || answer.status !== 'ok') {
        if (answer && answer.status === 'unavailable') {
          // The next build starts R again.
          if (!given) connection = null;
          started = Boolean(given);
          throw new StudyBuilderError(`R could not be started in this browser: ${answer.message}`);
        }
        throw new StudyBuilderError(
          `The study was not built. R said: ${answer ? answer.message : 'nothing'}`
        );
      }
      const study = studyOf(answer.value, read.args);
      // Every table's checksum, and one for the whole study.
      study.manifest = await manifestOf(study);
      return study;
    },

    /** Let go of R, when it is study.builder's own: not a page's connection, nor one a page's own factory made. */
    async close() {
      if (given || connect !== createConnection || !connection) return;
      const mine = connection;
      connection = null;
      started = false;
      if (typeof mine.close === 'function') await mine.close();
    }
  };
}

const list = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);

/** One table R returned, as the study holds it. */
function tableOf(entry, layer) {
  if (!entry || typeof entry.name !== 'string' || typeof entry.text !== 'string') {
    throw new StudyBuilderError('The study was not built: R returned a table that cannot be read.');
  }
  const made = entry.made || {};
  const table = {
    layer: layer.id,
    id: entry.id,
    table: entry.table,
    name: entry.name,
    label: entry.description || entry.id,
    rows: Number(entry.rows) || 0,
    columns: list(entry.columns).map((column) => ({ name: column.name, type: column.type })),
    text: entry.text,
    // What made it: the workflow, and the tables that workflow read.
    made: { workflow: made.workflow || '', from: list(made.from) }
  };
  if (entry.mapping !== undefined) {
    table.mapping = list(entry.mapping).map((line) => ({
      column: line.column,
      label: line.label || '',
      from: line.from || '',
      how: line.how
    }));
  }
  // What the table is, in a sentence, where its workflow says.
  if (entry.about) table.about = entry.about;
  // The columns gsm.datasim named otherwise, each with the name it had.
  if (entry.renamed !== undefined) {
    table.renamed = list(entry.renamed).map((line) => ({ column: line.column, was: line.was }));
  }
  if (entry.domain) table.domain = entry.domain;
  // The workflow that made it, as it is written: what it says of itself, what
  // it reads, and its steps.
  if (entry.definition) {
    const given = entry.definition;
    const pairs = (value) =>
      list(value).map((pair) => ({ key: String(pair.key), value: String(pair.value ?? '') }));
    table.definition = {
      meta: pairs(given.meta),
      spec: list(given.spec).map((one) => ({
        table: String(one.table),
        columns: list(one.columns).map((column) => ({
          name: String(column.name),
          type: String(column.type || ''),
          required: Boolean(column.required)
        }))
      })),
      steps: list(given.steps).map((step) => ({
        output: String(step.output || ''),
        name: String(step.name || ''),
        params: pairs(step.params)
      }))
    };
  }
  // The columns that name one row, where the table's workflow says.
  if (entry.keys !== undefined) table.keys = list(entry.keys);
  return table;
}

/**
 * What `builder_run` returned, as a study.
 *
 *   study.layers                 raw first, then each layer built off it
 *   study.table(layer, id)       one table, or null: study.table('adam', 'ADAE')
 *   study.metadata               what the study is, and a spec for every table
 *   study.spec(layer, id)        one table's spec: keys, labels, types, joins
 *   study.files()                the files a page loads, by layer
 *
 * `study.domains` (the raw tables) and `study.standard` (the ADaM tables, each
 * with its `mapping`) are the v0.1 names for two of the layers, and stay.
 * @param {Object} value R's answer.
 * @param {Object} args What R was asked for.
 * @returns {Object} The study.
 */
export function studyOf(value, args) {
  const study = snapshotOf(value, args);
  // The snapshots before the last, oldest first, when they were kept. Each is
  // read only when it is asked for.
  const earlier = list(value.history).map((entry, index) => {
    const one = {
      date: String(entry.snapshot_date),
      number: index + 1,
      problem: entry.problem ? String(entry.problem) : null
    };
    let read = null;
    one.study = () => {
      if (one.problem) return null;
      if (!read) {
        read = snapshotOf(
          {
            ...value,
            layers: entry.layers,
            snapshot_date: entry.snapshot_date,
            history: undefined
          },
          args
        );
        read.snapshotNumber = one.number;
      }
      return read;
    };
    return one;
  });
  study.snapshotNumber = study.snapshots;
  /**
   * The study's snapshots, oldest first: each a `date`, its `number`, a
   * `problem` when its workflows could not be run, and `study()`, the study as
   * it stood then. The last is the study itself. One entry when only the last
   * was kept.
   */
  study.history = [
    ...earlier,
    { date: String(study.snapshotDate), number: study.snapshots, problem: null, study: () => study }
  ];
  /**
   * The study as it stood at a snapshot.
   * @param {string} date A snapshot's date.
   * @returns {?Object} That snapshot as a study, or null when it was not kept or could not be built.
   */
  study.at = (date) => {
    const found = study.history.find((entry) => entry.date === String(date));
    return found ? found.study() : null;
  };
  return study;
}

/** One snapshot R returned, as a study. */
function snapshotOf(value, args) {
  const given = list(value && value.layers);
  const rawGiven = given.find((layer) => layer.id === 'raw');
  if (!rawGiven || !list(rawGiven.tables).length) {
    throw new StudyBuilderError('The study was not built: R returned no domains.');
  }
  const layers = given.map((entry) => {
    const known = LAYERS.find((layer) => layer.id === entry.id) || {};
    const layer = {
      id: entry.id,
      label: entry.label || known.label || entry.id,
      about: known.about || ''
    };
    layer.tables = list(entry.tables).map((table) => tableOf(table, layer));
    return layer;
  });
  // A raw table takes its name and what one row is from the list of domains.
  const raw = layers.find((layer) => layer.id === 'raw');
  for (const table of raw.tables) {
    const known = DOMAINS.find((domain) => domain.id === table.id) || {};
    table.kind = 'raw';
    table.label = known.label || table.id;
    table.grain = known.grain || '';
    table.core = Boolean(known.core);
    table.feeds = known.feeds || null;
  }
  // A Raw.RBQM table is named for the domain it maps, as its raw table is.
  const mapped = layers.find((layer) => layer.id === 'raw.rbqm');
  for (const table of mapped ? mapped.tables : []) {
    const known = DOMAINS.find((domain) => domain.id === table.id);
    if (known) table.label = known.label;
  }
  // A reporting table is named by its id (Results, Bounds, Groups, Metrics);
  // what gsm says of it is kept as what it is.
  for (const table of (layers.find((layer) => layer.id === 'reporting') || { tables: [] }).tables) {
    if (!table.about) table.about = table.label;
    table.label = table.id;
  }
  // An ADaM table is named by its id, which is what an analyst calls it.
  for (const table of (layers.find((layer) => layer.id === 'adam') || { tables: [] }).tables) {
    table.description = table.label;
    table.label = table.id;
  }
  // An ADaM table is a standard file a chart of participants reads: its id
  // there is the standard domain's (subject, ae, bds).
  const adam = layers.find((layer) => layer.id === 'adam');
  const standard = (adam ? adam.tables : []).map((table) => {
    const known =
      STANDARD.find((file) => file.name === table.name) ||
      STANDARD.find((file) => file.id === table.domain) ||
      {};
    return {
      ...table,
      kind: 'standard',
      id: table.domain || table.id,
      label: known.label || table.label,
      from: table.made.from.map((name) => name.replace(/^(Raw|ADaM)_/, '')),
      mapping: table.mapping || []
    };
  });
  const texts = (tables) => tables.map(({ name, text }) => ({ name, text }));
  // A page that reads standard files takes one file for a domain. Two ADaM
  // tables of one domain (labs and vital signs are both `bds`) that have the
  // same columns are handed over as one file: one header, then each table's
  // rows. No row is made or changed.
  const stacked = (tables) => {
    const files = [];
    for (const table of tables) {
      const text = String(table.text || '');
      const end = text.indexOf('\n');
      const header = end < 0 ? text : text.slice(0, end);
      const before = files.find((file) => file.id === table.id && file.header === header);
      if (before && end >= 0) {
        before.names.push(table.name.replace(/\.csv$/, ''));
        before.text = `${before.text.replace(/\n*$/, '\n')}${text.slice(end + 1)}`;
      } else {
        files.push({ id: table.id, header, names: [table.name.replace(/\.csv$/, '')], text });
      }
    }
    return files.map((file) => ({ name: `${file.names.join('-')}.csv`, text: file.text }));
  };
  const study = {
    id: value.study_id,
    snapshotDate: value.snapshot_date,
    snapshots: Number(value.snapshots) || 0,
    seconds: Number(value.seconds),
    simulator: value.simulator,
    packages: value.packages && typeof value.packages === 'object' ? { ...value.packages } : {},
    args,
    // The protocol the build followed, when it followed one.
    protocol: args.protocol ? readProtocol(JSON.parse(args.protocol)) : null,
    notes: list(value.notes),
    layers,
    domains: raw.tables,
    standard,
    manifest: null,
    metadata: null,
    /**
     * What R returned for the study, as it returned it: what a saved study
     * keeps, so it can be opened again with no R (saved.js).
     * @returns {Object} R's answer.
     */
    source() {
      return value;
    },
    /**
     * One table's spec: what it is, its keys, and each column's label, type and joins.
     * @param {string} layer A layer's id.
     * @param {string} id The table's id in that layer.
     * @returns {?Object} The spec, or null when the study does not hold the table.
     */
    spec(layer, id) {
      return (
        (study.metadata &&
          study.metadata.tables.find((spec) => spec.layer === layer && spec.id === id)) ||
        null
      );
    },
    /**
     * One table of the study.
     * @param {string} layer A layer's id: `raw`, `raw.rbqm` or `adam`.
     * @param {string} id The table's id in that layer: `AE`, `ADAE`.
     * @returns {?Object} The table, or null when the study does not hold it.
     */
    table(layer, id) {
      const found = layers.find((entry) => entry.id === layer);
      return (found && found.tables.find((table) => table.id === id)) || null;
    },
    /**
     * The study's files, as a page loads files: each a name and its text.
     * `raw` and `standard` are the raw and the ADaM layer; `layers` has every layer by its id.
     * In `standard`, ADaM tables of one domain with the same columns are one file (adlb-advs.csv).
     */
    files() {
      return {
        raw: texts(raw.tables),
        standard: stacked(standard),
        layers: Object.fromEntries(layers.map((layer) => [layer.id, texts(layer.tables)]))
      };
    }
  };
  study.said = studySaid(study);
  study.metadata = metadataOf(study);
  return study;
}

/**
 * Build one study, with a builder made for it. A caller that builds more than
 * one keeps a builder (`createBuilder`), so R is started once.
 * @param {Object} [settings] As `readSettings` takes them.
 * @param {Object} [options] As `createBuilder` takes them.
 * @returns {Promise<Object>} The study.
 */
export function buildStudy(settings = {}, options = {}) {
  return createBuilder(options).build(settings);
}
