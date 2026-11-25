// The study loader, on a page: pick a study, or describe one, and hand it on.
// Three screens.
//
//   library    the studies a reader can have at once (ready-made, and saved in
//              this browser), and the settings that build one; the way in.
//   describe   the form: the trial, its layers as the pipeline they are, its
//              raw domains, and what building it will give.
//   study      the study that is open: what it is, what to do with it, and
//              study.viewer to look through it.
//
//   StudyBuilder.mount('#builder', { onStudy(study) { /* load study.files() */ } });
//
// This module draws and decides when the engine is asked. The engine
// (../engine) makes and keeps studies; the viewer (../viewer) shows one.

import {
  AREAS,
  CAVEATS,
  DEFAULTS,
  DOMAINS,
  LAYERS,
  LIMITS,
  OUTLIERS,
  PHASES,
  readSettings,
  withLayerNeeds,
  withNeeds,
  withPhase
} from '../engine/core.js';
import { DOWNLOADS, createBuilder } from '../engine/build.js';
import { overviewOf } from '../engine/overview.js';
import { zipOf } from '../engine/zip.js';
import {
  configOf,
  createShelf,
  fetchPresets,
  openPreset,
  openStudy,
  readDocument,
  savedOf
} from '../engine/saved.js';
import {
  ACTIVITY_DOMAINS,
  planOf,
  protocolSaid,
  protocolSettings,
  readProtocol
} from '../engine/protocol.js';
import { mountViewer } from '../viewer/widget.js';
import { fromBuilt } from '../viewer/built.js';
import { injectStyles } from './styles.js';

/** The steps of a build, in order, each with its words. */
export const STAGES = Object.freeze([
  Object.freeze({ id: 'runtime', label: 'Start R in this browser' }),
  Object.freeze({ id: 'packages', label: 'Install R’s packages' }),
  Object.freeze({ id: 'files', label: 'Fetch gsm.datasim' }),
  Object.freeze({ id: 'simulate', label: 'Simulate the study and build its layers' })
]);

const count = (number, noun) =>
  `${Number(number).toLocaleString('en-US')} ${noun}${Number(number) === 1 ? '' : 's'}`;
const messageOf = (error) => (error && error.message ? error.message : String(error));

/** What pressing Build downloads the first time, in a sentence. */
export function downloadsSaid(downloads = DOWNLOADS) {
  const total = Math.round(downloads.reduce((sum, entry) => sum + entry.megabytes, 0));
  return `First build in this browser: about half a minute and ${total} MB, to start R. Later builds take seconds. Nothing is sent anywhere.`;
}

/** A study's size, in a line: `150 participants · 20 sites · 9 months`. */
export function sizeSaid(settings) {
  return `${count(settings.participants, 'participant')} · ${count(settings.sites, 'site')} · ${count(settings.months, 'month')}`;
}

