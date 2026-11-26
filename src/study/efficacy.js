// The efficacy score, as it came out: the mean change from baseline by arm
// over the visits, drawn, with the numbers at the last visit and what the
// simulator was told beside them. Every number is read from the analysis
// layer's results table; nothing is worked out here but where to draw it.

import { firstRows } from '../shared/csv.js';

const NS = 'http://www.w3.org/2000/svg';
/** A colour for each arm: the reference arm first, then the others in turn. */
const COLOURS = ['--sb-soft', '--sb-accent', '--sb-blue', '--sb-ok', '--sb-warn', '--sb-bad'];

/**
 * The results table, read: one line a result, grouped by score, visit and arm.
 * @param {Object} study A built study, or one of its snapshots.
 * @returns {?{score: string, reference: string, arms: string[], visits: Array<{name: string, number: number}>, value: Function}} What it holds, or null when the study has no efficacy results.
 */
export function efficacyResults(study) {
  const table = study.table('analysis', 'EfficacySummary');
  if (!table || !table.rows) return null;
  const { header, rows } = firstRows(table.text, Infinity);
  const at = (name) => header.indexOf(name);
  const records = rows.map((row) => ({
    score: row[at('PARAM')],
    arm: row[at('ARM')],
    visit: row[at('VISIT')],
    number: Number(row[at('VISITNUM')]),
    statistic: row[at('STATISTIC')],
    value: Number(row[at('VALUE')]),
    reference: row[at('REFARM')]
  }));
  if (!records.length) return null;
  // One score is simulated for now: the first the table holds.
  const { score, reference } = records[0];
  const mine = records.filter((record) => record.score === score);
  const visits = [];
  for (const record of mine) {
    if (!visits.some((visit) => visit.name === record.visit)) {
      visits.push({ name: record.visit, number: record.number });
    }
  }
  visits.sort((a, b) => a.number - b.number);
  const names = [...new Set(mine.map((record) => record.arm))];
  const arms = [reference, ...names.filter((arm) => arm !== reference)].filter((arm) =>
    names.includes(arm)
  );
  const value = (arm, visit, statistic) => {
    const found = mine.find(
      (record) => record.arm === arm && record.visit === visit && record.statistic === statistic
    );
    return found && Number.isFinite(found.value) ? found.value : null;
  };
  return { score, reference, arms, visits, value };
}

