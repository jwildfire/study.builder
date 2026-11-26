// study.builder on a page: three modules, and the way between them.
//
//   portfolio   the studies a reader can have at once (ready-made, and saved
//               in this browser), and the settings that build one; the way in.
//               ../portfolio
//   builder     the form: the trial, its schedule, its layers as the pipeline
//               they are, its raw domains, and what building it will give.
//               ../builder
//   study       the study that is open: what it is, what to do with it, and
//               study.viewer to look through it. ../study
//
//   StudyBuilder.mount('#builder', { onStudy(study) { /* load study.files() */ } });
//
// This module holds what the three share (the form, the open study, what was
// last said) and decides when the engine is asked. Each module draws its own
// screen. The engine (../engine) makes and keeps studies; the viewer
// (../viewer) shows one.

import { DEFAULTS, DOMAINS, LAYERS, readSettings } from '../engine/core.js';
import { createBuilder } from '../engine/build.js';
import { createShelf, fetchPresets, openStudy, readDocument } from '../engine/saved.js';
import { injectStyles } from '../shared/styles.js';
import { watchHostTheme } from '../shared/theme.js';
import { domOf, messageOf, saveFile, themed } from '../shared/dom.js';
import { portfolioScreen } from '../portfolio/screen.js';
import { builderScreen, takeProtocol } from '../builder/screen.js';
import { studyScreen } from '../study/screen.js';

export { STAGES, downloadsSaid } from '../builder/screen.js';
export { sizeSaid } from '../portfolio/screen.js';
export { mountStudy } from '../study/widget.js';
export { saveFile };

/**
 * Mount study.builder: the portfolio, the builder and the study view.
 * @param {string|Element} target The element, or a selector for it, to draw into.
 * @param {Object} [options]
 * @param {Object} [options.settings] What the form opens on, as `readSettings` takes settings.
 * @param {Object} [options.study] A built study to open on, as `buildStudy` or `openStudy` gives one.
 * @param {{view: string, table: string}} [options.viewing] Where the study's views open.
 * @param {(at: Object) => void} [options.onView] Called as the reader moves between the study's views and tables.
 * @param {string} [options.screen] The screen to open on: `library` (the portfolio, unless there is nothing to list) or `describe` (the builder).
 * @param {string} [options.base] The address study.builder's `r/`, `vendor/` and `presets/` folders are served under.
 * @param {{run: Function}} [options.connection] A connection to R the page already has.
 * @param {(options: Object) => {run: Function}} [options.createConnection] The page's own way of making a connection to R, so one R is shared.
 * @param {string} [options.repository] Where gsm's own packages are installed from, for a page that already serves them.
 * @param {(study: Object) => void} [options.onBuilt] Called with each study as it is built or opened.
 * @param {(study: Object) => void} [options.onStudy] Called when the reader presses the button that hands the study to the page. With none, there is no such button.
 * @param {string} [options.useLabel] That button's words.
 * @param {?string} [options.theme] `light` or `dark`. Unless told, the widget matches the page behind it.
 * @param {string|Object[]|false} [options.presets] Ready-made studies and settings: the address of a list (`presets/index.json` under the base unless told), the presets themselves, or `false` for none.
 * @param {Object|false} [options.shelf] Where the reader's saved studies and settings are kept (`createShelf`); this browser unless told, and `false` for nowhere.
 * @param {Array<{label: string, url: string}>|false} [options.protocols] Ready-made protocols the form offers to try, each a name and the address of a protocol file; the CDISC pilot protocol under the base unless told, and `false` for none.
 * @param {Function} [options.createBuilder] Something else to make the builder with; used by the tests.
 * @param {(name: string, bytes: Uint8Array|string, type: string) => void} [options.save] Something else to save a file with; used by the tests.
 * @returns {{build: Function, open: Function, show: Function, study: Function, settings: Function, state: Function, destroy: Function}} The handle.
 */
