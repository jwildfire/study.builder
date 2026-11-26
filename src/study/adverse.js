// Adverse events by arm: for each term, how many participants of each arm had
// at least one, and what share of the arm that is. Every number is read from
// the analysis layer's summary by arm; nothing is worked out here.

import { firstRows } from '../shared/csv.js';

/**
 * The summary by arm, read.
 * @param {Object} study A built study, or one of its snapshots.
 * @returns {?{arms: Array<{name: string, people: number}>, terms: Object[]}} What it holds, or null when the study has no summary by arm.
 */
export function eventsByArm(study) {
  const table = study.table('analysis', 'AESummaryByArm');
  if (!table || !table.rows) return null;
  const { header, rows } = firstRows(table.text, Infinity);
  const at = (name) => header.indexOf(name);
  const arms = [];
  const terms = new Map();
  for (const row of rows) {
    const arm = row[at('ARM')];
    if (!arms.some((one) => one.name === arm)) {
      arms.push({ name: arm, people: Number(row[at('BIGN')]) });
    }
    const key = `${row[at('AEBODSYS')]}|${row[at('AEDECOD')]}`;
    const term = terms.get(key) || {
      system: row[at('AEBODSYS')],
      term: row[at('AEDECOD')],
      arms: {},
      most: 0
    };
    const percent = Number(row[at('PERCENT')]);
    term.arms[arm] = {
      participants: Number(row[at('PARTICIPANTS')]),
      percent,
      serious: Number(row[at('SERIOUS')])
    };
    term.most = Math.max(term.most, percent);
    terms.set(key, term);
  }
  if (!arms.length) return null;
  return { arms, terms: [...terms.values()].sort((a, b) => b.most - a.most) };
}

/**
 * The Adverse events view of the Reporting section.
 * @param {{el: Function}} dom The maker of elements.
 * @param {Object} study The study, or the snapshot of it, that is shown.
 * @param {Element} box Where to draw.
 * @param {string} [reference] The reference arm, shown first.
 * @returns {void}
 */
export function adverse({ el }, study, box, reference = null) {
  const said = eventsByArm(study);
  if (!said) {
    box.append(el('p', 'sb-soft', 'This snapshot has no adverse event summary by arm yet.'));
    return;
  }
  const arms = [
    ...said.arms.filter((arm) => arm.name === reference),
    ...said.arms.filter((arm) => arm.name !== reference)
  ];
  box.append(
    el('h4', 'sb-design-head', 'Adverse events by arm'),
    el(
      'p',
      'sb-soft',
      'Simulated. Participants with at least one event of the term, and the share of the arm; the commonest in any arm first.'
    )
  );
  const wrap = el('div', 'sb-over');
  const grid = el('table', 'sb-table sb-events-arm');
  const head = el('tr');
  head.append(el('th', null, 'Body system'), el('th', null, 'Term'));
  for (const arm of arms) head.append(el('th', null, `${arm.name} (N=${arm.people})`));
  const top = el('thead');
  top.append(head);
  const body = el('tbody');
  for (const term of said.terms) {
    const row = el('tr');
    row.dataset.term = term.term;
    row.append(el('td', null, term.system), el('td', null, term.term));
    for (const arm of arms) {
      const one = term.arms[arm.name];
      row.append(el('td', null, one ? `${one.participants} (${one.percent.toFixed(1)}%)` : '0'));
    }
    body.append(row);
  }
  grid.append(top, body);
  wrap.append(grid);
  box.append(
    wrap,
    el(
      'p',
      'sb-soft',
      'The numbers are the analysis layer’s adverse event summary by arm, one row an arm and term. No test is made between the arms.'
    )
  );
}
