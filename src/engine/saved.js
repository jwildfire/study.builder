// Saving and opening: a study that was built can be kept and opened again
// with no R and no wait, and the settings that describe a study can be kept
// and built again. Both are plain JSON documents, named by a format.
//
//   settings   study.builder/config/1   what the form holds; building makes the study
//   a study    study.builder/study/1    the settings, and what R returned for them
//   presets    study.builder/presets/1  a list a page serves: each one settings,
//                                       and, for some, the address of a study file
//
// A study file holds what R returned, as it returned it, so opening one makes
// the same study a build made: the same tables, metadata, manifest and key.
// The key it was saved with is checked when it is opened.
//
// A shelf keeps documents in the reader's own browser (IndexedDB). Nothing
// here sends a document anywhere.

import { DEFAULTS, OUTLIERS, readSettings } from './core.js';
import { StudyBuilderError, studyOf } from './build.js';
import { manifestOf } from './manifest.js';
import { PROTOCOL_FORMAT, ProtocolError, isUsdm, readProtocol, readUsdm } from './protocol.js';

/** The formats, by name and version. */
export const CONFIG_FORMAT = 'study.builder/config/1';
export const STUDY_FORMAT = 'study.builder/study/1';
export const PRESETS_FORMAT = 'study.builder/presets/1';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** The protocol a study was built to, from what R was asked for. */
export function protocolOfArgs(args) {
  if (!args || !args.protocol) return null;
  const { plan: _plan, ...protocol } = JSON.parse(args.protocol);
  return protocol;
}

/** The efficacy score a study was built with, from what R was asked for. */
export function efficacyOfArgs(args) {
  if (!args || !args.efficacy) return null;
  const [score] = JSON.parse(args.efficacy).scores;
  const { day: _day, ...efficacy } = score;
  return efficacy;
}

/**
 * Settings as a form holds them, from what R was asked for.
 * @param {Object} args The arguments `readSettings` made.
 * @returns {Object} The settings.
 */
export function settingsOfArgs(args) {
  const outliers = OUTLIERS.find((entry) => entry.intensity === args.outlier_intensity);
  return {
    name: args.study_name,
    phase: args.phase,
    area: args.therapeutic_area,
    participants: args.participants,
    sites: args.sites,
    months: args.months,
    outliers: outliers ? outliers.id : DEFAULTS.outliers,
    seed: args.seed === undefined ? null : args.seed,
    ...(args.history ? { snapshots: 'all' } : {}),
    domains: [...args.domains],
    layers: [...args.layers],
    ...(args.protocol ? { protocol: protocolOfArgs(args) } : {}),
    ...(args.efficacy ? { efficacy: efficacyOfArgs(args) } : {}),
    ...(args.assumptions ? { assumptions: assumptionsOfArgs(args) } : {})
  };
}

/** What the simulator was told to assume of a study, from what R was asked for. */
export function assumptionsOfArgs(args) {
  if (!args || !args.assumptions) return null;
  const sent = JSON.parse(args.assumptions);
  return {
    dropout: sent.dropout ? sent.dropout.rate : 0,
    ...(sent.dropout && sent.dropout.arms ? { dropoutByArm: { ...sent.dropout.arms } } : {}),
    ...(sent.events ? { eventRatio: sent.events.ratio } : {})
  };
}

/** Settings read and written back whole, or an error that says what is wrong with them. */
function wholeSettings(settings, what) {
  const read = readSettings(settings);
  if (!read.args) {
    throw new StudyBuilderError(
      `${what} cannot be used. ${read.problems.join(' ')}`,
      read.problems
    );
  }
  return { settings: settingsOfArgs(read.args), args: read.args };
}

/**
 * Settings, as a document to keep.
 * @param {Object} settings As `readSettings` takes them.
 * @param {{name?: string, about?: string}} [said] What to call it, and a sentence about it.
 * @returns {Object} The document. Throws a StudyBuilderError when the settings would not build.
 */
export function configOf(settings, { name = '', about = '' } = {}) {
  const whole = wholeSettings(settings, 'These settings');
  return {
    format: CONFIG_FORMAT,
    name: text(name) || whole.settings.name,
    about: text(about),
    settings: whole.settings
  };
}

/**
 * A built study, as a document to keep: its settings and what R returned.
 * @param {Object} study What `buildStudy` or `openStudy` resolved to.
 * @param {{name?: string, about?: string}} [said] What to call it, and a sentence about it.
 * @returns {Object} The document.
 */
export function savedOf(study, { name = '', about = '' } = {}) {
  if (!study || typeof study.source !== 'function') {
    throw new StudyBuilderError('This is not a study study.builder built, so it cannot be saved.');
  }
  return {
    format: STUDY_FORMAT,
    name: text(name) || study.id,
    about: text(about) || study.said,
    key: study.manifest ? study.manifest.key : null,
    settings: settingsOfArgs(study.args),
    study: study.source()
  };
}

/**
 * Open a study that was saved: no R is asked for.
 * @param {Object} document What `savedOf` made, read back from a file, a shelf or a page's address.
 * @returns {Promise<Object>} The study, as a build would have made it, with `opened: true`.
 */
