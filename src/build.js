// study.builder with no page: build a study from settings and get its data
// back. This is what another package calls to load simulated data.
//
//   const study = await StudyBuilder.buildStudy({ participants: 200, sites: 15 });
//   study.domains      every raw domain: id, name, rows, columns, text
//   study.standard     the standard files made from them, each with its mapping
//   study.files()      { raw: [{ name, text }], standard: [{ name, text }] }

import { DOMAINS, STANDARD, readSettings, studySaid } from './core.js';
import { createConnection } from './r.js';
import { SIMULATOR_FILES, VITALS_FILE } from './files.js';

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
  const files = ['r/builder.R', ...SIMULATOR_FILES, VITALS_FILE].map((file) => ({
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
          ...read.args
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
      return studyOf(answer.value, read.args);
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
function tableOf(entry, more) {
  if (!entry || typeof entry.name !== 'string' || typeof entry.text !== 'string') {
    throw new StudyBuilderError('The study was not built: R returned a table that cannot be read.');
  }
  return {
    ...more,
    id: entry.id,
    name: entry.name,
    rows: Number(entry.rows) || 0,
    columns: list(entry.columns).map((column) => ({ name: column.name, type: column.type })),
    text: entry.text
  };
}

/**
 * What `builder_run` returned, as a study.
 * @param {Object} value R's answer.
 * @param {Object} args What R was asked for.
 * @returns {Object} The study.
 */
export function studyOf(value, args) {
  if (!value || !list(value.domains).length) {
    throw new StudyBuilderError('The study was not built: R returned no domains.');
  }
  const domains = list(value.domains).map((entry) => {
    const known = DOMAINS.find((domain) => domain.id === entry.id) || {};
    return tableOf(entry, {
      kind: 'raw',
      table: entry.table,
      label: known.label || entry.id,
      grain: known.grain || '',
      core: Boolean(known.core),
      feeds: known.feeds || null
    });
  });
  const standard = list(value.standard).map((entry) => {
    const known = STANDARD.find((file) => file.id === entry.id) || {};
    return tableOf(entry, {
      kind: 'standard',
      label: entry.label || known.label || entry.id,
      from: list(entry.from),
      mapping: list(entry.mapping).map((line) => ({
        column: line.column,
        from: line.from || '',
        how: line.how
      }))
    });
  });
  const study = {
    id: value.study_id,
    snapshotDate: value.snapshot_date,
    snapshots: Number(value.snapshots) || 0,
    seconds: Number(value.seconds),
    simulator: value.simulator,
    args,
    notes: list(value.notes),
    domains,
    standard,
    /** The study's files, as a page loads files: each a name and its text. */
    files() {
      const texts = (tables) => tables.map(({ name, text }) => ({ name, text }));
      return { raw: texts(domains), standard: texts(standard) };
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
