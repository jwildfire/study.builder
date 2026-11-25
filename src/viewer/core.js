// study.viewer, the part with no page: what a study's tables hold. It takes any
// study, simulated or not: a name and a list of tables, each with its rows as
// CSV text or as records, and, when there is some, what each column is.
//
//   const study = viewerStudy({ name: 'My files', tables: [{ id: 'ae.csv', text }] });
//   rowsOf(study.tables[0])              every row, as objects of text
//   filterRows(rows, filters)            the rows that match
//   profileOf(table)                     what each column holds, with its spread
//   participantsOf(study)                every participant, across the tables
//   participantOf(study, id)             one participant's rows in every table
//
// It reads nothing but what it is given, and needs no R.

import { firstRows } from '../csv.js';

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** The columns a participant is named by, most particular first, lower case. */
export const PARTICIPANT_COLUMNS = Object.freeze([
  'usubjid',
  'subjid',
  'subjectid',
  'subject_id',
  'participant_id',
  'participantid'
]);

/** How many rows a column's profile reads; a longer table is profiled from its first rows. */
export const PROFILE_ROWS = 20000;
/** How many bars a column's spread has at most. */
export const BARS = 10;

const filled = (value) => value !== undefined && value !== null && String(value).trim() !== '';
const text = (value) => (value === undefined || value === null ? '' : String(value));
const list = (value) => (Array.isArray(value) ? value : []);

/** What kind of values a column holds: `number`, `date`, `text`, or `empty`. */
export function kindOf(values) {
  let seen = 0;
  let numbers = 0;
  let dates = 0;
  for (const value of values) {
    if (!filled(value)) continue;
    const said = String(value).trim();
    seen += 1;
    if (NUMBER.test(said)) numbers += 1;
    else if (ISO_DATE.test(said)) dates += 1;
    if (seen >= 500) break;
  }
  if (!seen) return 'empty';
  if (numbers === seen) return 'number';
  if (dates === seen) return 'date';
  return 'text';
}

// A table's rows are read once and kept, for as long as the table is.
const kept = new WeakMap();

/**
 * A table's rows, each an object of its columns' values as text.
 * @param {Object} table A table of a viewer study.
 * @returns {Object[]} The rows.
 */
export function rowsOf(table) {
  if (kept.has(table)) return kept.get(table);
  let rows;
  if (Array.isArray(table.records)) {
    rows = table.records;
  } else {
    const read = firstRows(table.text, Infinity);
    rows = read.rows.map((row) =>
      Object.fromEntries(read.header.map((name, index) => [name, row[index]]))
    );
  }
  kept.set(table, rows);
  return rows;
}

/** A table's column names, from what it says or from its first row. */
function namesOf(given) {
  const said = list(given.columns).map((column) =>
    typeof column === 'string' ? column : column && column.name
  );
  if (said.length) return said.filter(Boolean);
  if (Array.isArray(given.records))
    return given.records.length ? Object.keys(given.records[0]) : [];
  return firstRows(given.text, 0).header;
}

/** The column of a table that names the participant, or null. */
export function participantColumnOf(table) {
  const said = table.columns.find((column) => column.role === 'participant');
  if (said) return said.name;
  for (const wanted of PARTICIPANT_COLUMNS) {
    const found = table.columns.find((column) => column.name.toLowerCase() === wanted);
    if (found) return found.name;
  }
  return null;
}

/**
 * A study as the viewer reads one.
 * @param {Object} given `name`; `kind` (a word for where it came from); `about`; `facts`, label and value pairs; and `tables`.
 * @param {Object[]} given.tables Each: `id`; `label`; `group` (the heading it is listed under: a layer, or none); `text` (CSV) or `records` (objects); `rows` (how many, when known); `columns` (names, or `{name, type, label, key, joins, role, used, todo}`); `about`; `made` (a sentence on what made it); `note` (a sentence under its name); `file` (its file name).
 * @returns {Object} The study, with every table's columns named and its participant column found.
 */
