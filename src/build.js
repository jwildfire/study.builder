// study.builder with no page: build a study from settings and get its data
// back. This is what another package calls to load simulated data.
//
//   const study = await StudyBuilder.buildStudy({ participants: 200, sites: 15 });
//   study.domains      every raw domain: id, name, rows, columns, text
//   study.standard     the standard files made from them, each with its mapping
//   study.files()      { raw: [{ name, text }], standard: [{ name, text }] }

import { DOMAINS, LAYERS, STANDARD, readSettings, studySaid } from './core.js';
import { createConnection } from './r.js';
import { SIMULATOR_FILES, VITALS_FILE, WORKFLOW_FILES } from './files.js';
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
  'gsm.mapping'
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
  const files = ['r/builder.R', ...SIMULATOR_FILES, VITALS_FILE, ...WORKFLOW_FILES].map((file) => ({
    path: `${ROOT}/${file}`,
    url: `${from}${file}`
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
      from: line.from || '',
      how: line.how
    }));
  }
  if (entry.domain) table.domain = entry.domain;
  return table;
}

/**
 * What `builder_run` returned, as a study.
 *
 *   study.layers                 raw first, then each layer built off it
 *   study.table(layer, id)       one table, or null: study.table('adam', 'ADAE')
 *   study.files()                the files a page loads, by layer
 *
 * `study.domains` (the raw tables) and `study.standard` (the ADaM tables, each
 * with its `mapping`) are the v0.1 names for two of the layers, and stay.
 * @param {Object} value R's answer.
 * @param {Object} args What R was asked for.
 * @returns {Object} The study.
 */
export function studyOf(value, args) {
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
  // An ADaM table is named by its id, which is what an analyst calls it.
  for (const table of (layers.find((layer) => layer.id === 'adam') || { tables: [] }).tables) {
    table.description = table.label;
    table.label = table.id;
  }
  // An ADaM table is a standard file a chart of participants reads: its id
  // there is the standard domain's (subject, ae, bds).
  const adam = layers.find((layer) => layer.id === 'adam');
  const standard = (adam ? adam.tables : []).map((table) => {
    const known = STANDARD.find((file) => file.id === table.domain) || {};
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
  const study = {
    id: value.study_id,
    snapshotDate: value.snapshot_date,
    snapshots: Number(value.snapshots) || 0,
    seconds: Number(value.seconds),
    simulator: value.simulator,
    packages: value.packages && typeof value.packages === 'object' ? { ...value.packages } : {},
    args,
    notes: list(value.notes),
    layers,
    domains: raw.tables,
    standard,
    manifest: null,
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
     */
    files() {
      return {
        raw: texts(raw.tables),
        standard: texts(standard),
        layers: Object.fromEntries(layers.map((layer) => [layer.id, texts(layer.tables)]))
      };
    }
  };
  study.said = studySaid(study);
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
