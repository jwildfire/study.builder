// The studies feed: one list of every study a reader can have, for a page or
// a program that is not study.builder. Every entry is a study's configuration:
// settings, or a protocol a study can follow. One whose build is kept has a
// `build` too: the file of its data. Four things are done with the feed, each
// with plain JSON in and out and no page:
//
//   listStudies(url)             the feed, read: one entry a configuration
//   describeStudy(entry|study)   what an entry is, or what an opened study holds
//   openListed(entry)            its build, opened; or its configuration. A file is checked against its checksum
//   readTable(study, layer, id)  one table of an opened study, as records
//
// A study is built from settings with `buildStudy` (build.js). The feed's
// format is written down in studies/studies.schema.json.

import { firstRows } from '../shared/csv.js';
import { PHASES } from './core.js';
import { StudyBuilderError } from './build.js';
import { overviewOf } from './overview.js';
import { documentOf, openStudy } from './saved.js';

/** The format a studies feed says it is in. */
export const STUDIES_FORMAT = 'study.builder/studies/1';
/** What a configuration is: settings, or a protocol a study can follow. */
export const STUDY_KINDS = Object.freeze(['settings', 'protocol']);
/** What an entry is called on a page, by what it has. */
export const KIND_MARKS = Object.freeze({
  built: 'Data ready',
  settings: 'Settings only',
  protocol: 'Protocol'
});
/** An entry's mark: whether its data is ready, and if not, what it is. */
export const markOf = (entry) =>
  entry && entry.build ? KIND_MARKS.built : KIND_MARKS[entry && entry.kind] || '';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const plural = (number, noun) =>
  `${Number(number).toLocaleString('en-US')} ${noun}${Number(number) === 1 ? '' : 's'}`;

/**
 * An entry's facts in a line: `Phase 2 · 120 participants · 12 sites · 7 months`.
 * @param {{kind: string, facts: Object}} entry An entry of the feed.
 * @returns {string} The line.
 */