export async function openStudy(document) {
  if (!isRecord(document) || document.format !== STUDY_FORMAT) {
    throw new StudyBuilderError(`This is not a study file: its format is not ${STUDY_FORMAT}.`);
  }
  const { args } = wholeSettings(document.settings, 'The study file’s settings');
  let study;
  try {
    study = studyOf(document.study, args);
  } catch (error) {
    throw new StudyBuilderError(
      `The study file cannot be read. ${error && error.message ? error.message : error}`
    );
  }
  study.manifest = await manifestOf(study);
  if (document.key && document.key !== study.manifest.key) {
    throw new StudyBuilderError(
      'The study file is not as it was saved: its tables do not give the key it was saved with.'
    );
  }
  study.opened = true;
  return study;
}

/**
 * Read a document a reader chose or a page fetched: what kind it is, and it.
 * @param {string|Object} given The file's text, or what it parsed to.
 * @returns {{kind: 'config'|'study'|'protocol', document: Object}} The kind and the document; a protocol's document is the protocol, read. Throws a StudyBuilderError that says why when it is neither.
 */
export function readDocument(given) {
  let document = given;
  if (typeof given === 'string') {
    try {
      document = JSON.parse(given);
    } catch {
      throw new StudyBuilderError('This file is not JSON, so it is not a study or settings file.');
    }
  }
  if (isRecord(document) && document.format === STUDY_FORMAT) return { kind: 'study', document };
  // A protocol: study.builder's own, or a CDISC USDM study definition.
  if (isRecord(document) && (document.format === PROTOCOL_FORMAT || isUsdm(document))) {
    try {
      const protocol = isUsdm(document) ? readUsdm(document) : readProtocol(document);
      return { kind: 'protocol', document: protocol };
    } catch (error) {
      if (error instanceof ProtocolError) throw new StudyBuilderError(error.message);
      throw error;
    }
  }
  if (isRecord(document) && document.format === CONFIG_FORMAT) {
    const whole = wholeSettings(document.settings, 'The settings file');
    return { kind: 'config', document: { ...document, settings: whole.settings } };
  }
  throw new StudyBuilderError(
    `This file is not one study.builder saved: its format is neither ${STUDY_FORMAT} nor ${CONFIG_FORMAT}, and it is not a protocol.`
  );
}

/**
 * Read a list of presets: each a name, settings and, for some, where its
 * study file is. A preset whose settings would not build is left out.
 * @param {Object} document The list, as a page serves it.
 * @param {string} [from] The address the list was fetched from; a study's address is read against it.
 * @returns {Array<{id: string, name: string, about: string, settings: Object, study: ?string, key: ?string, megabytes: ?number}>} The presets.
 */
export function readPresets(document, from = '') {
  if (!isRecord(document) || document.format !== PRESETS_FORMAT) {
    throw new StudyBuilderError(
      `This is not a list of presets: its format is not ${PRESETS_FORMAT}.`
    );
  }
  const presets = [];
  for (const entry of Array.isArray(document.presets) ? document.presets : []) {
    if (!isRecord(entry) || !text(entry.id) || presets.some((other) => other.id === entry.id)) {
      continue;
    }
    const read = readSettings(entry.settings);
    if (!read.args) continue;
    let study = null;
    if (text(entry.study)) {
      try {
        study = from ? new URL(entry.study, from).href : entry.study;
      } catch {
        study = entry.study;
      }
    }
    presets.push({
      id: entry.id,
      name: text(entry.name) || entry.id,
      about: text(entry.about),
      settings: settingsOfArgs(read.args),
      study,
      key: text(entry.key) || null,
      megabytes: Number.isFinite(entry.megabytes) ? entry.megabytes : null
    });
  }
  return presets;
}

/**
 * Fetch a page's presets. A page with none, or one that cannot be reached, has none.
 * @param {string} url The list's address.
 * @param {{fetch?: Function}} [options] Something else to fetch with; used by the tests.
 * @returns {Promise<Object[]>} The presets, as `readPresets` gives them; none when the list is not there.
 */
export async function fetchPresets(url, { fetch: get = globalThis.fetch } = {}) {
  try {
    const response = await get(url);
    if (!response || !response.ok) return [];
    const base =
      typeof globalThis.location === 'object' && globalThis.location
        ? new URL(url, globalThis.location.href).href
        : url;
    return readPresets(await response.json(), base);
  } catch {
    return [];
  }
}

/**
 * A fetched study file as a document. A hosted study is kept gzipped, since a
 * study's tables are text and shrink to a twentieth; a host serves the file as
 * it is, so it is unpacked here. One that is plain JSON is read as it is.
 * @param {Response} response What the fetch answered.
 * @returns {Promise<Object>} The document.
 */
export async function documentOf(response) {
  if (typeof response.arrayBuffer !== 'function') return response.json();
  const bytes = new Uint8Array(await response.arrayBuffer());
  const gzipped = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!gzipped) return JSON.parse(new TextDecoder().decode(bytes));
  if (typeof globalThis.DecompressionStream !== 'function') {
    throw new Error('this browser cannot unpack a gzipped file');
  }
  const packed = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
  const reader = packed.pipeThrough(new DecompressionStream('gzip')).getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}

