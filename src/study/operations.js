// The study as the people running it would watch it, with no arm named: the
// site metrics gsm worked out for the snapshot, and the adverse events pooled.
// Every number is read from a table a workflow made; nothing is worked out
// here but where to draw it.

import { firstRows } from '../shared/csv.js';

const records = (table) => {
  const { header, rows } = firstRows(table.text, Infinity);
  return rows.map((row) => Object.fromEntries(header.map((name, at) => [name, row[at]])));
};
const number = (said) => (said === '' || said === undefined || said === 'NA' ? null : Number(said));
const tilesOf = (el, list) => {
  const tiles = el('ul', 'sb-tiles');
  for (const [value, label] of list) {
    const tile = el('li', 'sb-tile');
    tile.append(
      el('span', 'sb-tile-value', Number(value).toLocaleString('en-US')),
      el('span', 'sb-tile-label', label)
    );
    tiles.append(tile);
  }
  return tiles;
};

/**
 * The site metrics of a snapshot, read: one line a site and metric.
 * @param {Object} study A built study, or one of its snapshots.
 * @returns {?{metrics: Object[], sites: string[], result: Function}} What the reporting layer holds, or null when the study has no site results.
 */
export function siteResults(study) {
  const results = study.table('reporting', 'Results');
  const about = study.table('reporting', 'Metrics');
  if (!results || !results.rows || !about) return null;
  const lines = records(results).filter((line) => line.GroupLevel === 'Site');
  if (!lines.length) return null;
  const metrics = records(about)
    .filter((metric) => lines.some((line) => line.MetricID === metric.MetricID))
    .map((metric) => ({
      id: metric.MetricID,
      short: metric.Abbreviation || metric.ID,
      name: metric.Metric,
      numerator: metric.Numerator,
      denominator: metric.Denominator
    }));
  const found = new Map(lines.map((line) => [`${line.GroupID}|${line.MetricID}`, line]));
  const result = (site, metric) => {
    const line = found.get(`${site}|${metric}`);
    if (!line) return null;
    return {
      numerator: number(line.Numerator),
      denominator: number(line.Denominator),
      score: number(line.Score),
      flag: number(line.Flag)
    };
  };
  const weight = (site) =>
    metrics.reduce((sum, metric) => sum + Math.abs((result(site, metric.id) || {}).flag || 0), 0);
  const sites = [...new Set(lines.map((line) => line.GroupID))].sort(
    (a, b) => weight(b) - weight(a) || a.localeCompare(b)
  );
  return { metrics, sites, result };
}

/**
 * The RBQM view: sites by metrics, each cell the flag gsm gave.
 * @param {{el: Function, button: Function}} dom The makers of elements.
 * @param {Object} study The study, or the snapshot of it, that is shown.
 * @param {Element} box Where to draw.
 * @param {{open: Function}} [act] `open(tableId)` shows a table in the Tables view.
 * @returns {void}
 */
export function rbqm({ el, button }, study, box, { open = null } = {}) {
  const said = siteResults(study);
  if (!said) {
    box.append(el('p', 'sb-soft', 'This snapshot has no site metrics yet.'));
    return;
  }
  const { metrics, sites, result } = said;
  const flags = sites.flatMap((site) => metrics.map((metric) => result(site, metric.id)));
  const at = (test) => flags.filter((one) => one && one.flag !== null && test(Math.abs(one.flag)));
  box.append(
    el('h4', 'sb-design-head', 'Site metrics, by site'),
    el(
      'p',
      'sb-soft',
      `Simulated. Each cell is the flag {gsm} gave the site for the metric at ${study.snapshotDate || 'this snapshot'}, with its score. Sites with the most flags are first.`
    ),
    tilesOf(el, [
      [sites.length, 'Sites with a result'],
      [metrics.length, 'Metrics'],
      [at((flag) => flag >= 2).length, 'Red flags'],
      [at((flag) => flag === 1).length, 'Amber flags']
    ])
  );
  const wrap = el('div', 'sb-over');
  const grid = el('table', 'sb-table sb-flags');
  const head = el('tr');
  head.append(el('th', null, 'Site'));
  for (const metric of metrics) {
    const th = el('th', null, metric.short);
    th.title = `${metric.name}: ${metric.numerator} over ${metric.denominator}`;
    head.append(th);
  }
  const top = el('thead');
  top.append(head);
  const body = el('tbody');
  for (const site of sites) {
    const row = el('tr');
    row.dataset.site = site;
    row.append(el('td', null, site));
    for (const metric of metrics) {
      const one = result(site, metric.id);
      const cell = el('td');
      const mark = el('span', 'sb-flag');
      if (!one || one.flag === null) {
        mark.dataset.flag = 'none';
        mark.textContent = one ? 'too few' : '';
        if (one)
          mark.title = `${metric.name}: ${one.numerator} over ${one.denominator}; too little to score.`;
      } else {
        const size = Math.abs(one.flag);
        mark.dataset.flag = size >= 2 ? 'red' : size === 1 ? 'amber' : 'green';
        const sign = one.score > 0 ? '+' : one.score < 0 ? '−' : '';
        mark.textContent = one.score === null ? '' : `${sign}${Math.abs(one.score).toFixed(1)}`;
        mark.title = `${metric.name}: ${one.numerator} over ${one.denominator}; flag ${one.flag}.`;
      }
      cell.append(mark);
      row.append(cell);
    }
    body.append(row);
  }
  grid.append(top, body);
  wrap.append(grid);
  box.append(wrap);
  const key = el('p', 'sb-soft sb-flag-key');
  for (const [flag, words] of [
    ['green', 'within limits'],
    ['amber', 'amber flag'],
    ['red', 'red flag'],
    ['none', 'too little to score']
  ]) {
    const mark = el('span', 'sb-flag', ' ');
    mark.dataset.flag = flag;
    key.append(mark, el('span', null, words));
  }
  box.append(key);
  const names = el('p', 'sb-soft');
  names.textContent = `The metrics: ${metrics.map((metric) => `${metric.short}, ${metric.name}`).join('; ')}.`;
  box.append(names);
  if (typeof open === 'function') {
    const line = el('p', 'sb-soft');
    line.append(
      el('span', null, 'The numbers are the reporting layer’s Results table. '),
      button('sb-link', 'Open the Results table', () => open('reporting:Results'), 'open-results')
    );
    box.append(line);
  }
}