/**
 * Mount the loader.
 * @param {string|Element} target The element, or a selector for it, to draw into.
 * @param {Object} [options]
 * @param {Object} [options.settings] What the form opens on, as `readSettings` takes settings.
 * @param {string} [options.screen] The screen to open on: `library` (unless there is nothing to list) or `describe`.
 * @param {string} [options.base] The address study.builder's `r/`, `vendor/` and `presets/` folders are served under.
 * @param {{run: Function}} [options.connection] A connection to R the page already has.
 * @param {(options: Object) => {run: Function}} [options.createConnection] The page's own way of making a connection to R, so one R is shared.
 * @param {string} [options.repository] Where gsm's own packages are installed from, for a page that already serves them.
 * @param {(study: Object) => void} [options.onBuilt] Called with each study as it is built or opened.
 * @param {(study: Object) => void} [options.onStudy] Called when the reader presses the button that hands the study to the page. With none, there is no such button.
 * @param {string} [options.useLabel] That button's words.
 * @param {?string} [options.theme] `light` or `dark`; the reader's own setting unless told.
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

  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (className, label, onClick, action) => {
    const made = el('button', `sb-button${className ? ` ${className}` : ''}`, label);
    made.type = 'button';
    made.onclick = onClick;
    if (action) made.dataset.action = action;
    return made;
  };

  let form = { ...DEFAULTS, ...opening };
  let chosen = new Set();
  let layersChosen = new Set();
  const take = (settings) => {
    form = { ...DEFAULTS, ...settings };
    chosen = new Set(
      (Array.isArray(form.domains) ? form.domains : DEFAULTS.domains).filter((id) =>
        DOMAINS.some((domain) => domain.id === id && !domain.core)
      )
    );
    layersChosen = new Set(
      (Array.isArray(form.layers) ? form.layers : DEFAULTS.layers).filter((id) =>
        LAYERS.some((layer) => layer.id === id && layer.optional)
      )
    );
  };
  take(form);

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
  let presets = Array.isArray(presetsGiven) ? presetsGiven : [];
  const shelf = shelfGiven === false ? null : shelfGiven || createShelf();
  let shelved = [];
  let screen = openingScreen === 'describe' ? 'describe' : 'library';
  // idle → building → idle, or → failed.
  let phase = 'idle';
  let stage = '';
  let problems = [];
  let failure = '';
  let said = ''; // what the last open or save did, in a sentence
  let saidKind = 'note';
  let study = null;
  let builds = 0;
  let viewer = null; // study.viewer, while the study screen is on the page
  let viewing = {}; // where the reader was in the viewer
  let touched = false; // whether the reader has done anything yet
  let destroyed = false;

  const builder = make({
    base,
    connection,
    ...(typeof connect === 'function' ? { createConnection: connect } : {}),
    ...(repository ? { repository } : {}),
    onStage: (name) => {
      if (phase !== 'building') return;
      stage = name === 'source' ? 'simulate' : name;
      draw();
    }
  });

  const current = () => ({
    ...form,
    domains: [...chosen],
    layers: LAYERS.filter((layer) => layersChosen.has(layer.id)).map((layer) => layer.id)
  });
  const say = (sentence, kind = 'note') => {
    said = sentence;
    saidKind = kind;
  };
  /** Whether the library has anything to list. */
  const listed = () => presets.length > 0 || shelved.length > 0;
  const go = (next) => {
    screen = next;
    draw();
  };

  /** Show a study, built or opened. */
  function show(next, sentence = '') {
    study = next;
    viewing = {};
    phase = 'idle';
    failure = '';
    say(sentence);
    go('study');
    if (typeof onBuilt === 'function') onBuilt(study);
  }

  async function build() {
    if (phase === 'building' || destroyed) return null;
    const read = readSettings(current());
    problems = read.problems;
    if (!read.args) {
      go('describe');
      return null;
    }
    const mine = ++builds;
    phase = 'building';
    failure = '';
    say('');
    stage = builder.started() ? 'simulate' : 'runtime';
    go('describe');
    let built;
    try {
      built = await builder.build(current());
    } catch (error) {
      if (mine !== builds || destroyed) return null;
      phase = 'failed';
      failure = messageOf(error);
      draw();
      return null;
    }
    if (mine !== builds || destroyed) return null;
    show(built);
    return study;
  }

  async function refreshShelf() {
    if (!shelf || !shelf.available) return;
    try {
      shelved = await shelf.list();
    } catch {
      shelved = [];
    }
    if (!destroyed) draw();
  }

  /** Take a protocol: the form is filled from it, and its schedule is the form's. */
  function takeProtocol(protocol, from) {
    const filled = protocolSettings(protocol, LIMITS);
    const { domains, ...settings } = filled.settings;
    form = { ...form, ...settings, protocol };
    for (const id of domains) {
      if (DOMAINS.some((domain) => domain.id === id && !domain.core)) chosen.add(id);
    }
    say(
      [
        `The protocol ${protocol.name} is in the form, ${from}: ${protocolSaid(protocol)}.`,
        ...filled.notes,
        'Build makes a study on its schedule.'
      ].join(' ')
    );
    go('describe');
  }

  /** Change the form's protocol, and draw. A change that leaves it no protocol is said, not made. */
  function editProtocol(change) {
    const next = JSON.parse(JSON.stringify(form.protocol));
    change(next);
    try {
      form = {
        ...form,
        protocol: readProtocol({ ...next, source: { ...next.source, edited: true } })
      };
      problems = [];
    } catch (error) {
      problems = [messageOf(error)];
    }
    draw();
  }

  /**
   * A protocol's schedule as a grid: a column a visit, a row an activity. In
   * the form the cells are ticks and a visit's day can be changed; on a study
   * it is read.
   */
  function scheduleGrid(protocol, editable) {
    const wrap = el('div', 'sb-schedule');
    const grid = el('table', 'sb-grid');
    const head = el('tr');
    const corner = el('th', null, 'Activity');
    corner.scope = 'col';
    head.append(corner);
    for (const visit of protocol.visits) {
      const th = el('th');
      th.scope = 'col';
      th.dataset.visit = visit.id;
      th.append(el('span', 'sb-grid-visit', visit.name));
      if (visit.epoch) th.append(el('small', null, visit.epoch));
      if (editable) {
        const day = el('input', 'sb-grid-day');
        day.type = 'number';
        day.name = `day-${visit.id}`;
        day.value = String(visit.day);
        day.setAttribute('aria-label', `Study day of ${visit.name}`);
        day.disabled = phase === 'building';
        day.onchange = () =>
          editProtocol((next) => {
            next.visits.find((one) => one.id === visit.id).day = day.value;
          });
        th.append(day);
        const remove = el('button', 'sb-grid-remove', '✕');
        remove.type = 'button';
        remove.dataset.remove = visit.id;
        remove.setAttribute('aria-label', `Remove the visit ${visit.name}`);
        remove.disabled = phase === 'building';
        remove.onclick = () =>
          editProtocol((next) => {
            next.visits = next.visits.filter((one) => one.id !== visit.id);
          });
        th.append(remove);
      } else {
        th.append(el('small', null, `Day ${visit.day}`));
      }
      const window = visit.before || visit.after ? `−${visit.before} / +${visit.after} days` : '';
      if (window) th.append(el('small', null, window));
      head.append(th);
    }
    const top = el('thead');
    top.append(head);
    const body = el('tbody');
    const at = new Set(Object.values(protocol.schedule).flat());
    // The activities that simulate something come first.
    const listed = protocol.activities
      .filter((activity) => at.has(activity.id) || editable)
      .sort((a, b) => Number(Boolean(b.domain)) - Number(Boolean(a.domain)));
    for (const activity of listed) {
      const row = el('tr');
      row.dataset.activity = activity.id;
      if (!activity.domain) row.dataset.simulated = 'false';
      const name = el('th');
      name.scope = 'row';
      name.append(el('span', null, activity.name));
      const domain = ACTIVITY_DOMAINS.find((one) => one.id === activity.domain);
      const pill = el('span', 'sb-pill', domain ? domain.label : 'Not simulated');
      pill.dataset.kind = domain ? 'ready' : 'none';
      name.append(pill);
      if (activity.collects.length) {
        name.title = `Collects: ${activity.collects.join(', ')}`;
        name.append(el('small', null, `${activity.collects.length} listed`));
      }
      row.append(name);
      for (const visit of protocol.visits) {
        const cell = el('td');
        const on = (protocol.schedule[visit.id] || []).includes(activity.id);
        if (editable) {
          const box = el('input');
          box.type = 'checkbox';
          box.checked = on;
          box.disabled = phase === 'building';
          box.setAttribute('aria-label', `${activity.name} at ${visit.name}`);
          box.onchange = () =>
            editProtocol((next) => {
              const here = new Set(next.schedule[visit.id] || []);
              if (box.checked) here.add(activity.id);
              else here.delete(activity.id);
              next.schedule[visit.id] = [...here];
            });
          cell.append(box);
        } else if (on) {
          cell.textContent = '●';
          cell.setAttribute('aria-label', `${activity.name} at ${visit.name}`);
        }
        row.append(cell);
      }
      body.append(row);
    }
    grid.append(top, body);
    wrap.append(grid);
    return wrap;
  }

  /** The form's schedule: what the protocol is, its grid, and what can be done to it. */
  function scheduleSection() {
    const protocol = form.protocol;
    const section = el('div', 'sb-protocol');
    section.dataset.protocol = protocol.name;
    const from =
      protocol.source.kind === 'usdm'
        ? `CDISC USDM ${protocol.source.version || ''}`.trim()
        : 'study.builder protocol';
    section.append(
      el(
        'p',
        'sb-soft',
        [
          `${protocol.title || protocol.name}. Read from ${from}${protocol.source.edited ? ', and changed here' : ''}.`,
          protocol.arms.length ? `Arms: ${protocol.arms.join(', ')} (not simulated).` : '',
          'Visits, vital signs and labs are made on this schedule.'
        ]
          .filter(Boolean)
          .join(' ')
      )
    );
    section.append(scheduleGrid(protocol, true));
    const acts = el('div', 'sb-row');
    acts.append(
      button(
        '',
        'Add a visit',
        () =>
          editProtocol((next) => {
            const last = Math.max(...next.visits.map((visit) => visit.day));
            let number = next.visits.length + 1;
            while (next.visits.some((visit) => visit.name === `Visit ${number}`)) number += 1;
            const id = `added-${Date.now().toString(36)}-${number}`;
            next.visits.push({ id, name: `Visit ${number}`, day: last + 7, before: 0, after: 0 });
            next.schedule[id] = [];
          }),
        'add-visit'
      ),
      button(
        '',
        'Protocol file',
        () =>
          save(
            `${form.name}.protocol.json`,
            `${JSON.stringify(form.protocol, null, 2)}\n`,
            'application/json'
          ),
        'download-protocol'
      ),
      button(
        'sb-link',
        'Remove the protocol',
        () => {
          form = { ...form, protocol: null };
          say('The protocol is removed. The study will have the simulator’s own eight visits.');
          draw();
        },
        'remove-protocol'
      )
    );
    section.append(acts);
    return section;
  }

  /** Open a document: a study is shown at once, and settings fill the form. */
  async function openDocument(given, from) {
    const { kind, document } = readDocument(given);
    problems = [];
    if (kind === 'protocol') {
      takeProtocol(document, from);
      return;
    }
    take(document.settings);
    if (kind === 'study') {
      const opened = await openStudy(document);
      builds += 1; // a build still running is no longer the one to show
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
    if (!said) return null;
    const line = el('p', 'sb-said', said);
    line.dataset.kind = saidKind;
    line.setAttribute('role', saidKind === 'problem' ? 'alert' : 'status');
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

  // ---- the library ----

  function library() {
    const page = el('div', 'sb-screen');
    page.dataset.screen = 'library';
    const head = el('div', 'sb-head');
    const words = el('div');
    words.append(
      el('h2', null, 'Studies'),
      el('p', 'sb-lede', 'Simulated clinical trials. Open one that is ready, or describe your own.')
    );
    const actions = el('div', 'sb-row');
    actions.append(
      fileButton(),
      button('sb-primary', 'New study', () => go('describe'), 'new')
    );
    head.append(words, actions);
    page.append(head);
    const line = saidLine();
    if (line) page.append(line);

    const pill = (kind) => {
      const made = el('span', 'sb-pill', kind === 'saved' ? 'Saved by you' : 'Ready-made');
      made.dataset.kind = kind;
      return made;
    };
    const forget = (entry) => async () => {
      await shelf.remove(entry.id);
      say(`${entry.name} is no longer saved in this browser.`);
      await refreshShelf();
    };
    const ready = [
      ...shelved
        .filter((entry) => entry.kind === 'study')
        .map((entry) => ({
          id: `shelf:${entry.id}`,
          kind: 'saved',
          name: entry.name,
          size: entry.size.replace(/, /g, ' · '),
          note: `Saved ${String(entry.saved).slice(0, 10)}, in this browser only`,
          open: async () =>
            openDocument(await shelf.open(entry.id), `${entry.name}, saved in this browser`),
          remove: forget(entry)
        })),
      ...presets
        .filter((preset) => preset.study)
        .map((preset) => ({
          id: `preset:${preset.id}`,
          kind: 'ready',
          name: preset.name,
          size: sizeSaid(preset.settings),
          note: preset.megabytes ? `${preset.megabytes} MB · ${preset.about}` : preset.about,
          open: async () => {
            take(preset.settings);
            say(`Fetching ${preset.name}…`);
            draw();
            const opened = await openPreset(preset);
            builds += 1;
            show(opened.study, `Opened ${preset.name}, a ready-made study. Nothing was built.`);
          }
        }))
    ];
    page.append(el('h3', null, 'Ready now: opens at once, with no R'));
    const cards = el('div', 'sb-cards');
    for (const one of ready) {
      const card = el('div', 'sb-card');
      card.dataset.study = one.id;
      card.append(pill(one.kind), el('strong', 'sb-card-name', one.name));
      card.append(el('span', 'sb-soft', one.size));
      if (one.note) card.append(el('span', 'sb-soft', one.note));
      const row = el('div', 'sb-row sb-card-foot');
      const open = button('sb-primary', 'Open', () => attempt(one.open), 'open');
      open.setAttribute('aria-label', `Open ${one.name}`);
      row.append(open);
      if (one.remove) {
        const remove = button('', 'Remove', () => attempt(one.remove), 'remove');
        remove.setAttribute('aria-label', `Remove ${one.name} from this browser`);
        row.append(remove);
      }
      card.append(row);
      cards.append(card);
    }
    const fresh = el('div', 'sb-card sb-card-new');
    fresh.append(
      el('strong', 'sb-card-name', 'Describe a new study'),
      el(
        'span',
        'sb-soft',
        'Phase, size, domains and layers. About half a minute the first time, then a few seconds each.'
      )
    );
    const freshRow = el('div', 'sb-row sb-card-foot');
    freshRow.append(button('', 'New study', () => go('describe'), 'new-card'));
    fresh.append(freshRow);
    cards.append(fresh);
    page.append(cards);

    const plain = [
      ...shelved
        .filter((entry) => entry.kind === 'config')
        .map((entry) => ({
          id: `shelf:${entry.id}`,
          kind: 'saved',
          name: entry.name,
          about: entry.size.replace(/, /g, ' · '),
          settings: async () => (await shelf.open(entry.id)).settings,
          remove: forget(entry)
        })),
      ...presets
        .filter((preset) => !preset.study)
        .map((preset) => ({
          id: `preset:${preset.id}`,
          kind: 'ready',
          name: preset.name,
          about: [sizeSaid(preset.settings), preset.about].filter(Boolean).join('. '),
          settings: async () => preset.settings
        }))
    ];
    if (plain.length) {
      page.append(el('h3', null, 'Settings only: Build makes the study'));
      const list = el('div', 'sb-list');
      for (const one of plain) {
        const item = el('div', 'sb-item');
        item.dataset.settings = one.id;
        const text = el('div', 'sb-item-words');
        text.append(el('strong', null, one.name), el('span', 'sb-soft', one.about));
        item.append(pill(one.kind), text);
        const use = (then) => () =>
          attempt(async () => {
            take(await one.settings());
            problems = [];
            say('');
            then();
          });
        if (one.remove) item.append(button('', 'Remove', () => attempt(one.remove), 'remove'));
        const edit = button(
          '',
          'Edit',
          use(() => go('describe')),
          'edit'
        );
        edit.setAttribute('aria-label', `Edit the settings of ${one.name}`);
        const run = button(
          '',
          'Build',
          use(() => build()),
          'build-these'
        );
        run.setAttribute('aria-label', `Build ${one.name}`);
        item.append(edit, run);
        list.append(item);
      }
      page.append(list);
    }
    page.append(
      el(
        'p',
        'sb-soft sb-foot',
        'Every row is synthetic. A saved study stays in this browser and is sent nowhere; a study file can be shared like any other file.'
      )
    );
    return page;
  }

  // ---- describe ----

  function segmented(name, options, onPick) {
    const group = el('div', 'sb-seg');
    group.setAttribute('role', 'group');
    for (const [value, label] of options) {
      const one = el('button', null, label);
      one.type = 'button';
      one.dataset[name] = value;
      one.setAttribute('aria-pressed', String(String(form[name]) === String(value)));
      one.disabled = phase === 'building';
      one.onclick = () => {
        onPick(value);
        draw();
      };
      group.append(one);
    }
    return group;
  }

  function field(labelText, control, grow = 1) {
    const wrap = el(control.tagName === 'INPUT' ? 'label' : 'div', 'sb-field');
    wrap.style.flexGrow = String(grow);
    // A wider control asks for more room before the row wraps.
    wrap.style.flexBasis = `${Math.round(grow * 6)}rem`;
    wrap.append(el('span', 'sb-soft', labelText), control);
    return wrap;
  }

  function input(name, { type = 'text', min, max } = {}) {
    const control = el('input', 'sb-input');
    control.name = name;
    control.type = type;
    if (type === 'number') {
      control.inputMode = 'numeric';
      control.step = '1';
      if (min !== undefined) control.min = String(min);
      if (max !== undefined) control.max = String(max);
    }
    control.value = form[name] === null || form[name] === undefined ? '' : String(form[name]);
    control.disabled = phase === 'building';
    control.oninput = () => {
      form = { ...form, [name]: control.value };
    };
    control.onchange = () => draw();
    return control;
  }

  function describe() {
    const page = el('div', 'sb-screen sb-describe');
    page.dataset.screen = 'describe';
    const main = el('div', 'sb-describe-main');
    const top = el('div');
    if (listed()) top.append(button('sb-link', '← Studies', () => go('library'), 'back'));
    top.append(el('h2', null, 'New study'));
    main.append(top);
    const line = saidLine();
    if (line) main.append(line);

    const { participants, sites, months } = LIMITS;
    const trial = el('form', 'sb-trial');
    trial.noValidate = true;
    trial.onsubmit = (event) => {
      event.preventDefault();
      build();
    };
    const first = el('div', 'sb-fields');
    first.append(
      field('Name', input('name'), 1.2),
      field(
        'Phase: fills in a typical size',
        segmented(
          'phase',
          PHASES.map((entry) => [entry.id, entry.label.replace('Phase ', '')]),
          (value) => {
            form = withPhase(form, value);
          }
        ),
        2
      ),
      field(
        'Therapeutic area',
        segmented(
          'area',
          AREAS.map((area) => [area, area]),
          (value) => {
            form = { ...form, area: value };
          }
        ),
        3
      )
    );
    const second = el('div', 'sb-fields');
    second.append(
      field(
        `Participants · ${participants.min} to ${participants.max}`,
        input('participants', { type: 'number', ...participants })
      ),
      field(`Sites · ${sites.min} to ${sites.max}`, input('sites', { type: 'number', ...sites })),
      field(
        `Months · ${months.min} to ${months.max}`,
        input('months', { type: 'number', ...months })
      ),
      field(
        'Outliers',
        segmented(
          'outliers',
          OUTLIERS.map((entry) => [entry.id, entry.label.replace(' outliers', '')]),
          (value) => {
            form = { ...form, outliers: value };
          }
        ),
        2.2
      ),
      field('Seed · optional', input('seed', { type: 'number', min: 0 }))
    );
    trial.append(first, second);
    main.append(el('h3', null, 'The trial'), trial);
    if (form.protocol) {
      const planned = planOf(form.protocol);
      main.append(
        el('h3', null, `Schedule of activities: ${planned.length} visits, from the protocol`),
        scheduleSection()
      );
    } else {
      const ask = el('p', 'sb-soft sb-protocol-ask');
      ask.append(
        'Have a protocol? Open a CDISC USDM study definition (the data form of an ICH M11 protocol) and the study is built on its schedule of activities. ',
        fileButton()
      );
      // A ready-made protocol, to try with no file at hand.
      for (const ready of readyProtocols) {
        const tryIt = button(
          '',
          `Try the ${ready.label}`,
          () =>
            attempt(async () => {
              const response = await globalThis.fetch(ready.url);
              if (!response || !response.ok) {
                throw new Error(`The ${ready.label} could not be fetched from this page.`);
              }
              await openDocument(await response.json(), 'a ready-made protocol');
            }),
          'try-protocol'
        );
        ask.append(tryIt);
      }
      main.append(ask);
    }

    // The layers, as the pipeline they are: each is built from the one before.
    const included = new Set(withLayerNeeds([...layersChosen]));
    const layer = (id) => {
      const one = LAYERS.find((each) => each.id === id);
      const neededBy = LAYERS.filter(
        (other) => layersChosen.has(other.id) && (other.needs || []).includes(id)
      ).map((other) => other.label);
      const on = !one.optional || included.has(id);
      const press = el('button', 'sb-layer');
      press.type = 'button';
      press.dataset.layer = id;
      press.setAttribute('aria-pressed', String(on));
      press.disabled = !one.optional || neededBy.length > 0 || phase === 'building';
      press.title = one.about;
      const under = !one.optional
        ? 'Always'
        : neededBy.length
          ? `Needed by ${neededBy.join(', ')}`
          : on
            ? 'In the study'
            : 'Left out';
      press.append(el('strong', null, one.label), el('span', 'sb-soft', under));
      press.onclick = () => {
        if (layersChosen.has(id)) layersChosen.delete(id);
        else layersChosen.add(id);
        draw();
      };
      return press;
    };
    const arrow = () => {
      const made = el('span', 'sb-arrow', '→');
      made.setAttribute('aria-hidden', 'true');
      return made;
    };
    const pipe = el('div', 'sb-pipe');
    const pair = el('div', 'sb-pipe-pair');
    pair.append(layer('raw.rbqm'), layer('adam'));
    pipe.append(
      layer('raw'),
      arrow(),
      pair,
      arrow(),
      layer('analysis'),
      arrow(),
      layer('reporting')
    );
    main.append(
      el('h3', null, 'Layers: each is built from the one before it'),
      pipe,
      el('p', 'sb-soft', 'Press a layer to leave it out. A layer another is built from stays in.')
    );

    // The raw domains, as chips.
    const inStudy = new Set(withNeeds([...chosen]));
    main.append(el('h3', null, `Raw domains: ${inStudy.size} of ${DOMAINS.length}`));
    const chips = el('div', 'sb-chips');
    for (const domain of DOMAINS) {
      const neededBy = DOMAINS.filter(
        (other) => other.needs === domain.id && chosen.has(other.id)
      ).map((other) => other.label);
      const chip = el('button', 'sb-chip', domain.label);
      chip.type = 'button';
      chip.dataset.domain = domain.id;
      chip.setAttribute('aria-pressed', String(inStudy.has(domain.id)));
      chip.disabled = domain.core || neededBy.length > 0 || phase === 'building';
      chip.title = [
        `${domain.grain}.`,
        domain.core ? 'In every study.' : '',
        neededBy.length ? `Needed by ${neededBy.join(', ')}.` : '',
        domain.large ? 'Grows fast with the size of the study.' : ''
      ]
        .filter(Boolean)
        .join(' ');
      chip.onclick = () => {
        if (chosen.has(domain.id)) chosen.delete(domain.id);
        else chosen.add(domain.id);
        draw();
      };
      chips.append(chip);
    }
    main.append(chips);

    // What building it will give, and the button.
    const side = el('aside', 'sb-summary');
    const read = readSettings(current());
    side.append(
      el('h3', null, phase === 'building' ? `Building ${form.name}` : 'What you will get')
    );
    if (phase === 'building') {
      const steps = el('ol', 'sb-steps');
      steps.setAttribute('role', 'status');
      const at = STAGES.findIndex((one) => one.id === stage);
      STAGES.forEach((one, index) => {
        const step = el('li', null, one.label);
        step.dataset.step = index < at ? 'done' : index === at ? 'now' : 'next';
        steps.append(step);
      });
      side.append(steps);
    } else {
      const facts = el('dl', 'sb-facts');
      const fact = (label, value) => facts.append(el('dt', null, label), el('dd', null, value));
      if (read.args) {
        fact('Participants', `${read.args.participants} at ${count(read.args.sites, 'site')}`);
        fact('Monthly snapshots', String(read.args.months));
      }
      if (form.protocol) fact('Planned visits', String(form.protocol.visits.length));
      fact('Raw domains', String(inStudy.size));
      fact('Layers', String(1 + included.size));
      side.append(facts);
      if (!builder.started()) side.append(el('p', 'sb-warn', downloadsSaid()));
    }
    if (problems.length) {
      const box = el('ul', 'sb-problems');
      box.setAttribute('role', 'alert');
      for (const problem of problems) box.append(el('li', null, problem));
      side.append(box);
    }
    if (phase === 'failed') {
      const box = el('p', 'sb-problems', failure);
      box.setAttribute('role', 'alert');
      side.append(box);
    }
    const run = button(
      'sb-primary',
      phase === 'building' ? 'Building…' : 'Build the study',
      () => build(),
      'build'
    );
    run.disabled = phase === 'building';
    side.append(run);
    const keepers = el('div', 'sb-row');
    const withConfig = (then) => () => {
      try {
        then(configOf(current()));
      } catch (error) {
        problems = error.problems || [messageOf(error)];
        draw();
      }
    };
    if (shelf && shelf.available) {
      keepers.append(
        button(
          '',
          'Save settings',
          withConfig((config) => keep(config, 'These settings')),
          'save-settings'
        )
      );
    }
    keepers.append(
      button(
        '',
        'Settings file',
        withConfig((config) =>
          save(
            `${config.name}.settings.json`,
            `${JSON.stringify(config, null, 2)}\n`,
            'application/json'
          )
        ),
        'download-settings'
      )
    );
    side.append(keepers);
    if (study) {
      side.append(button('sb-link', `Back to ${study.id}`, () => go('study'), 'to-study'));
    }
    side.append(
      el(
        'p',
        'sb-soft',
        'Every row is synthetic. Phase and area are labels: they do not shape the data yet.'
      )
    );
    page.append(main, side);
    return page;
  }

  // ---- the study that is open ----

  /** The study at a glance, for the viewer's first view. */
  function overview(box) {
    const about = overviewOf(study);
    const tiles = el('ul', 'sb-tiles');
    for (const one of about.counts) {
      const tile = el('li', 'sb-tile');
      tile.append(
        el('span', 'sb-tile-value', Number(one.value).toLocaleString('en-US')),
        el('span', 'sb-tile-label', one.label)
      );
      if (one.note) tile.append(el('span', 'sb-soft', one.note));
      tiles.append(tile);
    }
    const table = (title, header, rows) => {
      const wrap = el('div', 'sb-over');
      const grid = el('table', 'sb-table');
      const head = el('tr');
      for (const name of header) head.append(el('th', null, name));
      const top = el('thead');
      top.append(head);
      const body = el('tbody');
      for (const row of rows) {
        const made = el('tr');
        for (const value of row) made.append(el('td', null, value));
        body.append(made);
      }
      grid.append(top, body);
      wrap.append(el('h4', null, title), grid);
      return wrap;
    };
    const lower = el('div', 'sb-over-lower');
    lower.append(
      table(
        'Sites and participants by country',
        ['Country', 'Sites', 'Participants'],
        about.countries.map((row) => [row.country, String(row.sites), String(row.participants)])
      ),
      table(
        'What each layer holds',
        ['Layer', 'Tables', 'Rows'],
        about.layers.map((row) => [row.label, String(row.tables), row.rows.toLocaleString('en-US')])
      )
    );
    const notes = el('details', 'sb-caveats');
    notes.append(el('summary', null, 'What a study built here is, and is not'));
    const lines = el('ul');
    for (const line of [...CAVEATS, ...study.notes]) lines.append(el('li', null, line));
    notes.append(lines);
    box.append(tiles, lower, notes);
  }

  function studyScreen() {
    const page = el('div', 'sb-screen');
    page.dataset.screen = 'study';
    page.dataset.built = study.id;
    const head = el('div', 'sb-head');
    const words = el('div');
    if (listed()) words.append(button('sb-link', '← Studies', () => go('library'), 'back'));
    const title = el('div', 'sb-title');
    const state = el(
      'span',
      'sb-pill',
      study.opened ? 'Opened, not built' : `Built in ${Number(study.seconds).toFixed(1)} s`
    );
    state.dataset.kind = study.opened ? 'saved' : 'ready';
    title.append(el('h2', null, study.id), state);
    if (study.manifest) {
      const key = el('span', 'sb-soft sb-key', `key ${study.manifest.key.slice(7, 15)}…`);
      key.title = 'The same tables always give the same key.';
      key.dataset.key = study.manifest.key;
      title.append(key);
    }
    words.append(title);
    const actions = el('div', 'sb-row');
    if (shelf && shelf.available) {
      actions.append(button('', 'Save', () => keep(savedOf(study), 'This study'), 'save-study'));
    }
    actions.append(
      button(
        '',
        'Study file',
        () => save(`${study.id}.study.json`, JSON.stringify(savedOf(study)), 'application/json'),
        'download-study'
      ),
      button(
        '',
        'Download all (.zip)',
        () => {
          const { layers } = study.files();
          save(
            `${study.id}.zip`,
            zipOf([
              { name: 'manifest.json', text: `${JSON.stringify(study.manifest, null, 2)}\n` },
              { name: 'metadata.json', text: `${JSON.stringify(study.metadata, null, 2)}\n` },
              ...Object.entries(layers).flatMap(([layer, files]) =>
                files.map((file) => ({ ...file, name: `${layer}/${file.name}` }))
              )
            ]),
            'application/zip'
          );
        },
        'zip'
      )
    );
    if (typeof onStudy === 'function') {
      actions.append(button('sb-primary', useLabel, () => onStudy(study), 'use'));
    }
    head.append(words, actions);
    page.append(head);

    const args = study.args;
    const facts = el('div', 'sb-facts-row');
    const phaseOf = PHASES.find((entry) => entry.id === args.phase);
    for (const fact of [
      phaseOf ? phaseOf.label : args.phase,
      args.therapeutic_area,
      count(args.participants, 'participant'),
      count(args.sites, 'site'),
      count(args.months, 'month'),
      args.seed === undefined ? 'No seed' : `Seed ${args.seed}`
    ]) {
      facts.append(el('span', 'sb-fact', String(fact)));
    }
    facts.append(button('sb-link', 'Change and rebuild', () => go('describe'), 'change'));
    page.append(facts);
    const line = saidLine();
    if (line) page.append(line);

    const holder = el('div', 'sb-viewer');
    page.append(holder);
    viewer = mountViewer(holder, {
      study: fromBuilt(study),
      theme,
      save,
      view: viewing.view,
      table: viewing.table,
      views: [
        { id: 'overview', label: 'Overview', render: overview },
        // The protocol the build followed, when it followed one.
        ...(study.protocol
          ? [
              {
                id: 'schedule',
                label: 'Schedule',
                render: (box) => {
                  box.append(
                    el(
                      'p',
                      'sb-soft',
                      `${study.protocol.title || study.protocol.name}: ${protocolSaid(study.protocol)}.`
                    ),
                    scheduleGrid(study.protocol, false)
                  );
                }
              }
            ]
          : [])
      ],
      onChange: (at) => {
        viewing = at;
      }
    });
    return page;
  }

  function draw() {
    if (destroyed) return;
    const active = doc.activeElement;
    const focused = active && root.contains(active) ? active.getAttribute('name') : null;
    if (viewer) viewer.destroy();
    viewer = null;
    root.textContent = '';
    const shell = el('div', 'sb');
    if (theme) shell.dataset.theme = theme;
    // With nothing to list, the library is only a way to the form.
    if (screen === 'library' && !listed()) screen = 'describe';
    if (screen === 'study' && !study) screen = 'describe';
    shell.append(
      screen === 'study' ? studyScreen() : screen === 'library' ? library() : describe()
    );
    root.append(shell);
    if (focused) {
      const again = root.querySelector(`[name="${focused}"]`);
      if (again && !again.disabled) again.focus();
    }
  }

  draw();
  root.addEventListener('input', () => {
    touched = true;
  });
  root.addEventListener('click', () => {
    touched = true;
  });
  // The library fills in as the page's presets and the shelf answer. A reader
  // who has done nothing yet is taken to it once it has something to list.
  const arrived = () => {
    if (destroyed) return;
    const waiting =
      screen === 'describe' && openingScreen !== 'describe' && phase === 'idle' && !study;
    if (waiting && !touched) screen = 'library';
    draw();
  };
  if (shelf && shelf.available) {
    shelf.list().then(
      (found) => {
        shelved = found;
        if (found.length) arrived();
      },
      () => {}
    );
  }
  if (presetsGiven !== false && !Array.isArray(presetsGiven)) {
    const from =
      typeof presetsGiven === 'string'
        ? presetsGiven
        : `${base.endsWith('/') ? base : `${base}/`}presets/index.json`;
    fetchPresets(from).then((found) => {
      if (destroyed || !found.length) return;
      presets = found;
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
    study: () => study,
    /** What the form holds now. */
    settings: current,
    /** What is on the page: for the tests, and a host that wants to follow along. */
    state: () => ({
      screen,
      phase,
      stage,
      problems: [...problems],
      failure,
      said,
      presets: presets.map((preset) => preset.id),
      shelved: shelved.map((entry) => entry.id),
      viewing: { ...viewing }
    }),
    /** Empty the element and let go of R, when it is study.builder's own. */
    destroy() {
      destroyed = true;
      if (viewer) viewer.destroy();
      root.textContent = '';
      builder.close();
    }
  };
}

/**
 * Save a file from the page: a link with the bytes behind it, pressed.
 * @param {string} name The file's name.
 * @param {Uint8Array|string} bytes What it holds.
 * @param {string} type Its media type.
 * @returns {void}
 */
export function saveFile(name, bytes, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