export function mount(
  target,
  {
    settings: opening = {},
    screen: openingScreen = null,
    study: openingStudy = null,
    viewing: openingViewing = null,
    onView = null,
    base = './',
    connection = null,
    createConnection: connect = null,
    repository = null,
    onBuilt = null,
    onStudy = null,
    useLabel = 'Use this study',
    theme = null,
    createBuilder: make = createBuilder,
    save = saveFile,
    presets: presetsGiven = undefined,
    shelf: shelfGiven = undefined,
    protocols: protocolsGiven = undefined
  } = {}
) {
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) throw new Error('study.builder: there is no element to mount into.');
  const doc = root.ownerDocument;
  injectStyles(doc);
  const { el, button } = domOf(doc);

  const withSlash = base.endsWith('/') ? base : `${base}/`;
  const readyProtocols =
    protocolsGiven === false
      ? []
      : Array.isArray(protocolsGiven)
        ? protocolsGiven
        : [
            {
              label: 'CDISC pilot protocol',
              url: `${withSlash}protocols/cdisc-pilot.protocol.json`
            }
          ];
  const shelf = shelfGiven === false ? null : shelfGiven || createShelf();

  // What the three modules share. Each screen reads it and changes it.
  const s = {
    form: { ...DEFAULTS, ...opening },
    chosen: new Set(),
    layersChosen: new Set(),
    presets: Array.isArray(presetsGiven) ? presetsGiven : [],
    shelved: [],
    screen: openingStudy ? 'study' : openingScreen === 'describe' ? 'describe' : 'library',
    // idle → building → idle, or → failed.
    phase: 'idle',
    stage: '',
    problems: [],
    failure: '',
    said: '', // what the last open or save did, in a sentence
    saidKind: 'note',
    study: openingStudy || null,
    builds: 0,
    viewer: null, // study.viewer, while the study screen is on the page
    viewing: { ...(openingViewing || {}) }, // where the reader was in the viewer
    touched: false, // whether the reader has done anything yet
    destroyed: false
  };

  const take = (settings) => {
    s.form = { ...DEFAULTS, ...settings };
    s.chosen = new Set(
      (Array.isArray(s.form.domains) ? s.form.domains : DEFAULTS.domains).filter((id) =>
        DOMAINS.some((domain) => domain.id === id && !domain.core)
      )
    );
    s.layersChosen = new Set(
      (Array.isArray(s.form.layers) ? s.form.layers : DEFAULTS.layers).filter((id) =>
        LAYERS.some((layer) => layer.id === id && layer.optional)
      )
    );
  };
  take(s.form);

  const builder = make({
    base,
    connection,
    ...(typeof connect === 'function' ? { createConnection: connect } : {}),
    ...(repository ? { repository } : {}),
    onStage: (name) => {
      if (s.phase !== 'building') return;
      s.stage = name === 'source' ? 'simulate' : name;
      draw();
    }
  });

  const current = () => ({
    ...s.form,
    domains: [...s.chosen],
    layers: LAYERS.filter((layer) => s.layersChosen.has(layer.id)).map((layer) => layer.id)
  });
  const say = (sentence, kind = 'note') => {
    s.said = sentence;
    s.saidKind = kind;
  };
  /** Whether the portfolio has anything to list. */
  const listed = () => s.presets.length > 0 || s.shelved.length > 0;
  const go = (next) => {
    s.screen = next;
    draw();
  };

  /** Show a study, built or opened. */
  function show(next, sentence = '') {
    s.study = next;
    s.viewing = {};
    s.phase = 'idle';
    s.failure = '';
    say(sentence);
    go('study');
    if (typeof onBuilt === 'function') onBuilt(s.study);
  }

  async function build() {
    if (s.phase === 'building' || s.destroyed) return null;
    const read = readSettings(current());
    s.problems = read.problems;
    if (!read.args) {
      go('describe');
      return null;
    }
    const mine = ++s.builds;
    s.phase = 'building';
    s.failure = '';
    say('');
    s.stage = builder.started() ? 'simulate' : 'runtime';
    go('describe');
    let built;
    try {
      built = await builder.build(current());
    } catch (error) {
      if (mine !== s.builds || s.destroyed) return null;
      s.phase = 'failed';
      s.failure = messageOf(error);
      draw();
      return null;
    }
    if (mine !== s.builds || s.destroyed) return null;
    show(built);
    return s.study;
  }

  async function refreshShelf() {
    if (!shelf || !shelf.available) return;
    try {
      s.shelved = await shelf.list();
    } catch {
      s.shelved = [];
    }
    if (!s.destroyed) draw();
  }

  /** Open a document: a study is shown at once, and settings fill the form. */
  async function openDocument(given, from) {
    const { kind, document } = readDocument(given);
    s.problems = [];
    if (kind === 'protocol') {
      takeProtocol(app, document, from);
      return;
    }
    take(document.settings);
    if (kind === 'study') {
      const opened = await openStudy(document);
      s.builds += 1; // a build still running is no longer the one to show
      show(opened, `Opened ${from}. Nothing was built.`);
    } else {
      say(`These are the settings of ${document.name}, ${from}. Build makes the study.`);
      go('describe');
    }
  }

  async function keep(document, what) {
    try {
      const entry = await shelf.save(document);
      say(`${what} is saved in this browser as ${entry.name}, and is sent nowhere.`);
    } catch (error) {
      say(messageOf(error), 'problem');
    }
    await refreshShelf();
    draw();
  }

  const attempt = async (work) => {
    try {
      await work();
    } catch (error) {
      say(messageOf(error), 'problem');
      draw();
    }
  };

  function saidLine() {
    if (!s.said) return null;
    const line = el('p', 'sb-said', s.said);
    line.dataset.kind = s.saidKind;
    line.setAttribute('role', s.saidKind === 'problem' ? 'alert' : 'status');
    return line;
  }

  /** A hidden file input, and the button that opens it. */
  function fileButton() {
    const file = el('input');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.hidden = true;
    file.dataset.action = 'file';
    file.onchange = () => {
      const [picked] = file.files || [];
      if (picked) attempt(async () => openDocument(await picked.text(), `from ${picked.name}`));
    };
    const press = button('', 'Open a file…', () => file.click(), 'open-file');
    const wrap = el('span', 'sb-file');
    wrap.append(press, file);
    return wrap;
  }

  // What a screen is handed: the shared state, and what the page can do.
  const app = {
    s,
    el,
    button,
    shelf,
    builder,
    readyProtocols,
    save,
    go,
    draw,
    say,
    take,
    show,
    build,
    current,
    listed,
    keep,
    attempt,
    saidLine,
    fileButton,
    refreshShelf,
    openDocument
  };

  function study() {
    const { page, viewer } = studyScreen({
      el,
      button,
      study: s.study,
      theme,
      save,
      viewing: s.viewing,
      onChange: (at) => {
        s.viewing = at;
        if (typeof onView === 'function') onView(at);
      },
      shelf,
      keep,
      onStudy,
      useLabel,
      listed,
      go,
      saidLine
    });
    s.viewer = viewer;
    return page;
  }

  // The page can change its theme while the widget is open.
  const stopTheme = theme
    ? () => {}
    : watchHostTheme(root, () => {
        const shell = root.querySelector(':scope > .sb');
        if (shell && !s.destroyed) themed(shell, theme, root);
      });

  function draw() {
    if (s.destroyed) return;
    const active = doc.activeElement;
    const focused = active && root.contains(active) ? active.getAttribute('name') : null;
    if (s.viewer) s.viewer.destroy();
    s.viewer = null;
    root.textContent = '';
    const shell = el('div', 'sb');
    themed(shell, theme, root);
    // With nothing to list, the portfolio is only a way to the form.
    if (s.screen === 'library' && !listed()) s.screen = 'describe';
    if (s.screen === 'study' && !s.study) s.screen = 'describe';
    shell.append(
      s.screen === 'study'
        ? study()
        : s.screen === 'library'
          ? portfolioScreen(app)
          : builderScreen(app)
    );
    root.append(shell);
    if (focused) {
      const again = root.querySelector(`[name="${focused}"]`);
      if (again && !again.disabled) again.focus();
    }
  }

  draw();
  root.addEventListener('input', () => {
    s.touched = true;
  });
  root.addEventListener('click', () => {
    s.touched = true;
  });
  // The portfolio fills in as the page's presets and the shelf answer. A reader
  // who has done nothing yet is taken to it once it has something to list.
  const arrived = () => {
    if (s.destroyed) return;
    const waiting =
      s.screen === 'describe' && openingScreen !== 'describe' && s.phase === 'idle' && !s.study;
    if (waiting && !s.touched) s.screen = 'library';
    draw();
  };
  if (shelf && shelf.available) {
    shelf.list().then(
      (found) => {
        s.shelved = found;
        if (found.length) arrived();
      },
      () => {}
    );
  }
  if (presetsGiven !== false && !Array.isArray(presetsGiven)) {
    const from = typeof presetsGiven === 'string' ? presetsGiven : `${withSlash}presets/index.json`;
    fetchPresets(from).then((found) => {
      if (s.destroyed || !found.length) return;
      s.presets = found;
      arrived();
    });
  }

  return {
    /** Build the study the form describes, as pressing Build does. */
    build,
    /** Open a study or settings document, as choosing its file does. */
    open: (document) => openDocument(document, 'as the page asked'),
    /** Show a screen: `library`, `describe` or `study`. */
    show: (next) => {
      if (['library', 'describe', 'study'].includes(next)) go(next);
    },
    /** The study that is open, or null. */
    study: () => s.study,
    /** What the form holds now. */
    settings: current,
    /** What is on the page: for the tests, and a host that wants to follow along. */
    state: () => ({
      screen: s.screen,
      phase: s.phase,
      stage: s.stage,
      problems: [...s.problems],
      failure: s.failure,
      said: s.said,
      presets: s.presets.map((preset) => preset.id),
      shelved: s.shelved.map((entry) => entry.id),
      viewing: { ...s.viewing }
    }),
    /** Empty the element and let go of R, when it is study.builder's own. */
    destroy() {
      s.destroyed = true;
      stopTheme();
      if (s.viewer) s.viewer.destroy();
      root.textContent = '';
      builder.close();
    }
  };
}