const signed = (value, digits = 1) =>
  value === null
    ? ''
    : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}`;

/**
 * The Efficacy view.
 * @param {{el: Function}} dom The maker of elements.
 * @param {Object} study The study, or the snapshot of it, that is shown.
 * @param {Element} box Where to draw.
 * @returns {void}
 */
export function efficacy({ el }, study, box) {
  const results = efficacyResults(study);
  if (!results) {
    box.append(el('p', 'sb-soft', 'This snapshot has no efficacy scores yet.'));
    return;
  }
  const { score, reference, arms, visits, value } = results;
  const doc = box.ownerDocument;
  const svg = (tag, attributes = {}, text) => {
    const node = doc.createElementNS(NS, tag);
    for (const [name, said] of Object.entries(attributes)) node.setAttribute(name, String(said));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const colour = (arm) => `var(${COLOURS[arms.indexOf(arm) % COLOURS.length]})`;
  // What the simulator was told, when the study says.
  let assumed = null;
  try {
    assumed = study.args && study.args.efficacy ? JSON.parse(study.args.efficacy).scores[0] : null;
  } catch {
    assumed = null;
  }

  box.append(
    el('h4', 'sb-design-head', `${score}: mean change from baseline, by arm`),
    el(
      'p',
      'sb-soft',
      `Simulated. Each point is the mean change of the participants with a score at that visit; ${reference} is the reference arm.`
    )
  );

  // The chart: a line an arm, a point a visit.
  const width = 680;
  const height = 300;
  const left = 56;
  const right = 170;
  const top = 18;
  const bottom = 44;
  const means = arms.flatMap((arm) => visits.map((visit) => value(arm, visit.name, 'mean')));
  const known = means.filter((mean) => mean !== null);
  const low = Math.floor(Math.min(0, ...known) - 0.5);
  const high = Math.ceil(Math.max(0, ...known) + 0.5);
  const x = (index) =>
    left + (visits.length > 1 ? (index * (width - left - right)) / (visits.length - 1) : 0);
  const y = (mean) => top + ((high - mean) * (height - top - bottom)) / (high - low || 1);
  const chart = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    class: 'sb-efficacy-chart',
    'aria-label': `Mean change from baseline in ${score} by arm over ${visits.length} visits`
  });
  const step = Math.max(1, Math.ceil((high - low) / 6));
  for (let tick = low; tick <= high; tick += step) {
    chart.append(
      svg('line', {
        x1: left,
        x2: width - right,
        y1: y(tick),
        y2: y(tick),
        stroke: tick === 0 ? 'var(--sb-soft)' : 'var(--sb-rule)',
        'stroke-width': tick === 0 ? 1.2 : 1
      }),
      svg(
        'text',
        {
          x: left - 8,
          y: y(tick) + 4,
          'text-anchor': 'end',
          fill: 'var(--sb-soft)',
          'font-size': 12
        },
        signed(tick, 0) || '0'
      )
    );
  }
  visits.forEach((visit, index) => {
    chart.append(
      svg(
        'text',
        {
          x: x(index),
          y: height - bottom + 20,
          'text-anchor': index === 0 ? 'start' : 'middle',
          fill: 'var(--sb-soft)',
          'font-size': 12
        },
        visit.name
      )
    );
  });
  const ends = [];
  for (const arm of arms) {
    const points = visits
      .map((visit, index) => ({ index, mean: value(arm, visit.name, 'mean') }))
      .filter((point) => point.mean !== null);
    if (!points.length) continue;
    chart.append(
      svg('polyline', {
        fill: 'none',
        stroke: colour(arm),
        'stroke-width': 2.5,
        points: points.map((point) => `${x(point.index)},${y(point.mean)}`).join(' '),
        'data-arm': arm
      })
    );
    for (const point of points) {
      chart.append(
        svg('circle', { cx: x(point.index), cy: y(point.mean), r: 4, fill: colour(arm) })
      );
    }
    const last = points.at(-1);
    ends.push({ arm, at: y(last.mean), from: x(last.index), mean: last.mean });
  }
  // The arms' names at the ends of their lines, kept from sitting on each other.
  ends.sort((a, b) => a.at - b.at);
  ends.forEach((end, index) => {
    if (index && end.at - ends[index - 1].at < 15) end.at = ends[index - 1].at + 15;
    chart.append(
      svg(
        'text',
        { x: end.from + 10, y: end.at + 4, fill: colour(end.arm), 'font-size': 12 },
        `${end.arm} ${signed(end.mean)}`
      )
    );
  });
  const frame = el('div', 'sb-efficacy');
  frame.append(chart);
  box.append(frame);

  // The numbers at each visit, a line an arm.
  const wrap = el('div', 'sb-over');
  const grid = el('table', 'sb-table sb-efficacy-table');
  const head = el('tr');
  for (const title of ['Visit', 'Arm', 'n', 'Mean change', 'SD', `Difference from ${reference}`]) {
    head.append(el('th', null, title));
  }
  const thead = el('thead');
  thead.append(head);
  const tbody = el('tbody');
  for (const visit of visits.slice(1).length ? visits.slice(1) : visits) {
    for (const arm of arms) {
      const n = value(arm, visit.name, 'n');
      if (n === null) continue;
      const row = el('tr');
      row.dataset.visit = visit.name;
      row.dataset.arm = arm;
      const sd = value(arm, visit.name, 'sd');
      row.append(
        el('td', null, visit.name),
        el('td', null, arm),
        el('td', null, String(n)),
        el('td', null, signed(value(arm, visit.name, 'mean'))),
        el('td', null, sd === null ? '' : sd.toFixed(1)),
        el('td', null, arm === reference ? '' : signed(value(arm, visit.name, 'difference')))
      );
      tbody.append(row);
    }
  }
  grid.append(thead, tbody);
  wrap.append(grid);
  box.append(wrap);

  // The model, when the results hold one: each arm against the reference arm
  // at the last visit, adjusted for baseline.
  const lastName = visits.at(-1).name;
  const modelled = arms.filter(
    (arm) => arm !== reference && value(arm, lastName, 'adjusted difference') !== null
  );
  if (modelled.length) {
    const model = el('div', 'sb-over');
    const table = el('table', 'sb-table sb-efficacy-model');
    const top = el('tr');
    for (const title of [
      `At ${lastName}, against ${reference}`,
      'Adjusted difference',
      '95% interval',
      'Standard error',
      'p-value'
    ]) {
      top.append(el('th', null, title));
    }
    const tableHead = el('thead');
    tableHead.append(top);
    const body = el('tbody');
    for (const arm of modelled) {
      const row = el('tr');
      row.dataset.arm = arm;
      const p = value(arm, lastName, 'p-value');
      const lower = value(arm, lastName, 'lower 95% limit');
      const upper = value(arm, lastName, 'upper 95% limit');
      const error = value(arm, lastName, 'standard error');
      row.append(
        el('td', null, arm),
        el('td', null, signed(value(arm, lastName, 'adjusted difference'), 2)),
        el(
          'td',
          null,
          lower === null || upper === null ? '' : `${signed(lower, 2)} to ${signed(upper, 2)}`
        ),
        el('td', null, error === null ? '' : error.toFixed(2)),
        el('td', null, p === null ? '' : p < 0.0001 ? '< 0.0001' : p.toFixed(4))
      );
      body.append(row);
    }
    table.append(tableHead, body);
    model.append(
      el('h4', null, 'Model: analysis of covariance'),
      table,
      el(
        'p',
        'sb-soft',
        'Change from baseline at the last visit by arm, with the baseline score as covariate, fitted by the Efficacy summary workflow. No adjustment for more than one comparison, and nothing is assumed of participants who left: they are not in it.'
      )
    );
    box.append(model);
  }

  if (assumed) {
    const told = Object.entries(assumed.effects || {})
      .map(([arm, effect]) => `${arm} ${signed(Number(effect))}`)
      .join(', ');
    const lastVisit = visits.at(-1).name;
    box.append(
      el(
        'p',
        'sb-soft sb-efficacy-told',
        `What the simulator was told, by ${lastVisit}: a change of ${signed(Number(assumed.change))} on ${reference}; differences from it of ${told || 'none'}; a standard deviation of ${assumed.sd}. What came out differs by chance, and more so where few participants have reached a visit.`
      )
    );
  }
  box.append(
    el(
      'p',
      'sb-soft',
      'The numbers are the analysis layer’s Efficacy summary table, one row a result.'
    )
  );
}