export function viewerStudy(given = {}) {
  const tables = list(given.tables)
    .filter((table) => table && (typeof table.text === 'string' || Array.isArray(table.records)))
    .map((table, index) => {
      const said = new Map(
        list(table.columns)
          .filter((column) => column && typeof column === 'object')
          .map((column) => [column.name, column])
      );
      const made = {
        id: text(table.id) || `table-${index + 1}`,
        label: text(table.label) || text(table.id) || `Table ${index + 1}`,
        group: text(table.group),
        file: text(table.file) || `${text(table.id) || `table-${index + 1}`}.csv`,
        about: text(table.about),
        made: text(table.made),
        note: text(table.note),
        ...(typeof table.text === 'string' ? { text: table.text } : { records: table.records }),
        columns: namesOf(table).map((name) => ({ ...(said.get(name) || {}), name }))
      };
      made.rows = Number.isFinite(table.rows)
        ? table.rows
        : Array.isArray(table.records)
          ? table.records.length
          : rowsOf(made).length;
      made.participant = participantColumnOf(made);
      return made;
    });
  return {
    name: text(given.name) || 'Study',
    kind: text(given.kind),
    about: text(given.about),
    facts: list(given.facts).filter((fact) => fact && filled(fact.value)),
    tables
  };
}

/** The tables under each heading, in the order the headings first appear. */
export function groupsOf(study) {
  const groups = [];
  for (const table of study.tables) {
    let group = groups.find((one) => one.name === table.group);
    if (!group) groups.push((group = { name: table.group, tables: [] }));
    group.tables.push(table);
  }
  return groups;
}

/** The ways a filter compares, each with its words. */
export const OPERATORS = Object.freeze([
  Object.freeze({ id: 'is', label: 'is' }),
  Object.freeze({ id: 'not', label: 'is not' }),
  Object.freeze({ id: 'contains', label: 'contains' }),
  Object.freeze({ id: 'min', label: 'at least' }),
  Object.freeze({ id: 'max', label: 'at most' })
]);

/** A filter in words: `AESER is Y`. */
export function filterSaid(filter) {
  if (filter.op === 'between') return `${filter.column} from ${filter.value} to ${filter.to}`;
  const operator = OPERATORS.find((one) => one.id === filter.op);
  return `${filter.column} ${operator ? operator.label : filter.op} ${filter.value === '' ? 'empty' : filter.value}`;
}

function matches(row, filter) {
  const value = text(row[filter.column]).trim();
  const wanted = text(filter.value).trim();
  switch (filter.op) {
    case 'is':
      return value === wanted;
    case 'not':
      return value !== wanted;
    case 'contains':
      return value.toLowerCase().includes(wanted.toLowerCase());
    case 'min':
      return value !== '' && Number(value) >= Number(wanted);
    case 'max':
      return value !== '' && Number(value) <= Number(wanted);
    case 'between':
      return value !== '' && Number(value) >= Number(wanted) && Number(value) <= Number(filter.to);
    default:
      return true;
  }
}

/**
 * The rows that match every filter.
 * @param {Object[]} rows The rows.
 * @param {Array<{column: string, op: string, value: string, to?: string}>} filters The filters.
 * @returns {Object[]} The matching rows, in their order.
 */
export function filterRows(rows, filters) {
  const active = list(filters).filter((filter) => filter && filter.column);
  if (!active.length) return rows;
  return rows.filter((row) => active.every((filter) => matches(row, filter)));
}

/**
 * Rows in the order of one column: numbers by size, anything else by its text.
 * @param {Object[]} rows The rows.
 * @param {?{column: string, down?: boolean}} sort The column, and whether largest first.
 * @returns {Object[]} A sorted copy; the rows themselves when there is no sort.
 */
export function sortRows(rows, sort) {
  if (!sort || !sort.column) return rows;
  const numeric = kindOf(rows.map((row) => row[sort.column])) === 'number';
  const sign = sort.down ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = a[sort.column];
    const right = b[sort.column];
    // An empty value sorts last, whichever way.
    if (!filled(left) || !filled(right)) return filled(left) ? -1 : filled(right) ? 1 : 0;
    return (
      sign *
      (numeric
        ? Number(left) - Number(right)
        : String(left).localeCompare(String(right), undefined, { numeric: true }))
    );
  });
}

/**
 * What each column of a table holds: its kind, how full it is, how many
 * different values, its range or commonest values, and its spread as bars. A
 * bar carries the filter that shows its rows.
 * @param {Object} table A table of a viewer study.
 * @param {Object[]} [rows] The rows to profile; the table's own unless told, so a filtered table can be profiled.
 * @returns {{read: number, of: number, columns: Object[]}} `read` of `of` rows were read.
 */
