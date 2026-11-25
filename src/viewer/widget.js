// study.viewer on a page: a rail of the study's tables, and three ways to look
// at them. Tables shows the open table's rows, filtered and sorted. Columns
// profiles every column, and a bar of a column's spread filters to it. One
// participant follows a person across every table that names them.
//
//   StudyViewer.mount('#viewer', { study: { name, tables: [{ id, text }] } });
//
// It is the same for any study: a simulated one lists its tables by layer and
// says what built each; a reader's own files are one flat list.

import {
  OPERATORS,
  csvOf,
  filterRows,
  filterSaid,
  groupsOf,
  participantOf,
  participantsOf,
  profileOf,
  rowsOf,
  sortRows,
  viewerStudy
} from './core.js';
import { injectViewerStyles } from './styles.js';

/** The three views, in order. */
export const VIEWS = Object.freeze([
  Object.freeze({ id: 'tables', label: 'Tables' }),
  Object.freeze({ id: 'columns', label: 'Columns' }),
  Object.freeze({ id: 'participant', label: 'One participant' })
]);

/** How many rows the grid shows, and how many more each press adds. */
export const PAGE = 50;
/** How many of a participant's rows each table's block shows. */
const BLOCK_ROWS = 6;
/** How many columns a participant's block shows. */
const BLOCK_COLUMNS = 6;

const count = (number, noun) =>
  `${Number(number).toLocaleString('en-US')} ${noun}${Number(number) === 1 ? '' : 's'}`;

/**
 * Mount the viewer.
 * @param {string|Element} target The element, or a selector for it.
 * @param {Object} [options]
 * @param {Object} [options.study] The study, as `viewerStudy` takes one.
 * @param {string} [options.view] The view to open on: `tables`, `columns` or `participant`.
 * @param {string} [options.table] The id of the table to open on; the first unless told.
 * @param {?string} [options.theme] `light` or `dark`; the reader's own setting unless told.
 * @param {(name: string, text: string, type: string) => void} [options.save] Saves a file; with none there is no download.
 * @param {(table: Object, column: Object) => void} [options.onColumn] Called when the reader presses a column's `todo` button, for a page that maps columns.
 * @param {(table: Object, role: Object, value: string) => void} [options.onRole] Called when the reader sets one of a table's `roles`, for a page that maps columns: the role, and the column or value chosen (empty for none).
 * @param {Array<{id: string, label: string, render: (container: Element) => void}>} [options.views] Views of the page's own, shown before the three: a study overview, say.
 * @param {{label: string, open: (id: string) => void}} [options.participantAction] A button on a participant's page, for a page that has more to show of one.
 * @param {(state: Object) => void} [options.onChange] Told the view, the table and the participant when any changes.
 * @returns {{setStudy: Function, open: Function, show: Function, state: Function, destroy: Function}} The handle.
 */