/**
 * The pooled adverse events of a snapshot, read from the overall summary.
 * @param {Object} study A built study, or one of its snapshots.
 * @returns {?{terms: Object[], systems: Object[], people: number}} What the analysis layer holds, or null when the study has no summary.
 */
export function pooledEvents(study) {
  const table = study.table('analysis', 'AESummary');
  if (!table || !table.rows) return null;
  const terms = records(table).map((line) => ({
    system: line.AEBODSYS,
    term: line.AEDECOD,
    events: Number(line.EVENTS),
    serious: Number(line.SERIOUS),
    participants: Number(line.PARTICIPANTS),
    percent: Number(line.PERCENT),
    people: Number(line.BIGN)
  }));
  if (!terms.length) return null;
  const bySystem = new Map();
  for (const one of terms) {
    const sum = bySystem.get(one.system) || { system: one.system, events: 0, serious: 0, terms: 0 };
    sum.events += one.events;
    sum.serious += one.serious;
    sum.terms += 1;
    bySystem.set(one.system, sum);
  }
  return {
    terms: terms.sort((a, b) => b.percent - a.percent || b.events - a.events),
    systems: [...bySystem.values()].sort((a, b) => b.events - a.events),
    people: terms[0].people
  };
}

/**
 * The Safety view: adverse events over every arm together.
 * @param {{el: Function, button: Function}} dom The makers of elements.
 * @param {Object} study The study, or the snapshot of it, that is shown.
 * @param {Element} box Where to draw.
 * @param {{open: Function}} [act] `open(tableId)` shows a table in the Tables view.
 * @returns {void}
 */
export function safety({ el, button }, study, box, { open = null } = {}) {
  const said = pooledEvents(study);
  if (!said) {
    box.append(el('p', 'sb-soft', 'This snapshot has no adverse event summary yet.'));
    return;
  }
  const { terms, systems, people } = said;
  const events = systems.reduce((sum, one) => sum + one.events, 0);
  const serious = systems.reduce((sum, one) => sum + one.serious, 0);
  box.append(
    el('h4', 'sb-design-head', 'Adverse events, every arm together'),
    el(
      'p',
      'sb-soft',
      'Simulated. No arm is named here, as on a blinded study; the split by arm is under Reporting.'
    ),
    tilesOf(el, [
      [people, 'Participants'],
      [events, 'Adverse events'],
      [serious, 'Serious events'],
      [terms.length, 'Terms reported']
    ])
  );

  // The commonest terms: the share of participants with at least one.
  const most = terms.slice(0, 12);
  const widest = Math.max(...most.map((one) => one.percent), 1);
  box.append(el('h4', 'sb-design-head', 'Commonest terms · participants with at least one'));
  const bars = el('ul', 'sb-bars');
  for (const one of most) {
    const line = el('li', 'sb-bar');
    line.dataset.term = one.term;
    const track = el('span', 'sb-bar-track');
    const fill = el('span', 'sb-bar-fill');
    fill.style.width = `${(100 * one.percent) / widest}%`;
    track.append(fill);
    const name = el('span', 'sb-bar-name', one.term);
    name.title = one.system;
    line.append(
      name,
      track,
      el('span', 'sb-bar-value', `${one.participants} (${one.percent.toFixed(1)}%)`)
    );
    bars.append(line);
  }
  box.append(bars);

  box.append(el('h4', 'sb-design-head', 'By body system'));
  const wrap = el('div', 'sb-over');
  const grid = el('table', 'sb-table sb-systems');
  const head = el('tr');
  for (const title of ['Body system', 'Terms', 'Events', 'Serious'])
    head.append(el('th', null, title));
  const top = el('thead');
  top.append(head);
  const body = el('tbody');
  for (const one of systems) {
    const row = el('tr');
    row.dataset.system = one.system;
    row.append(
      el('td', null, one.system),
      el('td', null, String(one.terms)),
      el('td', null, String(one.events)),
      el('td', null, String(one.serious))
    );
    body.append(row);
  }
  grid.append(top, body);
  wrap.append(grid);
  box.append(wrap);
  if (typeof open === 'function') {
    const line = el('p', 'sb-soft');
    line.append(
      el('span', null, 'The numbers are the analysis layer’s adverse event summary. '),
      button('sb-link', 'Open the summary table', () => open('analysis:AESummary'), 'open-events')
    );
    box.append(line);
  }
}