export function profileOf(table, rows = rowsOf(table)) {
  const read = rows.slice(0, PROFILE_ROWS);
  const columns = table.columns.map((column) => {
    const values = read
      .map((row) => row[column.name])
      .filter(filled)
      .map((value) => String(value).trim());
    const kind = kindOf(values);
    const tally = new Map();
    for (const value of values) tally.set(value, (tally.get(value) || 0) + 1);
    let says = '';
    let bars = [];
    if (kind === 'number' && tally.size > BARS) {
      const numbers = values.map(Number);
      let low = Infinity;
      let high = -Infinity;
      for (const number of numbers) {
        if (number < low) low = number;
        if (number > high) high = number;
      }
      says = `${low} to ${high}`;
      const width = (high - low) / BARS || 1;
      const counts = new Array(BARS).fill(0);
      for (const number of numbers)
        counts[Math.min(BARS - 1, Math.floor((number - low) / width))] += 1;
      const round = (number) => Number(number.toPrecision(6));
      bars = counts.map((count, index) => {
        const from = round(low + index * width);
        const to = index === BARS - 1 ? high : round(low + (index + 1) * width);
        return {
          label: `${from} to ${to}`,
          count,
          filter: { column: column.name, op: 'between', value: String(from), to: String(to) }
        };
      });
    } else {
      const ordered = [...tally.entries()].sort((a, b) =>
        kind === 'text'
          ? b[1] - a[1] || a[0].localeCompare(b[0])
          : a[0].localeCompare(b[0], undefined, { numeric: true })
      );
      if (kind === 'number' || kind === 'date') {
        says = ordered.length ? `${ordered[0][0]} to ${ordered.at(-1)[0]}` : '';
      } else {
        const top = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        says = top
          .slice(0, 4)
          .map(([value]) => value)
          .join(', ');
        if (top.length > 4) says += ', …';
      }
      // A column with one value for nearly every row has no spread worth drawing.
      const drawn =
        tally.size <= BARS
          ? ordered
          : kind === 'text' && tally.size < values.length / 2
            ? ordered.slice(0, BARS)
            : [];
      bars = drawn.map(([value, count]) => ({
        label: value,
        count,
        filter: { column: column.name, op: 'is', value }
      }));
    }
    return {
      ...column,
      kind,
      filled: read.length ? values.length / read.length : 0,
      distinct: tally.size,
      says,
      bars
    };
  });
  return { read: read.length, of: rows.length, columns };
}

/**
 * Every participant in a study: the values of each table's participant column,
 * taken together, in the order they are first met.
 * @param {Object} study A viewer study.
 * @returns {string[]} The participants' ids.
 */
export function participantsOf(study) {
  const seen = new Set();
  // A table with one row a participant sets the order; then the rest, as listed.
  const naming = study.tables.filter((table) => table.participant);
  const onePer = (table) =>
    new Set(rowsOf(table).map((row) => text(row[table.participant]).trim())).size === table.rows;
  const first = naming.find((table) => table.rows > 0 && onePer(table));
  for (const table of first ? [first, ...naming.filter((one) => one !== first)] : naming) {
    for (const row of rowsOf(table)) {
      const id = text(row[table.participant]).trim();
      if (id) seen.add(id);
    }
  }
  return [...seen];
}

/**
 * One participant across a study: their rows in every table that names them.
 * @param {Object} study A viewer study.
 * @param {string} id The participant's id.
 * @returns {{id: string, tables: Array<{table: Object, rows: Object[]}>, without: Object[]}} Their rows by table, tables that hold none of them left out; and the tables that name no participant.
 */
export function participantOf(study, id) {
  const wanted = text(id).trim();
  const tables = [];
  for (const table of study.tables) {
    if (!table.participant) continue;
    const rows = rowsOf(table).filter((row) => text(row[table.participant]).trim() === wanted);
    if (rows.length) tables.push({ table, rows });
  }
  return { id: wanted, tables, without: study.tables.filter((table) => !table.participant) };
}

/** Rows as the text of a CSV file. */
export function csvOf(columns, rows) {
  const field = (value) => {
    const said = text(value);
    return /[",\n\r]/.test(said) ? `"${said.replace(/"/g, '""')}"` : said;
  };
  const lines = [columns.map(field).join(',')];
  for (const row of rows) lines.push(columns.map((column) => field(row[column])).join(','));
  return `${lines.join('\n')}\n`;
}
