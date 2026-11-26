// What a study holds, at a glance, and what a table's columns hold. Both are
// worked out here from the tables' text: counts and plain summaries, nothing
// that needs R. A chart or a page can call them without the widget.

import { firstRows } from '../shared/csv.js';

/** How many of a table's rows a column summary reads. */
export const SUMMARY_ROWS = 5000;

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** A table's rows as objects, every value as text. */
function recordsOf(table, limit = Infinity) {
  if (!table) return [];
  const { header, rows } = firstRows(table.text, limit);
  return rows.map((row) => Object.fromEntries(header.map((name, index) => [name, row[index]])));
}

const filled = (value) => value !== undefined && value !== null && String(value).trim() !== '';
const distinct = (values) => new Set(values.filter(filled)).size;

/**
 * A study's overview: what the trial is, its headline counts, where its sites
 * are, and what each layer holds.
 * @param {Object} study What `buildStudy` resolved to.
 * @returns {{id: string, title: string, facts: Array<{label: string, value: string}>, counts: Array<{label: string, value: number, note?: string}>, countries: Array<{country: string, sites: number, participants: number}>, layers: Array<{id: string, label: string, tables: number, rows: number}>}} The overview.
 */
export function overviewOf(study) {
  const raw = (id) => study.table('raw', id);
  const [trial = {}] = recordsOf(raw('STUDY'), 1);
  const sites = recordsOf(raw('SITE'));
  const subjects = recordsOf(raw('SUBJ'));
  const events = recordsOf(raw('AE'));
  const enrolled = subjects.filter((row) => row.enrollyn === 'Y');

  const facts = [
    ['Study', study.id],
    ['Phase', trial.phase],
    ['Therapeutic area', trial.therapeutic_area],
    ['Indication', trial.protocol_indication],
    ['Status', trial.status],
    ['Snapshot', study.snapshotDate],
    ['Monthly snapshots', String(study.snapshots)]
  ]
    .filter(([, value]) => filled(value))
    .map(([label, value]) => ({ label, value: String(value) }));

  const rowsIn = (id) => (raw(id) ? raw(id).rows : null);
  const counts = [
    { label: 'Participants', value: subjects.length, note: `${enrolled.length} enrolled` },
    {
      label: 'Sites',
      value: sites.length,
      note: `${distinct(sites.map((row) => row.Country))} countries`
    },
    raw('AE') && {
      label: 'Adverse events',
      value: events.length,
      note: `${events.filter((row) => row.aeser === 'Y').length} serious`
    },
    raw('PD') && { label: 'Protocol deviations', value: rowsIn('PD') },
    raw('VISIT') && { label: 'Visits', value: rowsIn('VISIT') },
    raw('STUDCOMP') && { label: 'Left the study', value: rowsIn('STUDCOMP') },
    raw('SDRGCOMP') && { label: 'Stopped treatment', value: rowsIn('SDRGCOMP') },
    raw('Death') && { label: 'Deaths', value: rowsIn('Death') }
  ].filter(Boolean);

  // Sites and participants by country, most participants first.
  const byCountry = new Map();
  const country = (name) => {
    const key = filled(name) ? String(name) : 'Not recorded';
    if (!byCountry.has(key)) byCountry.set(key, { country: key, sites: 0, participants: 0 });
    return byCountry.get(key);
  };
  const siteCountry = new Map(sites.map((row) => [row.invid, row.Country]));
  for (const row of sites) country(row.Country).sites += 1;
  for (const row of subjects) country(siteCountry.get(row.invid)).participants += 1;
  const countries = [...byCountry.values()].sort(
    (a, b) => b.participants - a.participants || a.country.localeCompare(b.country)
  );

  const layers = study.layers.map((layer) => ({
    id: layer.id,
    label: layer.label,
    tables: layer.tables.length,
    rows: layer.tables.reduce((sum, table) => sum + table.rows, 0)
  }));

  return {
    id: study.id,
    title: filled(trial.protocol_title) ? String(trial.protocol_title) : study.id,
    facts,
    counts,
    countries,
    layers,
    growth: growthOf(study)
  };
}

/**
 * How a study grew, when its earlier snapshots were kept: the rows of its raw
 * tables at each snapshot, oldest first. Counted from what each snapshot
 * holds; no table's text is read.
 * @param {Object} study What `buildStudy` resolved to.
 * @returns {Array<{date: string, number: number, problem: ?string, participants: ?number, sites: ?number, visits: ?number, events: ?number}>} A line a snapshot; empty when only the last was kept.
 */
export function growthOf(study) {
  const kept = (study.history || []).length > 1 ? study.history : [];
  return kept.map((entry) => {
    const then = entry.study();
    const rows = (id) => (then && then.table('raw', id) ? then.table('raw', id).rows : null);
    return {
      date: entry.date,
      number: entry.number,
      problem: entry.problem,
      participants: rows('SUBJ'),
      sites: rows('SITE'),
      visits: rows('VISIT'),
      events: rows('AE')
    };
  });
}

/**
 * What each column of a table holds: how much of it is filled, how many
 * different values it has, and its range or its commonest values.
 * @param {Object} table A table of a study.
 * @param {number} [limit] How many rows to read; a larger table is summarised from its first rows.
 * @returns {{read: number, of: number, columns: Array<{name: string, type: string, filled: number, distinct: number, says: string}>}} The summary; `read` of the table's `of` rows were read.
 */
export function columnsOf(table, limit = SUMMARY_ROWS) {
  const { header, rows } = firstRows(table.text, limit);
  const types = new Map(table.columns.map((column) => [column.name, column.type]));
  const columns = header.map((name, index) => {
    const values = rows.map((row) => row[index]).filter(filled);
    const tally = new Map();
    for (const value of values) tally.set(value, (tally.get(value) || 0) + 1);
    const type = types.get(name) || '';
    let says = '';
    if (values.length && values.every((value) => NUMBER.test(value))) {
      const numbers = values.map(Number);
      says = `${Math.min(...numbers)} to ${Math.max(...numbers)}`;
    } else if (/^(Date|POSIXct)$/.test(type) && values.length) {
      const sorted = [...values].sort();
      says = `${sorted[0]} to ${sorted.at(-1)}`;
    } else {
      // The commonest values, most frequent first.
      says = [...tally.entries()]
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
        .slice(0, 4)
        .map(([value]) => value)
        .join(', ');
      if (tally.size > 4) says += ', …';
    }
    return {
      name,
      type,
      filled: rows.length ? values.length / rows.length : 0,
      distinct: tally.size,
      says
    };
  });
  return { read: rows.length, of: table.rows, columns };
}