export function factsLine(entry) {
  const facts = (entry && entry.facts) || {};
  const phase = PHASES.find((one) => one.id === facts.phase);
  const has = (value) => value !== null && value !== undefined && value !== '';
  return [
    phase ? phase.label : facts.phase,
    has(facts.participants)
      ? `${plural(facts.participants, 'participant')}${entry.kind === 'protocol' ? ' planned' : ''}`
      : '',
    has(facts.sites) ? plural(facts.sites, 'site') : '',
    has(facts.months) ? plural(facts.months, 'month') : '',
    has(facts.arms) ? plural(facts.arms, 'arm') : '',
    has(facts.visits) ? plural(facts.visits, 'visit') : ''
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Read a studies feed. An entry that is not whole is left out; a file's
 * address is made whole against the feed's own.
 * @param {Object} document The feed, as fetched.
 * @param {string} [from] The feed's address, for the files it names beside it.
 * @returns {Object[]} The entries: `id`, `kind` (`settings` or `protocol`), `name`, `about`, `facts`, `line`, `mark`, `settings` or `protocol` (a file: `url`, `sha256`, `bytes`), and `build` (a file, with the `key` of its tables) when the study's data is kept, else null.
 */
export function readStudies(document, from = '') {
  if (!isRecord(document) || document.format !== STUDIES_FORMAT) {
    throw new StudyBuilderError(
      `This is not a list of studies: its format is not ${STUDIES_FORMAT}.`
    );
  }
  const fileOf = (given, withKey) => {
    if (!isRecord(given) || !text(given.url)) return null;
    let url = given.url;
    try {
      if (from) url = new URL(given.url, from).href;
    } catch {
      url = given.url;
    }
    return {
      url,
      sha256: text(given.sha256) || null,
      bytes: Number.isFinite(given.bytes) ? given.bytes : null,
      ...(withKey ? { key: text(given.key) || null } : {})
    };
  };
  const entries = [];
  for (const given of Array.isArray(document.studies) ? document.studies : []) {
    if (!isRecord(given) || !text(given.id) || !STUDY_KINDS.includes(given.kind)) continue;
    if (entries.some((other) => other.id === given.id)) continue;
    const protocol = given.kind === 'protocol' ? fileOf(given.protocol, false) : null;
    // A configuration with nothing to configure from names nothing.
    if (given.kind === 'protocol' && !protocol) continue;
    if (given.kind === 'settings' && !isRecord(given.settings)) continue;
    const entry = {
      id: given.id,
      kind: given.kind,
      name: text(given.name) || given.id,
      about: text(given.about),
      facts: isRecord(given.facts) ? { ...given.facts } : {},
      settings: given.kind === 'settings' ? { ...given.settings } : null,
      protocol,
      build: fileOf(given.build, true)
    };
    entry.mark = markOf(entry);
    entry.line = text(given.line) || factsLine(entry);
    entries.push(entry);
  }
  return entries;
}

/**
 * The entries a page asked for.
 * @param {Object[]} entries Entries, as `readStudies` gives them.
 * @param {{kinds?: string[], built?: boolean}} [asked] The kinds to keep; `built: true` for only those whose data is ready, `false` for only those without.
 * @returns {Object[]} Those kept.
 */
export function keptStudies(entries, { kinds = null, built = null } = {}) {
  return entries.filter(
    (entry) =>
      (!Array.isArray(kinds) || kinds.includes(entry.kind)) &&
      (built === null || built === undefined || Boolean(entry.build) === Boolean(built))
  );
}

/**
 * Fetch a studies feed.
 * @param {string} url The feed's address: `studies/index.json` beside study.builder's files.
 * @param {{fetch?: Function, kinds?: string[], built?: boolean}} [options] Something else to fetch with; the kinds to keep; `built: true` for only those whose data is ready.
 * @returns {Promise<Object[]>} The entries, as `readStudies` gives them. Throws a StudyBuilderError when the feed cannot be fetched or read.
 */
export async function listStudies(
  url,
  { fetch: get = globalThis.fetch, kinds = null, built = null } = {}
) {
  let document;
  try {
    const response = await get(url);
    if (!response || !response.ok)
      throw new Error(`the page answered ${response && response.status}`);
    document = await response.json();
  } catch (error) {
    throw new StudyBuilderError(
      `The list of studies could not be fetched: ${error && error.message ? error.message : error}.`
    );
  }
  const base =
    typeof globalThis.location === 'object' && globalThis.location && globalThis.location.href
      ? new URL(url, globalThis.location.href).href
      : url;
  return keptStudies(readStudies(document, base), { kinds, built });
}

/**
 * Describe an entry of the feed, or a study that is open, as plain JSON.
 * @param {Object} given An entry, or what `openStudy`, `openListed` or `buildStudy` gave.
 * @returns {Object} For an entry: its `id`, `kind`, `name`, `about`, `facts`, `line`, `mark` and whether its data is kept (`built`). For an open study: its `id`, `snapshotDate`, `snapshots`, the overview's `facts` and `counts`, and each layer with its tables, their rows and their column names.
 */
export function describeStudy(given) {
  if (given && typeof given.table === 'function' && Array.isArray(given.layers)) {
    const about = overviewOf(given);
    return {
      id: given.id,
      opened: true,
      snapshotDate: given.snapshotDate || null,
      snapshots: (given.history || []).map((entry) => entry.date),
      facts: about.facts,
      counts: about.counts,
      layers: given.layers.map((layer) => ({
        id: layer.id,
        label: layer.label,
        tables: layer.tables.map((table) => ({
          id: table.table || table.id,
          label: table.label || table.name || table.id,
          rows: table.rows,
          columns: (table.columns || []).map((column) => column.name || column)
        }))
      }))
    };
  }
  if (!isRecord(given) || !STUDY_KINDS.includes(given.kind)) {
    throw new StudyBuilderError('That is neither an entry of the studies feed nor an open study.');
  }
  return {
    id: given.id,
    opened: false,
    kind: given.kind,
    name: given.name,
    about: given.about || '',
    facts: { ...(given.facts || {}) },
    line: given.line || factsLine(given),
    mark: markOf(given),
    built: Boolean(given.build),
    build: given.build ? { bytes: given.build.bytes, sha256: given.build.sha256 } : null
  };
}

const hex = (buffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Open an entry: its build, when its data is kept, else its configuration. A
 * file is fetched and checked against the feed's checksum before it is read;
 * one that does not match is refused.
 * @param {Object} entry An entry of the feed.
 * @param {{as?: string, fetch?: Function, subtle?: Object}} [options] `as: 'config'` for the configuration even when there is a build; something else to fetch or to hash with.
 * @returns {Promise<{kind: string, study?: Object, protocol?: Object, settings?: Object}>} `kind: 'study'` with the study opened; or `'settings'` with settings to build from; or `'protocol'` with a protocol document.
 */
export async function openListed(
  entry,
  {
    as = null,
    fetch: get = globalThis.fetch,
    subtle = globalThis.crypto && globalThis.crypto.subtle ? globalThis.crypto.subtle : null
  } = {}
) {
  if (!isRecord(entry) || !STUDY_KINDS.includes(entry.kind)) {
    throw new StudyBuilderError('That is not an entry of the studies feed.');
  }
  const fetched = async (file) => {
    let bytes;
    try {
      const response = await get(file.url);
      if (!response || !response.ok) {
        throw new Error(`the page answered ${response && response.status}`);
      }
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      throw new StudyBuilderError(
        `${entry.name} could not be fetched: ${error && error.message ? error.message : error}.`
      );
    }
    if (file.sha256) {
      if (!subtle) {
        throw new StudyBuilderError(
          `${entry.name} cannot be checked against its checksum here: this page cannot hash a file.`
        );
      }
      const sum = hex(await subtle.digest('SHA-256', bytes));
      if (sum !== file.sha256) {
        throw new StudyBuilderError(
          `${entry.name} is not the file its list names. It was not opened.`
        );
      }
    }
    return documentOf({ arrayBuffer: async () => bytes.buffer });
  };
  if (entry.build && as !== 'config') {
    const document = await fetched(entry.build);
    if (entry.build.key && document.key !== entry.build.key) {
      throw new StudyBuilderError(
        `${entry.name} is not the study its list names. It was not opened.`
      );
    }
    return { kind: 'study', study: await openStudy(document) };
  }
  if (entry.kind === 'protocol')
    return { kind: 'protocol', protocol: await fetched(entry.protocol) };
  return { kind: 'settings', settings: { ...entry.settings } };
}

/**
 * One table of an open study, as plain JSON.
 * @param {Object} study An open study, or one of its snapshots (`study.at(date)`).
 * @param {string} layer The layer: `raw`, `adam`, `analysis`, `reporting`.
 * @param {string} id The table: `AE`, `ADSL`, `Results`.
 * @param {{limit?: number, offset?: number}} [options] How many rows, and from which.
 * @returns {{layer: string, id: string, rows: number, columns: string[], offset: number, records: Object[]}} The table; every value is text, as in the file. Throws a StudyBuilderError when the study has no such table.
 */
export function readTable(study, layer, id, { limit = 1000, offset = 0 } = {}) {
  const table = study && typeof study.table === 'function' ? study.table(layer, id) : null;
  if (!table) throw new StudyBuilderError(`This study has no table ${id} in the layer ${layer}.`);
  const { header, rows } = firstRows(table.text, offset + limit);
  return {
    layer,
    id,
    rows: table.rows,
    columns: header,
    offset,
    records: rows
      .slice(offset, offset + limit)
      .map((row) => Object.fromEntries(header.map((name, at) => [name, row[at]])))
  };
}
