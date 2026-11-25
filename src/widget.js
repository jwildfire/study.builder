// study.builder on a page: a form for the trial, the layers to build, the raw
// domains folded into one line, and, once a study is built, what each table holds: its rows, its columns and
// their types, its first rows, and a download. The standard files made from
// the raw domains say, column by column, where each came from.
//
//   StudyBuilder.mount('#builder', {
//     onStudy(study) { /* load study.files() into your own page */ }
//   });
//
// R makes every row. This module draws, decides when R is asked, and hands the
// study to the page that hosts it.

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
  withNeeds,
  withPhase
} from './core.js';
import { DOWNLOADS, createBuilder } from './build.js';
import { firstRows } from './csv.js';
import { columnsOf, overviewOf } from './overview.js';
import { injectStyles } from './styles.js';
import { zipOf } from './zip.js';

/** The tab that is not a layer. */
const OVERVIEW = 'overview';
/** How many rows a preview shows, and how many more each press adds. */
const PREVIEW_STEP = 50;

/** What R is doing while it starts, by the step the connection names. */
const STAGE_WORDS = {
  runtime: 'Starting R in this browser…',
  packages: 'Installing R’s packages…',
  files: 'Fetching gsm.datasim…',
  source: 'Simulating the study…',
  simulate: 'Simulating the study…'
};

const count = (number, noun) =>
  `${Number(number).toLocaleString('en-US')} ${noun}${Number(number) === 1 ? '' : 's'}`;

/** What pressing Build downloads the first time, in a sentence. */
export function downloadsSaid(downloads = DOWNLOADS) {
  const total = Math.round(downloads.reduce((sum, entry) => sum + entry.megabytes, 0));
  const hosts = [...new Set(downloads.map((entry) => entry.host).filter(Boolean))];
  return (
    `The first build starts R in this browser and downloads about ${total} MB from ` +
    `${hosts.join(' and ')}. Later builds reuse it. The study is made here and is sent nowhere.`
  );
}

/**
 * Mount the builder.
 * @param {string|Element} target The element, or a selector for it, to draw into.
 * @param {Object} [options]
 * @param {Object} [options.settings] What the form opens on, as `readSettings` takes settings.
 * @param {string} [options.base] The address study.builder's `r/` and `vendor/` folders are served under; the folder of the script that defined `StudyBuilder` unless told.
 * @param {{run: Function}} [options.connection] A connection to R the page already has.
 * @param {(options: Object) => {run: Function}} [options.createConnection] The page's own way of making a connection to R, so one R is shared; called on the first build with what R is to be given.
 * @param {string} [options.repository] Where gsm's own packages are installed from, for a page that already serves them.
 * @param {(study: Object) => void} [options.onBuilt] Called with each study as it is built.
 * @param {(study: Object) => void} [options.onStudy] Called when the reader presses the button that hands the study to the page. With none, there is no such button.
 * @param {string} [options.useLabel] That button's words.
 * @param {?string} [options.theme] `light` or `dark`; the reader's own setting unless told.
 * @param {Function} [options.createBuilder] Something else to make the builder with; used by the tests.
 * @param {(name: string, bytes: Uint8Array|string, type: string) => void} [options.save] Something else to save a file with; used by the tests.
 * @returns {{build: () => Promise<?Object>, study: () => ?Object, settings: () => Object, destroy: () => void}} The handle.
 */