export function mountViewer(
  target,
  {
    study: given = { tables: [] },
    view: openingView = undefined,
    table: openingTable = null,
    theme = null,
    save = null,
    onColumn = null,
    onRole = null,
    views: extraGiven = [],
    participantAction = null,
    onChange = null
  } = {}
) {
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) throw new Error('study.viewer: there is no element to mount into.');
  const doc = root.ownerDocument;
  injectViewerStyles(doc);

  const el = (tag, className, said) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (said !== undefined) node.textContent = said;
    return node;
  };
  const button = (className, said, onClick) => {
    const node = el('button', className, said);
    node.type = 'button';
    node.onclick = onClick;
    return node;
  };

  let study = viewerStudy(given);
  // The page's own views come first, and the viewer opens on the first of them.
  const extra = (Array.isArray(extraGiven) ? extraGiven : []).filter(
    (one) =>
      one && one.id && typeof one.render === 'function' && !VIEWS.some((own) => own.id === one.id)
  );
  const allViews = [...extra, ...VIEWS];
  const isExtra = (id) => extra.some((one) => one.id === id);
  let view = allViews.some((one) => one.id === openingView)
    ? openingView
    : extra.length && openingView === undefined
      ? extra[0].id
      : 'tables';
  let tableId = openingTable;
  const filters = new Map(); // table id → its filters
  const sorts = new Map(); // table id → { column, down }
  let shown = PAGE;
  let find = '';
  let adding = false; // whether the form that adds a filter is open
  const groupsOpen = new Set(); // the headings of the rail that are unfolded
  const groupsSeen = new Set(); // the headings the open table has unfolded once
  const rolesOpen = new Set(); // the tables whose set mapping rows are unfolded
  let people = null; // the study's participants, found when first asked for
  let person = null;
  let destroyed = false;

  const table = () => study.tables.find((one) => one.id === tableId) || study.tables[0] || null;
  const filtersOf = (one) => filters.get(one.id) || [];
  const told = () => {
    if (typeof onChange === 'function') {
      onChange({ view, table: table() ? table().id : null, participant: person });
    }
  };
  const participants = () => {
    if (!people) people = participantsOf(study);
    return people;
  };

  function addFilter(one, filter) {
    const next = filtersOf(one).filter(
      (other) => !(other.column === filter.column && other.op === filter.op)
    );
    filters.set(one.id, [...next, filter]);
    shown = PAGE;
  }

  // ---- the rail ----

  function rail() {
    const nav = el('nav', 'sv-rail');
    nav.setAttribute('aria-label', 'Tables');
    if (study.tables.length > 8) {
      const box = el('input', 'sv-find');
      box.type = 'search';
      box.name = 'find';
      box.placeholder = 'Find a table';
      box.setAttribute('aria-label', 'Find a table');
      box.value = find;
      box.oninput = () => {
        find = box.value;
        draw();
      };
      nav.append(box);
    }
    const wanted = find.trim().toLowerCase();
    const open = table();
    const groups = groupsOf(study);
    // Several headings fold: the one the open table is under is unfolded, and
    // the reader unfolds the rest. One heading, or a search, shows everything.
    const folding = groups.filter((group) => group.name).length > 1 && !wanted;
    if (folding && open && !groupsSeen.has(open.group)) {
      groupsSeen.add(open.group);
      groupsOpen.add(open.group);
    }
    for (const group of groups) {
      const listed = group.tables.filter(
        (one) => !wanted || `${one.label} ${one.id}`.toLowerCase().includes(wanted)
      );
      if (!listed.length) continue;
      const unfolded = !folding || groupsOpen.has(group.name);
      if (group.name) {
        const head = folding
          ? button('sv-group sv-fold', undefined, () => {
              if (groupsOpen.has(group.name)) groupsOpen.delete(group.name);
              else groupsOpen.add(group.name);
              draw();
            })
          : el('div', 'sv-group');
        if (folding) {
          head.dataset.group = group.name;
          head.setAttribute('aria-expanded', String(unfolded));
        }
        head.append(el('span', null, group.name), el('span', null, String(group.tables.length)));
        nav.append(head);
      }
      if (!unfolded) continue;
      for (const one of listed) {
        const pick = button('sv-pick', undefined, () => {
          tableId = one.id;
          shown = PAGE;
          adding = false;
          if (view === 'participant' || isExtra(view)) view = 'tables';
          draw();
          told();
        });
        pick.dataset.table = one.id;
        pick.setAttribute(
          'aria-current',
          String(one === open && view !== 'participant' && !isExtra(view))
        );
        if (one.about || one.made) pick.title = [one.about, one.made].filter(Boolean).join(' ');
        pick.append(
          el('span', 'sv-pick-name', one.label),
          el('span', 'sv-pick-rows', one.rows.toLocaleString('en-US'))
        );
        nav.append(pick);
      }
    }
    return nav;
  }

  // ---- shared pieces ----

  function grid(header, rows, { sort = null, onSort = null, cell = null } = {}) {
    const scroll = el('div', 'sv-scroll');
    const made = el('table', 'sv-grid');
    const head = el('tr');
    for (const column of header) {
      const th = el('th');
      th.scope = 'col';
      const name = typeof column === 'string' ? column : column.name;
      if (onSort) {
        const arrow = sort && sort.column === name ? (sort.down ? ' ▼' : ' ▲') : '';
        const press = button('sv-sort', `${name}${arrow}`, () => onSort(name));
        if (arrow) th.setAttribute('aria-sort', sort.down ? 'descending' : 'ascending');
        th.append(press);
      } else th.append(name);
      const under = typeof column === 'string' ? '' : column.under;
      if (under) th.append(el('small', null, under));
      head.append(th);
    }
    const top = el('thead');
    top.append(head);
    const body = el('tbody');
    for (const row of rows) {
      const line = el('tr');
      header.forEach((column) => {
        const name = typeof column === 'string' ? column : column.name;
        const td = el('td');
        const value = row[name] === undefined || row[name] === null ? '' : String(row[name]);
        const custom = cell ? cell(name, value, row) : null;
        if (custom) td.append(custom);
        else td.textContent = value;
        line.append(td);
      });
      body.append(line);
    }
    made.append(top, body);
    scroll.append(made);
    return scroll;
  }

  function heading(one) {
    const head = el('div', 'sv-head');
    const words = el('div');
    const title = el('h3', 'sv-title', one.label);
    if (one.about) title.append(el('span', 'sv-title-about', one.about));
    words.append(title);
    const facts = [count(one.rows, 'row'), count(one.columns.length, 'column'), one.made].filter(
      Boolean
    );
    words.append(el('p', 'sv-meta', facts.join(' · ')));
    if (one.note) {
      const note = el('p', 'sv-note', one.note);
      note.dataset.note = one.id;
      words.append(note);
    }
    head.append(words);
    if (typeof save === 'function') {
      const download = button('sv-button', 'Download CSV', () =>
        save(
          one.file,
          typeof one.text === 'string'
            ? one.text
            : csvOf(
                one.columns.map((column) => column.name),
                rowsOf(one)
              ),
          'text/csv'
        )
      );
      download.dataset.action = 'download';
      head.append(download);
    }
    return head;
  }

  function viewTabs() {
    const tabs = el('div', 'sv-views');
    tabs.setAttribute('role', 'tablist');
    for (const one of allViews) {
      const tab = button('sv-view', one.label, () => {
        view = one.id;
        adding = false;
        draw();
        told();
      });
      tab.dataset.view = one.id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(view === one.id));
      tabs.append(tab);
    }
    return tabs;
  }

  function filterRow(one, matching) {
    const row = el('div', 'sv-filters');
    row.append(el('span', 'sv-label', 'Filters'));
    for (const filter of filtersOf(one)) {
      const chip = button('sv-chip', `${filterSaid(filter)} ✕`, () => {
        filters.set(
          one.id,
          filtersOf(one).filter((other) => other !== filter)
        );
        shown = PAGE;
        draw();
      });
      chip.setAttribute('aria-label', `Remove the filter ${filterSaid(filter)}`);
      chip.dataset.filter = filter.column;
      row.append(chip);
    }
    if (adding) {
      const form = el('form', 'sv-add');
      const column = el('select', 'sv-input');
      column.name = 'filter-column';
      column.setAttribute('aria-label', 'Column');
      for (const each of one.columns) {
        const option = el('option', null, each.name);
        option.value = each.name;
        column.append(option);
      }
      const op = el('select', 'sv-input');
      op.name = 'filter-op';
      op.setAttribute('aria-label', 'How it compares');
      for (const each of OPERATORS) {
        const option = el('option', null, each.label);
        option.value = each.id;
        op.append(option);
      }
      const value = el('input', 'sv-input');
      value.name = 'filter-value';
      value.setAttribute('aria-label', 'Value');
      value.placeholder = 'value';
      const add = el('button', 'sv-button', 'Add');
      add.type = 'submit';
      form.onsubmit = (event) => {
        event.preventDefault();
        addFilter(one, { column: column.value, op: op.value, value: value.value });
        adding = false;
        draw();
      };
      form.append(
        column,
        op,
        value,
        add,
        button('sv-button', 'Cancel', () => {
          adding = false;
          draw();
        })
      );
      row.append(form);
    } else {
      const add = button('sv-button', 'Add a filter', () => {
        adding = true;
        draw();
        const first = root.querySelector('[name="filter-column"]');
        if (first) first.focus();
      });
      add.dataset.action = 'add-filter';
      row.append(add);
    }
    const said = el(
      'span',
      'sv-meta sv-count',
      filtersOf(one).length
        ? `${matching.toLocaleString('en-US')} of ${count(one.rows, 'row')}`
        : count(one.rows, 'row')
    );
    said.setAttribute('role', 'status');
    row.append(said);
    return row;
  }

  // ---- the three views ----

  function tablesView(one) {
    const wrap = el('div', 'sv-body');
    const matching = filterRows(rowsOf(one), filtersOf(one));
    const sort = sorts.get(one.id) || null;
    const ordered = sortRows(matching, sort);
    wrap.append(filterRow(one, matching.length));
    const header = one.columns.map((column) => ({
      name: column.name,
      under: [column.type, column.key ? 'key' : '', column.joins ? `joins ${column.joins.id}` : '']
        .filter(Boolean)
        .join(' · ')
    }));
    wrap.append(
      grid(header, ordered.slice(0, shown), {
        sort,
        onSort: (name) => {
          const was = sorts.get(one.id);
          sorts.set(one.id, {
            column: name,
            down: Boolean(was && was.column === name && !was.down)
          });
          draw();
        },
        cell: (name, value) => {
          if (name !== one.participant || !value) return null;
          const link = button('sv-link', value, () => {
            person = value.trim();
            view = 'participant';
            draw();
            told();
          });
          link.dataset.participant = value.trim();
          return link;
        }
      })
    );
    const foot = el('div', 'sv-foot');
    const upTo = Math.min(shown, ordered.length);
    foot.append(
      el(
        'span',
        'sv-meta',
        ordered.length
          ? `Rows 1 to ${upTo.toLocaleString('en-US')} of ${ordered.length.toLocaleString('en-US')}`
          : 'No row matches the filters.'
      )
    );
    if (upTo < ordered.length) {
      const more = button('sv-button', `Show ${PAGE} more`, () => {
        shown += PAGE;
        draw();
      });
      more.dataset.action = 'more';
      foot.append(more);
    }
    wrap.append(foot);
    return wrap;
  }

  /** What a page reads from a table: each role with a choice of what it is set to. */
  function rolesPanel(one) {
    const open = one.roles.filter((role) => !role.value);
    const panel = el('section', 'sv-roles');
    panel.dataset.roles = one.id;
    const row = (role) => {
      const line = el('label', 'sv-role');
      line.dataset.role = role.id;
      const words = el('span', 'sv-role-words');
      words.append(el('span', 'sv-role-label', role.label));
      if (role.needed) words.append(el('small', null, role.needed));
      const pick = el('select', 'sv-input');
      pick.name = `role-${one.id}-${role.id}`;
      const none = el('option', null, role.kind === 'value' ? 'not in this data' : 'no column');
      none.value = '';
      pick.append(none);
      for (const option of role.options) {
        const made = el('option', null, option);
        made.value = option;
        pick.append(made);
      }
      pick.value = role.options.includes(role.value) ? role.value : '';
      pick.disabled = typeof onRole !== 'function';
      pick.onchange = () => onRole(one, role, pick.value);
      line.append(words, pick);
      if (role.source && role.value) line.append(el('span', 'sv-tag', role.source));
      return line;
    };
    const head = el('div', 'sv-roles-head');
    head.append(
      el('span', 'sv-label', 'Mapping'),
      el(
        'span',
        open.length ? 'sv-note' : 'sv-meta',
        open.length
          ? `${count(open.length, 'row')} to set, of ${one.roles.length}`
          : `All ${one.roles.length} set`
      )
    );
    panel.append(head);
    for (const role of open) panel.append(row(role));
    const rest = one.roles.filter((role) => role.value);
    if (rest.length) {
      const fold = el('details', 'sv-roles-rest');
      fold.open = rolesOpen.has(one.id);
      fold.addEventListener('toggle', () => {
        if (fold.open) rolesOpen.add(one.id);
        else rolesOpen.delete(one.id);
      });
      fold.append(el('summary', null, `${rest.length} already set`));
      for (const role of rest) fold.append(row(role));
      panel.append(fold);
    }
    return panel;
  }

  function columnsView(one) {
    const wrap = el('div', 'sv-body');
    const matching = filterRows(rowsOf(one), filtersOf(one));
    const profile = profileOf(one, matching);
    if (filtersOf(one).length) wrap.append(filterRow(one, matching.length));
    if (profile.read < profile.of) {
      wrap.append(
        el(
          'p',
          'sv-meta',
          `Profiled from the first ${profile.read.toLocaleString('en-US')} of ${profile.of.toLocaleString('en-US')} rows.`
        )
      );
    }
    // What the page reads from this table, and what each is set to.
    const usedBy = new Map(
      one.roles
        .filter((role) => role.kind === 'column' && role.value)
        .map((role) => [role.value, role.label])
    );
    if (one.roles.length) wrap.append(rolesPanel(one));
    const used = usedBy.size > 0 || profile.columns.some((column) => column.used || column.todo);
    const labelled = profile.columns.some((column) => column.label);
    const box = el('div', 'sv-columns');
    box.setAttribute('role', 'table');
    const head = el('div', 'sv-column sv-column-head');
    head.setAttribute('role', 'row');
    for (const said of [
      'Column',
      ...(labelled ? ['Label'] : []),
      ...(used ? ['Used as'] : []),
      'Kind',
      'Filled',
      'Values',
      'Range or commonest',
      'Spread'
    ]) {
      const cell = el('span', null, said);
      cell.setAttribute('role', 'columnheader');
      head.append(cell);
    }
    // One track a column: the name, then what is said of it, then its spread.
    box.style.setProperty(
      '--sv-tracks',
      [
        'minmax(8rem,1.2fr)',
        ...(labelled ? ['minmax(9rem,1.6fr)'] : []),
        ...(used ? ['minmax(8rem,1fr)'] : []),
        'minmax(4.5rem,.7fr)',
        'minmax(3.5rem,.5fr)',
        'minmax(3.5rem,.5fr)',
        'minmax(9rem,1.6fr)',
        'minmax(8rem,1.2fr)'
      ].join(' ')
    );
    box.append(head);
    for (const column of profile.columns) {
      const row = el('div', 'sv-column');
      row.setAttribute('role', 'row');
      row.dataset.column = column.name;
      const cell = (content, className) => {
        const made = el('span', className);
        made.setAttribute('role', 'cell');
        if (content instanceof doc.defaultView.Node) made.append(content);
        else made.textContent = content;
        row.append(made);
        return made;
      };
      const name = el('b', null, column.name);
      const first = cell(name, 'sv-column-name');
      if (column.key) first.append(el('span', 'sv-tag', 'key'));
      else if (column.joins) first.append(el('span', 'sv-tag', `→ ${column.joins.id}`));
      if (labelled) cell(column.label || '', 'sv-soft');
      if (used) {
        if (column.todo) {
          const map = button('sv-button sv-todo', column.todo, () => {
            if (typeof onColumn === 'function') onColumn(one, column);
          });
          map.dataset.todo = column.name;
          cell(map);
        } else if (column.used || usedBy.has(column.name)) {
          cell(el('span', 'sv-used', column.used || usedBy.get(column.name)));
        } else cell('');
      }
      cell(column.type || column.kind);
      cell(`${Math.round(column.filled * 100)}%`);
      cell(column.distinct.toLocaleString('en-US'));
      cell(column.says, 'sv-soft');
      const bars = el('span', 'sv-bars');
      const tallest = Math.max(1, ...column.bars.map((bar) => bar.count));
      for (const bar of column.bars) {
        const press = button('sv-bar', undefined, () => {
          addFilter(one, bar.filter);
          view = 'tables';
          draw();
          told();
        });
        press.style.height = `${Math.max(6, Math.round((bar.count / tallest) * 100))}%`;
        press.title = `${bar.label}: ${count(bar.count, 'row')}`;
        press.setAttribute(
          'aria-label',
          `Show the ${count(bar.count, 'row')} where ${filterSaid(bar.filter)}`
        );
        bars.append(press);
      }
      cell(bars);
      box.append(row);
    }
    wrap.append(box);
    wrap.append(el('p', 'sv-meta', 'Press a bar to see the rows it stands for.'));
    return wrap;
  }

  function participantView() {
    const wrap = el('div', 'sv-body');
    const everyone = participants();
    if (!everyone.length) {
      wrap.append(
        el(
          'p',
          'sv-empty',
          'No table of this study names a participant, so there is no one to follow. A participant is found by a column named USUBJID, SUBJID or the like.'
        )
      );
      return wrap;
    }
    if (!person || !everyone.includes(person)) [person] = everyone;
    const at = everyone.indexOf(person);
    const said = participantOf(study, person);
    const bar = el('div', 'sv-person');
    const step = (by, label, glyph) => {
      const press = button('sv-button sv-step', glyph, () => {
        person = everyone[(at + by + everyone.length) % everyone.length];
        draw();
        told();
      });
      press.setAttribute('aria-label', label);
      return press;
    };
    const pick = el('select', 'sv-input sv-person-pick');
    pick.name = 'participant';
    pick.setAttribute('aria-label', 'Participant');
    // A long list is offered around the one who is open.
    const from = Math.max(0, Math.min(at - 100, everyone.length - 200));
    for (const id of everyone.slice(from, from + 200)) {
      const option = el('option', null, id);
      option.value = id;
      pick.append(option);
    }
    pick.value = person;
    pick.onchange = () => {
      person = pick.value;
      draw();
      told();
    };
    bar.append(
      step(-1, 'Previous participant', '‹'),
      pick,
      step(1, 'Next participant', '›'),
      el(
        'span',
        'sv-meta',
        `${(at + 1).toLocaleString('en-US')} of ${everyone.length.toLocaleString('en-US')} · in ${count(said.tables.length, 'table')}`
      )
    );
    if (participantAction && typeof participantAction.open === 'function') {
      const act = button('sv-button sv-primary', participantAction.label || 'Open', () =>
        participantAction.open(person)
      );
      act.dataset.action = 'participant';
      bar.append(act);
    }
    wrap.append(bar);
    const blocks = el('div', 'sv-blocks');
    for (const { table: one, rows } of said.tables) {
      const block = el('section', 'sv-block');
      block.dataset.block = one.id;
      const head = el('div', 'sv-block-head');
      const open = button('sv-link', one.label, () => {
        tableId = one.id;
        addFilter(one, { column: one.participant, op: 'is', value: person });
        view = 'tables';
        draw();
        told();
      });
      open.title = 'Open these rows in Tables';
      head.append(open, el('span', 'sv-meta', count(rows.length, 'row')));
      block.append(head);
      const columns = one.columns
        .map((column) => column.name)
        .filter((name) => name !== one.participant);
      if (rows.length === 1) {
        // One row reads better down the page: a name and its value.
        const pairs = columns
          .slice(0, BLOCK_ROWS * 2)
          .map((name) => ({ Column: name, Value: rows[0][name] }));
        block.append(grid(['Column', 'Value'], pairs));
        if (columns.length > pairs.length) {
          block.append(
            el('p', 'sv-meta sv-block-more', `${columns.length - pairs.length} more columns`)
          );
        }
      } else {
        block.append(grid(columns.slice(0, BLOCK_COLUMNS), rows.slice(0, BLOCK_ROWS)));
        const more = [
          rows.length > BLOCK_ROWS ? `${rows.length - BLOCK_ROWS} more rows` : '',
          columns.length > BLOCK_COLUMNS ? `${columns.length - BLOCK_COLUMNS} more columns` : ''
        ].filter(Boolean);
        if (more.length) block.append(el('p', 'sv-meta sv-block-more', more.join(' · ')));
      }
      blocks.append(block);
    }
    wrap.append(blocks);
    if (said.without.length) {
      wrap.append(
        el(
          'p',
          'sv-meta',
          `Not shown, because they name no participant: ${said.without.map((one) => one.label).join(', ')}.`
        )
      );
    }
    return wrap;
  }

  function draw() {
    if (destroyed) return;
    const active = doc.activeElement;
    const focused = active && root.contains(active) ? active.getAttribute('name') : null;
    root.textContent = '';
    const shell = el('div', 'sv');
    if (theme) shell.dataset.theme = theme;
    const one = table();
    if (!one) {
      shell.append(el('p', 'sv-empty', 'This study has no tables to look at yet.'));
      root.append(shell);
      return;
    }
    const main = el('div', 'sv-main');
    const own = extra.find((each) => each.id === view);
    if (own) {
      // A view of the page's own: its tab, and whatever it draws.
      const body = el('div', 'sv-body sv-own');
      body.dataset.own = own.id;
      main.append(viewTabs(), body);
      try {
        own.render(body);
      } catch (error) {
        body.append(el('p', 'sv-empty', `This view did not draw. ${error && error.message}`));
      }
    } else {
      main.append(viewTabs());
      if (view !== 'participant') main.append(heading(one));
      main.append(
        view === 'columns'
          ? columnsView(one)
          : view === 'participant'
            ? participantView()
            : tablesView(one)
      );
    }
    shell.append(rail(), main);
    root.append(shell);
    if (focused) {
      const again = root.querySelector(`[name="${focused}"]`);
      if (again) {
        again.focus();
        if (focused === 'find' && again.setSelectionRange) {
          again.setSelectionRange(again.value.length, again.value.length);
        }
      }
    }
  }

  draw();

  return {
    /** Show another study; the filters and the open table of the last are let go. */
    setStudy(next, { keep = false } = {}) {
      study = viewerStudy(next);
      people = null;
      // The same study drawn again, as after a mapping change, keeps the
      // reader where they are; another study starts afresh.
      if (!keep) {
        filters.clear();
        sorts.clear();
        person = null;
        tableId = null;
        shown = PAGE;
        find = '';
        groupsOpen.clear();
        groupsSeen.clear();
        if (extra.length) view = extra[0].id;
      }
      draw();
      if (!keep) told();
    },
    /** Open a table by its id. */
    open(id) {
      const found = study.tables.find((one) => one.id === id);
      if (found) {
        tableId = id;
        groupsOpen.add(found.group);
      }
      shown = PAGE;
      draw();
      told();
    },
    /** Show a view, and, for One participant, a participant. */
    show(next, id = null) {
      if (VIEWS.some((one) => one.id === next)) view = next;
      if (id) person = String(id);
      draw();
      told();
    },
    /** What is on the page. */
    state: () => ({
      view,
      table: table() ? table().id : null,
      participant: person,
      filters: table() ? [...filtersOf(table())] : [],
      tables: study.tables.map((one) => one.id)
    }),
    /** Empty the element. */
    destroy() {
      destroyed = true;
      root.textContent = '';
    }
  };
}
