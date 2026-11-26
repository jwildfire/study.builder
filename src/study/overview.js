// The study at a glance: counts, where its sites and participants are, and
// what each layer holds.

import { CAVEATS } from '../engine/core.js';
import { overviewOf } from '../engine/overview.js';

/** The study at a glance, for the viewer's first view. */
export function overview({ el }, study, box) {
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
