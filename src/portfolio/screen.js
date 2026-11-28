// The portfolio: the studies a reader can have at once (ready-made, and saved
// in this browser) and the settings that build one. The way in.

import { PHASES } from '../engine/core.js';
import { openPreset } from '../engine/saved.js';
import { count } from '../shared/dom.js';

/** A study's size, in a line: `150 participants · 20 sites · 9 months`. */
export function sizeSaid(settings) {
  return `${count(settings.participants, 'participant')} · ${count(settings.sites, 'site')} · ${count(settings.months, 'month')}`;
}

/**
 * Draw the portfolio.
 * @param {Object} app The page's state and what it can do; see `src/app/widget.js`.
 * @returns {Element} The screen.
 */
export function portfolioScreen(app) {
  const {
    s,
    el,
    button,
    shelf,
    go,
    draw,
    say,
    take,
    show,
    attempt,
    saidLine,
    fileButton,
    refreshShelf,
    openDocument,
    links = {}
  } = app;

  function library() {
    const page = el('div', 'sb-screen');
    page.dataset.screen = 'library';
    const head = el('div', 'sb-head');
    const words = el('div');
    words.append(
      el('h2', null, 'Studies'),
      el(
        'p',
        'sb-lede',
        'Simulated clinical trials, a row a study’s configuration. Any row opens in the study builder; one with data ready also opens as a study.'
      )
    );
    const actions = el('div', 'sb-row');
    actions.append(
      fileButton(),
      button(
        'sb-primary',
        'New study',
        () => (links.builder ? links.builder(null, {}) : go('describe')),
        'new'
      )
    );
    head.append(words, actions);
    page.append(head);
    const line = saidLine();
    if (line) page.append(line);

    const pill = (kind) => {
      const made = el(
        'span',
        'sb-pill',
        kind === 'saved' ? 'Saved by you' : kind === 'protocol' ? 'Protocol' : 'Ready-made'
      );
      made.dataset.kind = kind;
      return made;
    };
    const forget = (entry) => async () => {
      await shelf.remove(entry.id);
      say(`${entry.name} is no longer saved in this browser.`);
      await refreshShelf();
    };
    const ready = [
      ...s.shelved
        .filter((entry) => entry.kind === 'study')
        .map((entry) => ({
          id: `shelf:${entry.id}`,
          kind: 'saved',
          name: entry.name,
          size: entry.size.replace(/, /g, ' · '),
          note: `Saved ${String(entry.saved).slice(0, 10)}, in this browser only`,
          open: async () =>
            openDocument(await shelf.open(entry.id), `${entry.name}, saved in this browser`),
          settings: async () => (await shelf.open(entry.id)).settings,
          remove: forget(entry)
        })),
      ...s.presets
        .filter((preset) => preset.study)
        .map((preset) => ({
          id: `preset:${preset.id}`,
          kind: 'ready',
          name: preset.name,
          size: sizeSaid(preset.settings),
          note: preset.about,
          megabytes: preset.megabytes,
          settings: async () => preset.settings,
          open: async () => {
            take(preset.settings);
            say(`Fetching ${preset.name}…`);
            draw();
            const opened = await openPreset(preset);
            s.builds += 1;
            show(opened.study, `Opened ${preset.name}, a ready-made study. Nothing was built.`);
          }
        }))
    ];
    const plain = [
      ...s.shelved
        .filter((entry) => entry.kind === 'config')
        .map((entry) => ({
          id: `shelf:${entry.id}`,
          kind: 'saved',
          name: entry.name,
          size: entry.size.replace(/, /g, ' · '),
          note: `Saved ${String(entry.saved).slice(0, 10)}, in this browser only`,
          settings: async () => (await shelf.open(entry.id)).settings,
          remove: forget(entry)
        })),
      ...s.presets
        .filter((preset) => !preset.study)
        .map((preset) => ({
          id: `preset:${preset.id}`,
          kind: 'ready',
          name: preset.name,
          size: sizeSaid(preset.settings),
          note: preset.about,
          settings: async () => preset.settings
        }))
    ];
    // One table of every study a reader can have. The Data column says which
    // open at once (the data is hosted or saved) and which are settings that
    // Build makes a study from.
    // A protocol a study can follow: no settings of its own yet, only its
    // schedule and design. Use puts it in the form.
    const protocols = (s.protocols || []).map((one) => {
      const phase = PHASES.find((entry) => entry.id === one.phase);
      return {
        id: `protocol:${one.id}`,
        kind: 'protocol',
        name: one.title && one.title !== one.name ? `${one.title} (${one.name})` : one.name,
        size: [
          one.participants ? `${count(Number(one.participants), 'participant')} planned` : '',
          count((one.arms || []).length, 'arm'),
          count(one.visits, 'visit')
        ]
          .filter(Boolean)
          .join(' · '),
        note: [
          [phase ? phase.label : one.phase, one.indication].filter(Boolean).join(', '),
          `${one.activities} activities scheduled, ${one.simulated} simulated`
        ]
          .filter(Boolean)
          .join('. '),
        fetched: async () => {
          const response = await fetch(one.url);
          if (!response.ok) throw new Error(`The protocol ${one.name} could not be fetched.`);
          return response.json();
        },
        // The study kept for the protocol, when the page has one.
        ...(one.study
          ? {
              megabytes: one.megabytes,
              saved: [
                one.built && one.built.name,
                one.built && one.built.participants
                  ? `${count(Number(one.built.participants), 'participant')} simulated`
                  : ''
              ]
                .filter(Boolean)
                .join(', '),
              open: async () => {
                say(`Fetching the study saved for ${one.name}…`);
                draw();
                const opened = await openPreset({
                  name: one.name,
                  study: one.study,
                  key: one.key,
                  settings: null
                });
                s.builds += 1;
                show(
                  opened.study,
                  `Opened the study saved for the protocol ${one.name}. Every row is simulated. Nothing was built.`
                );
              }
            }
          : {})
      };
    });
    const rows = [
      ...ready.map((one) => ({ ...one, data: true })),
      ...plain.map((one) => ({ ...one, data: false })),
      ...protocols.map((one) => ({ ...one, data: Boolean(one.open) }))
    ];
    const wrap = el('div', 'sb-studies');
    const table = el('table', 'sb-table sb-studies-table');
    const headRow = el('tr');
    for (const title of ['Study', 'Size', 'From', 'Data', 'Open']) {
      const cell = el('th', null, title);
      cell.scope = 'col';
      headRow.append(cell);
    }
    const thead = el('thead');
    thead.append(headRow);
    const tbody = el('tbody');
    for (const one of rows) {
      const row = el('tr', 'sb-study');
      const isProtocol = one.kind === 'protocol';
      if (one.data) row.dataset.study = one.id;
      if (isProtocol) row.dataset.protocol = one.id;
      else if (!one.data) row.dataset.settings = one.id;
      row.dataset.data = one.data ? 'ready' : isProtocol ? 'protocol' : 'settings';
      const name = el('th', 'sb-study-name');
      name.scope = 'row';
      name.append(el('strong', null, one.name));
      const note = one.data ? one.note : one.note || '';
      if (note) name.append(el('span', 'sb-soft', note));
      const size = el('td', 'sb-soft', one.size || '');
      const from = el('td');
      from.append(pill(one.kind));
      const data = el('td', 'sb-study-data');
      const has = el(
        'span',
        'sb-data',
        one.data ? 'Data ready' : isProtocol ? 'Protocol only' : 'Settings only'
      );
      has.dataset.data = one.data ? 'ready' : 'settings';
      data.append(
        has,
        el(
          'span',
          'sb-soft',
          one.data
            ? `Opens at once${one.megabytes ? `, ${one.megabytes} MB` : ''}${one.saved ? `: ${one.saved}` : ''}`
            : isProtocol
              ? 'A study can follow it; the builder makes the data'
              : 'The builder makes the data: about a minute the first time'
        )
      );
      const act = el('td', 'sb-study-act');
      const buttons = el('div', 'sb-row');
      // Every row is a study's configuration, and opens in the builder. One
      // whose build is kept (it has data) opens as a study too.
      if (one.data) {
        // A page that shows a study elsewhere is told which; else it is opened here.
        const open = button(
          'sb-primary',
          'Overview',
          () => (links.study ? links.study(one.id) : attempt(one.open)),
          'open'
        );
        open.setAttribute('aria-label', `Open the study ${one.name}`);
        buttons.append(open);
      }
      const configure = button(
        one.data ? '' : 'sb-primary',
        'Open in builder',
        () => {
          if (links.builder) return links.builder(one.id, {});
          return attempt(async () => {
            if (isProtocol) return openDocument(await one.fetched(), 'from the study list');
            take(await one.settings());
            s.problems = [];
            say('');
            return go('describe');
          });
        },
        'configure'
      );
      configure.setAttribute('aria-label', `Open ${one.name} in the study builder`);
      buttons.append(configure);
      if (one.remove) {
        const remove = button('', 'Remove', () => attempt(one.remove), 'remove');
        remove.setAttribute('aria-label', `Remove ${one.name} from this browser`);
        buttons.append(remove);
      }
      act.append(buttons);
      row.append(name, size, from, data, act);
      tbody.append(row);
    }
    table.append(thead, tbody);
    wrap.append(table);
    page.append(wrap);
    page.append(
      el(
        'p',
        'sb-soft sb-foot',
        'Every row is synthetic. A saved study stays in this browser and is sent nowhere; a study file can be shared like any other file.'
      )
    );
    return page;
  }

  return library();
}
