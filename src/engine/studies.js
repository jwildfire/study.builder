// The studies feed: one list of every study a reader can have, for a page or
// a program that is not study.builder. Four things are done with it, each with
// plain JSON in and out and no page:
//
//   listStudies(url)             the feed, read: one entry a study
//   describeStudy(entry|study)   what an entry is, or what an opened study holds
//   openListed(entry)            fetch what an entry names, checked against its checksum
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
/** The kinds of entry: a study with its data, settings that build one, a protocol one can follow. */
export const STUDY_KINDS = Object.freeze(['study', 'settings', 'protocol']);
/** What each kind is called on a page. */
export const KIND_MARKS = Object.freeze({
  study: 'Data ready',
  settings: 'Settings only',
  protocol: 'Protocol'
});

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
 * @returns {Object[]} The entries: `id`, `kind`, `name`, `about`, `facts`, `line`, `mark`, `file` (`url`, `sha256`, `bytes`, and `key` for a study) or null, and `settings` for an entry of settings.
 */
export function readStudies(document, from = '') {
  if (!isRecord(document) || document.format !== STUDIES_FORMAT) {
    throw new StudyBuilderError(
      `This is not a list of studies: its format is not ${STUDIES_FORMAT}.`
    );
  }
  const entries = [];
  for (const given of Array.isArray(document.studies) ? document.studies : []) {
    if (!isRecord(given) || !text(given.id) || !STUDY_KINDS.includes(given.kind)) continue;
    if (entries.some((other) => other.id === given.id)) continue;
    let file = null;
    if (isRecord(given.file) && text(given.file.url)) {
      let url = given.file.url;
      try {
        if (from) url = new URL(given.file.url, from).href;
      } catch {
        url = given.file.url;
      }
      file = {
        url,
        sha256: text(given.file.sha256) || null,
        bytes: Number.isFinite(given.file.bytes) ? given.file.bytes : null,
        key: text(given.file.key) || null
      };
    }
    // A study or a protocol with no file names nothing to open.
    if (given.kind !== 'settings' && !file) continue;
    if (given.kind === 'settings' && !isRecord(given.settings)) continue;
    const entry = {
      id: given.id,
      kind: given.kind,
      name: text(given.name) || given.id,
      about: text(given.about),
      facts: isRecord(given.facts) ? { ...given.facts } : {},
      mark: KIND_MARKS[given.kind],
      file,
      settings: given.kind === 'settings' ? { ...given.settings } : null
    };
    entry.line = text(given.line) || factsLine(entry);
    entries.push(entry);
  }
  return entries;
}

/**
 * Fetch a studies feed.
 * @param {string} url The feed's address: `studies/index.json` beside study.builder's files.
 * @param {{fetch?: Function, kinds?: string[]}} [options] Something else to fetch with; the kinds to keep.
 * @returns {Promise<Object[]>} The entries, as `readStudies` gives them. Throws a StudyBuilderError when the feed cannot be fetched or read.
 */
export async function listStudies(url, { fetch: get = globalThis.fetch, kinds = null } = {}) {
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
  const entries = readStudies(document, base);
  return Array.isArray(kinds) ? entries.filter((entry) => kinds.includes(entry.kind)) : entries;
}

/**
 * Describe an entry of the feed, or a study that is open, as plain JSON.
 * @param {Object} given An entry, or what `openStudy`, `openListed` or `buildStudy` gave.
 * @returns {Object} For an entry: its `id`, `kind`, `name`, `about`, `facts`, `line`, `mark` and whether it has a file. For an open study: its `id`, `snapshotDate`, `snapshots`, the overview's `facts` and `counts`, and each layer with its tables, their rows and their column names.
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
    mark: KIND_MARKS[given.kind],
    file: given.file ? { bytes: given.file.bytes, sha256: given.file.sha256 } : null
  };
}

const hex = (buffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Open what an entry names. A file is fetched and checked against the feed's
 * checksum before it is read; one that does not match is refused.
 * @param {Object} entry An entry of the feed.
 * @param {{fetch?: Function, subtle?: Object}} [options] Something else to fetch or to hash with.
 * @returns {Promise<{kind: string, study?: Object, protocol?: Object, settings?: Object}>} A study opened (`kind: 'study'`), a protocol document, or settings to build from.
 */
export async function openListed(
  entry,
  {
    fetch: get = globalThis.fetch,
    subtle = globalThis.crypto && globalThis.crypto.subtle ? globalThis.crypto.subtle : null
  } = {}
) {
  if (!isRecord(entry) || !STUDY_KINDS.includes(entry.kind)) {
    throw new StudyBuilderError('That is not an entry of the studies feed.');
  }
  if (entry.kind === 'settings') return { kind: 'settings', settings: { ...entry.settings } };
  let bytes;
  try {
    const response = await get(entry.file.url);
    if (!response || !response.ok)
      throw new Error(`the page answered ${response && response.status}`);
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    throw new StudyBuilderError(
      `${entry.name} could not be fetched: ${error && error.message ? error.message : error}.`
    );
  }
  if (entry.file.sha256) {
    if (!subtle) {
      throw new StudyBuilderError(
        `${entry.name} cannot be checked against its checksum here: this page cannot hash a file.`
      );
    }
    const sum = hex(await subtle.digest('SHA-256', bytes));
    if (sum !== entry.file.sha256) {
      throw new StudyBuilderError(
        `${entry.name} is not the file its list names. It was not opened.`
      );
    }
  }
  const document = await documentOf({ arrayBuffer: async () => bytes.buffer });
  if (entry.kind === 'protocol') return { kind: 'protocol', protocol: document };
  if (entry.file.key && document.key !== entry.file.key) {
    throw new StudyBuilderError(
      `${entry.name} is not the study its list names. It was not opened.`
    );
  }
  return { kind: 'study', study: await openStudy(document) };
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
