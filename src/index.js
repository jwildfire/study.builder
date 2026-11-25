// study.builder: simulate a clinical trial in the browser with gsm.datasim,
// and hand its data to any page.
//
//   StudyBuilder.mount(target, options)        the builder, drawn on a page
//   StudyBuilder.buildStudy(settings, options) a study with no page at all
//   StudyBuilder.createBuilder(options)        the same, keeping R for more

import { mount as mountAt } from './loader/widget.js';
import { buildStudy as build, createBuilder as create } from './engine/build.js';

/* global __STUDY_BUILDER_VERSION__ */

/** study.builder's version. */
export const version =
  typeof __STUDY_BUILDER_VERSION__ === 'string' ? __STUDY_BUILDER_VERSION__ : 'dev';

// The folder of the script that defined StudyBuilder: its `r/` and `vendor/`
// folders are served beside it, so that is where R's files are fetched from
// unless a page says otherwise.
const scriptBase = (() => {
  try {
    const script = typeof document !== 'undefined' ? document.currentScript : null;
    return script && script.src ? new URL('.', script.src).href : './';
  } catch {
    return './';
  }
})();
const withBase = (options = {}) => ({ base: scriptBase, ...options });

/** Mount the builder on a page; see widget.js. */
export const mount = (target, options) => mountAt(target, withBase(options));
/** Build one study with no page; see build.js. */
export const buildStudy = (settings, options) => build(settings, withBase(options));
/** A builder that keeps R between studies; see build.js. */
export const createBuilder = (options) => create(withBase(options));

export {
  AREAS,
  CAVEATS,
  DEFAULTS,
  DEFAULT_DOMAINS,
  DOMAINS,
  LIMITS,
  OUTLIERS,
  PHASES,
  STANDARD,
  readSettings,
  withLayerNeeds,
  withNeeds,
  withPhase
} from './engine/core.js';
export { DOWNLOADS, PACKAGES, StudyBuilderError, rOptions, studyOf } from './engine/build.js';
export { WEBR_VERSION, createConnection } from './engine/r.js';
export { firstRows } from './shared/csv.js';
export { columnsOf, overviewOf } from './engine/overview.js';
export { zipOf } from './engine/zip.js';
export { COPIED_FROM } from './engine/files.js';
export { KEYS, RAW_LABELS, RESULT_LABELS, metadataOf } from './engine/metadata.js';
export { MANIFEST_FORMAT, manifestOf } from './engine/manifest.js';
export {
  CONFIG_FORMAT,
  PRESETS_FORMAT,
  STUDY_FORMAT,
  configOf,
  createShelf,
  fetchPresets,
  memoryBackend,
  openPreset,
  openStudy,
  readDocument,
  readPresets,
  savedOf,
  settingsOfArgs
} from './engine/saved.js';