/**
 * Open a preset: its study at once when the page hosts one, and its settings
 * otherwise.
 * @param {Object} preset One of what `readPresets` gave.
 * @param {{fetch?: Function}} [options] Something else to fetch with; used by the tests.
 * @returns {Promise<{settings: Object, study: ?Object}>} The settings, and the study when one is hosted.
 */
export async function openPreset(preset, { fetch: get = globalThis.fetch } = {}) {
  if (!preset.study) return { settings: preset.settings, study: null };
  let document;
  try {
    const response = await get(preset.study);
    if (!response || !response.ok) {
      throw new Error(`the page answered ${response && response.status}`);
    }
    document = await documentOf(response);
  } catch (error) {
    throw new StudyBuilderError(
      `The study for ${preset.name} could not be fetched: ${error && error.message ? error.message : error}. Its settings are in the form, and Build makes it.`
    );
  }
  if (preset.key && document.key !== preset.key) {
    throw new StudyBuilderError(
      `The study for ${preset.name} is not the one its list names. Its settings are in the form, and Build makes it.`
    );
  }
  return { settings: preset.settings, study: await openStudy(document) };
}

// ---- the shelf: documents kept in the reader's own browser ----

const DATABASE = 'study.builder';
const STORES = ['index', 'documents'];

const asked = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** IndexedDB, as the two stores a shelf keeps: an index to list, and the documents. */
function browserBackend(indexedDB) {
  let opening = null;
  const open = () => {
    if (!opening) {
      opening = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        request.onupgradeneeded = () => {
          for (const store of STORES) {
            if (!request.result.objectStoreNames.contains(store)) {
              request.result.createObjectStore(store);
            }
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }).catch((error) => {
        opening = null;
        throw error;
      });
    }
    return opening;
  };
  const store = async (name, mode) => (await open()).transaction(name, mode).objectStore(name);
  return {
    all: async (name) => asked((await store(name, 'readonly')).getAll()),
    get: async (name, id) => asked((await store(name, 'readonly')).get(id)),
    put: async (name, id, value) => asked((await store(name, 'readwrite')).put(value, id)),
    remove: async (name, id) => asked((await store(name, 'readwrite')).delete(id))
  };
}

/** A backend kept in memory: for a page with no IndexedDB that still wants a shelf, and the tests. */
export function memoryBackend() {
  const stores = Object.fromEntries(STORES.map((name) => [name, new Map()]));
  return {
    all: async (name) => [...stores[name].values()],
    get: async (name, id) => stores[name].get(id),
    put: async (name, id, value) => void stores[name].set(id, value),
    remove: async (name, id) => void stores[name].delete(id)
  };
}

/**
 * A shelf: studies and settings kept in this browser, to open again.
 * @param {Object} [options]
 * @param {Object} [options.backend] Where they are kept; this browser's IndexedDB unless told.
 * @param {() => Date} [options.now] The clock; used by the tests.
 * @returns {{available: boolean, list: Function, save: Function, open: Function, remove: Function}} The shelf. `available` is false in a browser with nowhere to keep them, and every call then keeps nothing.
 */
export function createShelf({ backend = null, now = () => new Date() } = {}) {
  let kept = backend;
  if (!kept) {
    try {
      if (globalThis.indexedDB) kept = browserBackend(globalThis.indexedDB);
    } catch {
      kept = null;
    }
  }
  const available = Boolean(kept);
  return {
    available,

    /** What is on the shelf, newest first: each an id, a kind, a name, when it was saved and how large it is. */
    async list() {
      if (!available) return [];
      const entries = await kept.all('index');
      return entries.sort((a, b) => String(b.saved).localeCompare(String(a.saved)));
    },

    /**
     * Keep a document. One of the same kind and name is replaced.
     * @param {Object} document What `savedOf` or `configOf` made.
     * @returns {Promise<Object>} Its entry in the list.
     */
    async save(document) {
      if (!available) {
        throw new StudyBuilderError(
          'This browser has nowhere to keep it. Download the file instead.'
        );
      }
      const { kind } = readDocument(document);
      const id = `${kind}:${document.name}`;
      const settings = document.settings;
      const entry = {
        id,
        kind,
        name: document.name,
        about: document.about || '',
        saved: now().toISOString(),
        bytes: JSON.stringify(document).length,
        size: `${settings.participants} participants, ${settings.sites} sites, ${settings.months} months`
      };
      try {
        await kept.put('documents', id, document);
        await kept.put('index', id, entry);
      } catch (error) {
        throw new StudyBuilderError(
          `It could not be kept in this browser: ${error && error.message ? error.message : error}. Download the file instead.`
        );
      }
      return entry;
    },

    /** The document with an id, or null when the shelf does not hold it. */
    async open(id) {
      if (!available) return null;
      return (await kept.get('documents', id)) || null;
    },

    /** Take a document off the shelf. */
    async remove(id) {
      if (!available) return;
      await kept.remove('documents', id);
      await kept.remove('index', id);
    }
  };
}
