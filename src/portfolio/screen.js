// The portfolio: the studies a reader can have at once (ready-made, and saved
// in this browser) and the settings that build one. The way in.

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
    build,
    attempt,
    saidLine,
    fileButton,
    refreshShelf,
    openDocument
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
        'Simulated clinical trials. Open one whose data is ready, build one from its settings, or describe your own.'
      )
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
    const rows = [
      ...ready.map((one) => ({ ...one, data: true })),
      ...plain.map((one) => ({ ...one, data: false }))
    ];
    const wrap = el('div', 'sb-studies');
    const table = el('table', 'sb-table sb-studies-table');
    const headRow = el('tr');
    for (const title of ['Study', 'Size', 'From', 'Data', '']) {
      const cell = el('th', null, title);
      cell.scope = 'col';
      headRow.append(cell);
    }
    const thead = el('thead');
    thead.append(headRow);
    const tbody = el('tbody');
    for (const one of rows) {
      const row = el('tr', 'sb-study');
      if (one.data) row.dataset.study = one.id;
      else row.dataset.settings = one.id;
      row.dataset.data = one.data ? 'ready' : 'settings';
      const name = el('th', 'sb-study-name');
      name.scope = 'row';
      name.append(el('strong', null, one.name));
      const note = one.data ? one.note : one.note || '';
      if (note) name.append(el('span', 'sb-soft', note));
      const size = el('td', 'sb-soft', one.size || '');
      const from = el('td');
      from.append(pill(one.kind));
      const data = el('td', 'sb-study-data');
      const has = el('span', 'sb-data', one.data ? 'Data ready' : 'Settings only');
      has.dataset.data = one.data ? 'ready' : 'settings';
      data.append(
        has,
        el(
          'span',
          'sb-soft',
          one.data
            ? `Opens at once${one.megabytes ? `, ${one.megabytes} MB` : ''}`
            : 'Build makes the data: about half a minute'
        )
      );
      const act = el('td', 'sb-study-act');
      const buttons = el('div', 'sb-row');
      if (one.data) {
        const open = button('sb-primary', 'Open', () => attempt(one.open), 'open');
        open.setAttribute('aria-label', `Open ${one.name}`);
        buttons.append(open);
      } else {
        const use = (then) => () =>
          attempt(async () => {
            take(await one.settings());
            s.problems = [];
            say('');
            then();
          });
        const edit = button(
          '',
          'Edit',
          use(() => go('describe')),
          'edit'
        );
        edit.setAttribute('aria-label', `Edit the settings of ${one.name}`);
        const run = button(
          'sb-primary',
          'Build',
          use(() => build()),
          'build-these'
        );
        run.setAttribute('aria-label', `Build ${one.name}`);
        buttons.append(run, edit);
      }
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