export function mount(
  target,
  {
    settings: opening = {},
    base = './',
    connection = null,
    createConnection: connect = null,
    repository = null,
    onBuilt = null,
    onStudy = null,
    useLabel = 'Use this study',
    theme = null,
    createBuilder: make = createBuilder,
    save = saveFile
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

  let form = { ...DEFAULTS, ...opening };
  let chosen = new Set(
    (Array.isArray(form.domains) ? form.domains : DEFAULTS.domains).filter((id) =>
      DOMAINS.some((domain) => domain.id === id && !domain.core)
    )
  );
  let layersChosen = new Set(
    (Array.isArray(form.layers) ? form.layers : DEFAULTS.layers).filter((id) =>
      LAYERS.some((layer) => layer.id === id && layer.optional)
    )
  );
  let shownLayer = OVERVIEW; // the tab that is open, once a study is built: the overview, or a layer
  const openIn = new Map(); // layer → the id of the table open in it
  let viewerPart = 'preview'; // which part of the open table is shown
  let previewRows = PREVIEW_STEP; // how many rows of the open table are shown
  let domainsOpen = false; // whether the list of raw domains is unfolded
  // idle → building → done, or → failed.
  let phase = 'idle';
  let stage = '';
  let problems = [];
  let failure = '';
  let study = null;
  let builtWith = '';
  let builds = 0;
  let destroyed = false;

  const builder = make({
    base,
    connection,
    ...(typeof connect === 'function' ? { createConnection: connect } : {}),
    ...(repository ? { repository } : {}),
    onStage: (name) => {
      if (phase !== 'building') return;
      stage = STAGE_WORDS[name] || stage;
      draw();
    }
  });

  const current = () => ({
    ...form,
    domains: [...chosen],
    layers: LAYERS.filter((layer) => layersChosen.has(layer.id)).map((layer) => layer.id)
  });
  const key = () => JSON.stringify(current());

  async function build() {
    if (phase === 'building' || destroyed) return null;
    const read = readSettings(current());
    problems = read.problems;
    if (!read.args) {
      draw();
      return null;
    }
    const mine = ++builds;
    const asked = key();
    phase = 'building';
    failure = '';
    stage = builder.started() ? STAGE_WORDS.simulate : STAGE_WORDS.runtime;
    draw();
    let built;
    try {
      built = await builder.build(current());
    } catch (error) {
      if (mine !== builds || destroyed) return null;
      phase = 'failed';
      failure = error && error.message ? error.message : String(error);
      draw();
      return null;
    }
    if (mine !== builds || destroyed) return null;
    study = built;
    builtWith = asked;
    phase = 'done';
    // The details that were open stay open when the new study has that table.
    if (shownLayer !== OVERVIEW && !study.layers.some((layer) => layer.id === shownLayer)) {
      shownLayer = OVERVIEW;
    }
    previewRows = PREVIEW_STEP;
    draw();
    if (typeof onBuilt === 'function') onBuilt(study);
    return study;
  }

  // ---- drawing ----

  function field(labelText, control, hint) {
    const wrap = el('label', 'sb-field');
    wrap.append(el('span', 'sb-label', labelText), control);
    if (hint) wrap.append(el('span', 'sb-hint', hint));
    return wrap;
  }

  function select(name, options) {
    const control = el('select', 'sb-input');
    control.name = name;
    for (const [value, label] of options) {
      const option = el('option', null, label);
      option.value = value;
      control.append(option);
    }
    control.value = form[name];
    control.disabled = phase === 'building';
    control.onchange = () => {
      // A phase fills in a typical size; every other choice is its own.
      form = name === 'phase' ? withPhase(form, control.value) : { ...form, [name]: control.value };
      draw();
    };
    return control;
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
    // The note that the settings have changed follows a finished edit.
    control.onchange = () => draw();
    return control;
  }

  function trialForm() {
    const body = el('form', 'sb-form');
    body.noValidate = true;
    body.onsubmit = (event) => {
      event.preventDefault();
      build();
    };
    const { participants, sites, months } = LIMITS;
    body.append(
      field('Study name', input('name')),
      field(
        'Phase',
        select(
          'phase',
          PHASES.map((entry) => [entry.id, entry.label])
        ),
        'Fills in a typical size.'
      ),
      field(
        'Therapeutic area',
        select(
          'area',
          AREAS.map((area) => [area, area])
        )
      ),
      field(
        'Participants',
        input('participants', { type: 'number', ...participants }),
        `${participants.min} to ${participants.max}`
      ),
      field('Sites', input('sites', { type: 'number', ...sites }), `${sites.min} to ${sites.max}`),
      field(
        'Months',
        input('months', { type: 'number', ...months }),
        `${months.min} to ${months.max}`
      ),
      field(
        'Outliers',
        select(
          'outliers',
          OUTLIERS.map((entry) => [entry.id, entry.label])
        )
      ),
      field(
        'Seed',
        input('seed', { type: 'number', min: 0 }),
        'Optional: the same seed builds the same study.'
      )
    );
    return body;
  }

  /**
   * The raw domains, folded shut: one line saying how many are chosen, and
   * inside it a tick for each. What a built domain holds is on the Raw tab.
   */
  function domainChoices() {
    const included = new Set(withNeeds([...chosen]));
    const fold = el('details', 'sb-domains');
    fold.open = domainsOpen;
    fold.addEventListener('toggle', () => {
      domainsOpen = fold.open;
    });
    const summary = el('summary', 'sb-domains-summary');
    summary.append(
      el('strong', null, 'Raw domains'),
      el('span', null, ` ${included.size} of ${DOMAINS.length} in the study. `),
      el('span', 'sb-domains-hint', 'Change')
    );
    fold.append(summary);
    const list = el('ul', 'sb-domain-list');
    for (const domain of DOMAINS) {
      // A domain another needs is in the study whether or not it is ticked.
      const neededBy = DOMAINS.filter(
        (other) => other.needs === domain.id && chosen.has(other.id)
      ).map((other) => other.label);
      const item = el('li', 'sb-domain');
      item.dataset.domain = domain.id;
      item.dataset.on = String(included.has(domain.id));
      // What one row is, said on hover and to a screen reader.
      item.title = `${domain.grain}.`;
      const line = el('label', 'sb-domain-line');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = included.has(domain.id);
      box.disabled = domain.core || neededBy.length > 0 || phase === 'building';
      box.setAttribute('aria-label', `${domain.label}: ${domain.grain}`);
      box.onchange = () => {
        if (box.checked) chosen.add(domain.id);
        else chosen.delete(domain.id);
        draw();
      };
      line.append(box, el('span', 'sb-domain-name', domain.label));
      if (domain.core) line.append(el('span', 'sb-domain-note', 'always'));
      if (neededBy.length) {
        line.append(el('span', 'sb-domain-note', `needed by ${neededBy.join(', ')}`));
      }
      if (domain.large) {
        const tag = el('span', 'sb-domain-note', 'large');
        tag.dataset.kind = 'large';
        line.append(tag);
      }
      item.append(line);
      list.append(item);
    }
    fold.append(list);
    return fold;
  }

  /** The optional layers, each with a tick: which are built off raw. */
  function layerChoices() {
    const row = el('div', 'sb-layer-choices');
    for (const layer of LAYERS) {
      const choice = el('label', 'sb-layer-choice');
      const box = el('input');
      box.type = 'checkbox';
      box.dataset.layer = layer.id;
      box.checked = !layer.optional || layersChosen.has(layer.id);
      box.disabled = !layer.optional || phase === 'building';
      box.onchange = () => {
        if (box.checked) layersChosen.add(layer.id);
        else layersChosen.delete(layer.id);
        draw();
      };
      const words = el('span');
      words.append(el('strong', null, layer.label), ` ${layer.about}`);
      choice.append(box, words);
      row.append(choice);
    }
    return row;
  }

  /** What made a table, in a sentence. */
  function madeSaid(made) {
    if (made.layer === 'raw') return made.grain ? `${made.grain}.` : 'Simulated by gsm.datasim.';
    return made.made.from.length
      ? `Built from ${made.made.from.join(' and ')} by the ${made.made.workflow} workflow.`
      : `Built by the ${made.made.workflow} workflow.`;
  }

  function table(header, rows, kind) {
    const scroll = el('div', 'sb-scroll');
    const grid = el('table', 'sb-table');
    if (kind) grid.dataset.kind = kind;
    const head = el('tr');
    for (const name of header) {
      const cell = el('th');
      // A header may be a name alone, or a name with a line under it.
      if (Array.isArray(name)) cell.append(name[0], el('span', 'sb-th-note', name[1]));
      else cell.textContent = name;
      head.append(cell);
    }
    const top = el('thead');
    top.append(head);
    const body = el('tbody');
    for (const row of rows) {
      const line = el('tr');
      for (const value of row) line.append(el('td', null, value));
      body.append(line);
    }
    grid.append(top, body);
    scroll.append(grid);
    return scroll;
  }

  /** The study at a glance: what the trial is, its counts, its countries and its layers. */
  function overview() {
    const said = overviewOf(study);
    const wrap = el('div', 'sb-overview');
    wrap.dataset.overview = study.id;
    const facts = el('dl', 'sb-facts');
    for (const fact of said.facts) {
      // A term and its value, kept together in one cell.
      const pair = el('div', 'sb-fact');
      pair.append(el('dt', null, fact.label), el('dd', null, fact.value));
      facts.append(pair);
    }
    const tiles = el('ul', 'sb-tiles');
    for (const one of said.counts) {
      const tile = el('li', 'sb-tile');
      tile.append(
        el('span', 'sb-tile-value', Number(one.value).toLocaleString('en-US')),
        el('span', 'sb-tile-label', one.label)
      );
      if (one.note) tile.append(el('span', 'sb-tile-note', one.note));
      tiles.append(tile);
    }
    const lower = el('div', 'sb-overview-lower');
    const places = el('div');
    places.append(
      el('h5', null, 'Sites and participants by country'),
      table(
        ['Country', 'Sites', 'Participants'],
        said.countries.map((row) => [row.country, String(row.sites), String(row.participants)])
      )
    );
    const held = el('div');
    held.append(
      el('h5', null, 'What each layer holds'),
      table(
        ['Layer', 'Tables', 'Rows'],
        said.layers.map((row) => [row.label, String(row.tables), row.rows.toLocaleString('en-US')])
      )
    );
    lower.append(places, held);
    wrap.append(tiles, facts, lower);
    return wrap;
  }

  /** One table, looked into: its first rows, its columns, and where it came from. */
  function viewer(shown) {
    const id = `${shown.layer}:${shown.id}`;
    const panel = el('section', 'sb-viewer');
    panel.dataset.viewer = id;
    panel.setAttribute('aria-label', `${shown.label}, ${shown.table}`);
    const head = el('div', 'sb-viewer-head');
    const title = el('div', 'sb-viewer-title');
    title.append(
      el('h4', null, shown.label),
      el(
        'span',
        'sb-viewer-meta',
        `${shown.table} · ${count(shown.rows, 'row')} · ${count(shown.columns.length, 'column')}`
      )
    );
    const download = el('button', 'sb-button', 'Download CSV');
    download.type = 'button';
    download.dataset.kind = 'small';
    download.dataset.download = shown.name;
    download.onclick = () => save(shown.name, shown.text, 'text/csv');
    head.append(title, download);
    panel.append(head, el('p', 'sb-viewer-meta', madeSaid(shown)));

    const hasMapping = Boolean(shown.mapping && shown.mapping.length);
    const parts = [
      ['preview', 'Preview'],
      ['columns', 'Columns'],
      ...(hasMapping ? [['mapping', 'Where it came from']] : [])
    ];
    if (!parts.some(([part]) => part === viewerPart)) viewerPart = 'preview';
    const tabs = el('div', 'sb-viewer-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const [part, label] of parts) {
      const tab = el('button', 'sb-viewer-tab', label);
      tab.type = 'button';
      tab.dataset.part = part;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(viewerPart === part));
      tab.onclick = () => {
        viewerPart = part;
        draw();
      };
      tabs.append(tab);
    }
    panel.append(tabs);

    if (viewerPart === 'mapping') {
      const types = new Map(shown.columns.map((column) => [column.name, column.type]));
      panel.append(
        table(
          ['Column', 'Type', 'From', 'How'],
          shown.mapping.map((line) => [
            line.column,
            types.get(line.column) || '',
            line.from || '—',
            line.how
          ]),
          'wrap'
        )
      );
    } else if (viewerPart === 'columns') {
      const said = columnsOf(shown);
      if (said.read < said.of) {
        panel.append(
          el(
            'p',
            'sb-viewer-meta',
            `Summarised from the first ${said.read.toLocaleString('en-US')} of ${said.of.toLocaleString('en-US')} rows.`
          )
        );
      }
      panel.append(
        table(
          ['Column', 'Type', 'Filled', 'Different values', 'Range or commonest values'],
          said.columns.map((column) => [
            column.name,
            column.type,
            `${Math.round(column.filled * 100)}%`,
            column.distinct.toLocaleString('en-US'),
            column.says
          ]),
          'wrap'
        )
      );
    } else {
      const types = new Map(shown.columns.map((column) => [column.name, column.type]));
      const preview = firstRows(shown.text, previewRows);
      panel.append(
        table(
          preview.header.map((name) => [name, types.get(name) || '']),
          preview.rows
        )
      );
      const foot = el('div', 'sb-viewer-foot');
      foot.append(
        el(
          'span',
          'sb-viewer-meta',
          preview.rows.length < shown.rows
            ? `Rows 1 to ${preview.rows.length} of ${shown.rows.toLocaleString('en-US')}`
            : `All ${count(shown.rows, 'row')}`
        )
      );
      if (preview.rows.length < shown.rows) {
        const more = el('button', 'sb-button', 'Show 50 more');
        more.type = 'button';
        more.dataset.kind = 'small';
        more.dataset.action = 'more';
        more.onclick = () => {
          previewRows += PREVIEW_STEP;
          draw();
        };
        foot.append(more);
      }
      panel.append(foot);
    }
    return panel;
  }

  /**
   * The built study: an overview, and a tab for each layer. A layer shows a
   * short list of its tables beside the one that is open.
   */
  function layerRail() {
    const wrap = el('div', 'sb-layers');
    const tabs = el('div', 'sb-layer-tabs');
    tabs.setAttribute('role', 'tablist');
    const tabFor = (id, label, note) => {
      const tab = el('button', 'sb-layer-tab');
      tab.type = 'button';
      tab.dataset.layerTab = id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(shownLayer === id));
      tab.append(el('span', null, label));
      if (note) tab.append(el('span', 'sb-layer-count', note));
      tab.onclick = () => {
        shownLayer = id;
        draw();
      };
      tabs.append(tab);
    };
    tabFor(OVERVIEW, 'Overview');
    for (const layer of study.layers) tabFor(layer.id, layer.label, String(layer.tables.length));
    wrap.append(tabs);
    if (shownLayer === OVERVIEW) {
      wrap.append(overview());
      return wrap;
    }
    const layer = study.layers.find((entry) => entry.id === shownLayer);
    if (layer.about) wrap.append(el('p', 'sb-layer-about', layer.about));
    if (!layer.tables.length) {
      wrap.append(el('p', 'sb-layer-about', 'This study has no tables in this layer.'));
      return wrap;
    }
    // The table that is open in this layer: the one last chosen, or its first.
    const chosenId = openIn.get(layer.id);
    const shown = layer.tables.find((made) => made.id === chosenId) || layer.tables[0];
    const browser = el('div', 'sb-browser');
    const list = el('ul', 'sb-table-list');
    for (const made of layer.tables) {
      const item = el('li');
      const pick = el('button', 'sb-table-pick');
      pick.type = 'button';
      pick.dataset.table = `${layer.id}:${made.id}`;
      pick.setAttribute('aria-current', String(made === shown));
      pick.title = madeSaid(made);
      pick.append(
        el('span', 'sb-pick-name', made.label),
        el('span', 'sb-pick-id', made.table),
        el('span', 'sb-pick-rows', made.rows.toLocaleString('en-US'))
      );
      pick.onclick = () => {
        openIn.set(layer.id, made.id);
        previewRows = PREVIEW_STEP;
        draw();
      };
      item.append(pick);
      list.append(item);
    }
    browser.append(list, viewer(shown));
    wrap.append(browser);
    return wrap;
  }

  function draw() {
    if (destroyed) return;
    // The field the reader is in keeps the caret across a redraw.
    const active = doc.activeElement;
    const focused = active && root.contains(active) ? active.getAttribute('name') : null;

    root.textContent = '';
    const shell = el('div', 'sb');
    if (theme) shell.dataset.theme = theme;
    shell.append(
      el('h2', null, 'Build a study'),
      el(
        'p',
        'sb-pitch',
        'Describe a trial and choose its domains. gsm.datasim simulates it in this browser, the ' +
          'layers are built off the raw tables by workflows, and every table can be looked at and downloaded.'
      )
    );

    shell.append(el('h3', null, 'The trial'), trialForm());
    shell.append(el('h3', null, 'Layers'), layerChoices(), domainChoices());

    const actions = el('div', 'sb-actions');
    const go = el('button', 'sb-button', phase === 'building' ? 'Building…' : 'Build');
    go.type = 'button';
    go.dataset.kind = 'primary';
    go.dataset.action = 'build';
    go.disabled = phase === 'building';
    go.onclick = () => build();
    actions.append(go);
    if (phase === 'building') {
      const status = el('span', 'sb-status');
      status.setAttribute('role', 'status');
      const ring = el('span', 'sb-spin');
      ring.setAttribute('aria-hidden', 'true');
      status.append(ring, stage);
      actions.append(status);
    } else if (!builder.started()) {
      actions.append(el('span', 'sb-status', downloadsSaid()));
    }
    shell.append(actions);

    if (problems.length) {
      const box = el('div', 'sb-box');
      box.dataset.kind = 'problem';
      box.setAttribute('role', 'alert');
      const items = el('ul');
      for (const problem of problems) items.append(el('li', null, problem));
      box.append(items);
      shell.append(box);
    }
    if (phase === 'failed') {
      const box = el('div', 'sb-box', failure);
      box.dataset.kind = 'problem';
      box.setAttribute('role', 'alert');
      shell.append(box);
    }

    if (study) {
      if (builtWith !== key() && phase !== 'building') {
        const stale = el(
          'div',
          'sb-box',
          'The settings have changed since this study was built. Press Build to make the study they describe.'
        );
        stale.dataset.kind = 'note';
        stale.dataset.stale = 'true';
        shell.append(stale);
      }
      const done = el('div', 'sb-box');
      done.dataset.built = 'true';
      done.setAttribute('role', 'status');
      done.append(el('p', null, study.said));
      if (study.manifest) {
        const key = el(
          'p',
          'sb-detail-meta',
          `Study key ${study.manifest.key.slice(0, 19)}…: the same tables always give the same key.`
        );
        key.dataset.key = study.manifest.key;
        done.append(key);
      }
      const uses = el('div', 'sb-actions');
      uses.style.margin = '0';
      if (typeof onStudy === 'function') {
        const use = el('button', 'sb-button', useLabel);
        use.type = 'button';
        use.dataset.kind = 'primary';
        use.dataset.action = 'use';
        use.onclick = () => onStudy(study);
        uses.append(use);
      }
      const all = el('button', 'sb-button', 'Download all (.zip)');
      all.type = 'button';
      all.dataset.action = 'zip';
      all.onclick = () => {
        const { layers } = study.files();
        save(
          `${study.id}.zip`,
          zipOf([
            { name: 'manifest.json', text: `${JSON.stringify(study.manifest, null, 2)}\n` },
            ...Object.entries(layers).flatMap(([layer, files]) =>
              files.map((file) => ({ ...file, name: `${layer}/${file.name}` }))
            )
          ]),
          'application/zip'
        );
      };
      uses.append(all);
      done.append(uses);
      shell.append(done);

      shell.append(el('h3', null, 'The study'), layerRail());
    }

    shell.append(el('h3', null, 'What a study built here is, and is not'));
    const caveats = el('ul', 'sb-list');
    for (const line of [...CAVEATS, ...(study ? study.notes : [])])
      caveats.append(el('li', null, line));
    shell.append(caveats);

    root.append(shell);
    if (focused) {
      const again = root.querySelector(`[name="${focused}"]`);
      if (again && !again.disabled) again.focus();
    }
  }

  draw();

  return {
    /** Build the study the form describes, as pressing Build does. */
    build,
    /** The last study built, or null. */
    study: () => study,
    /** What the form holds now. */
    settings: current,
    /** What is on the page: for the tests, and a host that wants to follow along. */
    state: () => ({
      phase,
      stage,
      problems: [...problems],
      failure,
      tab: shownLayer,
      part: viewerPart
    }),
    /** Empty the element and let go of R, when it is study.builder's own. */
    destroy() {
      destroyed = true;
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
