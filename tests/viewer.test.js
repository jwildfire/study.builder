// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  csvOf,
  filterRows,
  filterSaid,
  groupsOf,
  kindOf,
  participantOf,
  participantsOf,
  profileOf,
  rowsOf,
  sortRows,
  viewerStudy
} from '../src/viewer/core.js';
import { mountViewer } from '../src/viewer/widget.js';
import { fromBuilt } from '../src/viewer/built.js';

// study.viewer with no study.builder: a study is a name and tables, each CSV
// text or records. The two tables here are a reader's own files.

const DM = 'SUBJID,ARM,AGE\nS1,Placebo,40\nS2,Active,51\nS3,Active,63\n';
const AE =
  'SUBJID,TERM,SERIOUS,DAY\nS1,Headache,N,3\nS1,"Nausea, mild",N,10\nS2,Rash,Y,7\nS3,Headache,N,\n';
const STUDY = {
  name: 'My files',
  tables: [
    { id: 'dm.csv', text: DM },
    {
      id: 'ae.csv',
      text: AE,
      note: '1 column to map',
      columns: [
        { name: 'SUBJID' },
        { name: 'TERM', used: 'Term' },
        { name: 'SERIOUS', todo: 'Map: serious?' },
        { name: 'DAY' }
      ]
    },
    { id: 'sites', label: 'Sites', records: [{ SITE: 'A', COUNTRY: 'US' }] }
  ]
};

describe('a study, with no page', () => {
  const study = viewerStudy(STUDY);
  const [dm, ae, sites] = study.tables;

  it('names every table’s columns, counts its rows and finds the column that names the participant', () => {
    expect(dm.columns.map((column) => column.name)).toEqual(['SUBJID', 'ARM', 'AGE']);
    expect([dm.rows, ae.rows, sites.rows]).toEqual([3, 4, 1]);
    expect([dm.participant, ae.participant, sites.participant]).toEqual(['SUBJID', 'SUBJID', null]);
    expect(rowsOf(ae)[1]).toEqual({ SUBJID: 'S1', TERM: 'Nausea, mild', SERIOUS: 'N', DAY: '10' });
    expect(rowsOf(ae)).toBe(rowsOf(ae));
    expect(groupsOf(study)).toHaveLength(1);
    expect(viewerStudy({ tables: [{ id: 'x' }] }).tables).toEqual([]);
  });

  it('filters and sorts rows, and says a filter in words', () => {
    const rows = rowsOf(ae);
    expect(filterRows(rows, [{ column: 'SERIOUS', op: 'is', value: 'Y' }])).toHaveLength(1);
    expect(filterRows(rows, [{ column: 'TERM', op: 'contains', value: 'head' }])).toHaveLength(2);
    expect(
      filterRows(rows, [{ column: 'DAY', op: 'min', value: '7' }]).map((row) => row.DAY)
    ).toEqual(['10', '7']);
    expect(filterRows(rows, [{ column: 'DAY', op: 'between', value: '1', to: '7' }])).toHaveLength(
      2
    );
    expect(filterRows(rows, [])).toBe(rows);
    expect(sortRows(rows, { column: 'DAY' }).map((row) => row.DAY)).toEqual(['3', '7', '10', '']);
    expect(sortRows(rows, { column: 'DAY', down: true }).map((row) => row.DAY)).toEqual([
      '10',
      '7',
      '3',
      ''
    ]);
    expect(filterSaid({ column: 'SERIOUS', op: 'is', value: 'Y' })).toBe('SERIOUS is Y');
    expect(filterSaid({ column: 'DAY', op: 'between', value: '1', to: '7' })).toBe(
      'DAY from 1 to 7'
    );
    expect(kindOf(['1', '2.5', ''])).toBe('number');
    expect(kindOf(['2014-01-02'])).toBe('date');
    expect(kindOf([])).toBe('empty');
  });

  it('profiles every column: its kind, how full it is, its values, and a bar for each that filters to it', () => {
    const profile = profileOf(ae);
    const by = Object.fromEntries(profile.columns.map((column) => [column.name, column]));
    expect(profile).toMatchObject({ read: 4, of: 4 });
    expect(by.DAY).toMatchObject({ kind: 'number', filled: 0.75, distinct: 3, says: '3 to 10' });
    expect(by.SERIOUS.bars).toEqual([
      { label: 'N', count: 3, filter: { column: 'SERIOUS', op: 'is', value: 'N' } },
      { label: 'Y', count: 1, filter: { column: 'SERIOUS', op: 'is', value: 'Y' } }
    ]);
    expect(by.TERM.says).toBe('Headache, Nausea, mild, Rash');
    expect(by.SERIOUS.todo).toBe('Map: serious?');
    // A number with many values is spread over ten bars, each a range.
    const long = viewerStudy({
      tables: [
        { id: 'n', records: Array.from({ length: 50 }, (_, index) => ({ X: String(index) })) }
      ]
    }).tables[0];
    const [x] = profileOf(long).columns;
    expect(x.bars).toHaveLength(10);
    expect(x.bars[0].filter).toEqual({ column: 'X', op: 'between', value: '0', to: '4.9' });
    expect(x.bars.reduce((sum, bar) => sum + bar.count, 0)).toBe(50);
  });

  it('follows one participant across every table that names them', () => {
    expect(participantsOf(study)).toEqual(['S1', 'S2', 'S3']);
    // A column that is only called an id names no participant.
    expect(
      viewerStudy({ tables: [{ id: 'm', records: [{ ID: 'kri0001' }] }] }).tables[0].participant
    ).toBeNull();
    const said = participantOf(study, 'S1');
    expect(said.tables.map(({ table, rows }) => [table.id, rows.length])).toEqual([
      ['dm.csv', 1],
      ['ae.csv', 2]
    ]);
    expect(said.without.map((table) => table.id)).toEqual(['sites']);
    expect(csvOf(['A', 'B'], [{ A: 'x,y', B: 'say "hi"' }])).toBe('A,B\n"x,y","say ""hi"""\n');
  });
});

describe('the viewer on a page', () => {
  let handle = null;
  afterEach(() => {
    if (handle) handle.destroy();
    handle = null;
    document.body.innerHTML = '';
  });
  const mounted = (options = {}) => {
    document.body.innerHTML = '<div id="v"></div>';
    handle = mountViewer('#v', { study: STUDY, ...options });
    return handle;
  };
  const press = (selector) => document.querySelector(selector).click();
  const cells = () =>
    [...document.querySelectorAll('.sv-grid tbody tr')].map((row) => row.textContent);

  it('opens on the first table’s rows, with the tables in a rail and three views', () => {
    mounted();
    expect([...document.querySelectorAll('.sv-pick')].map((pick) => pick.textContent)).toEqual([
      'dm.csv3',
      'ae.csv4',
      'Sites1'
    ]);
    expect([...document.querySelectorAll('.sv-view')].map((tab) => tab.textContent)).toEqual([
      'Tables',
      'Columns',
      'One participant'
    ]);
    expect(document.querySelector('.sv-title').textContent).toBe('dm.csv');
    expect(cells()).toEqual(['S1Placebo40', 'S2Active51', 'S3Active63']);
    expect(document.querySelector('[data-action="download"]')).toBeNull();
  });

  it('adds a filter from the form, counts what matches, sorts by a header and removes the filter', () => {
    const save = vi.fn();
    mounted({ save, table: 'ae.csv' });
    expect(document.querySelector('[data-note]').textContent).toBe('1 column to map');
    press('[data-action="add-filter"]');
    document.querySelector('[name="filter-column"]').value = 'SERIOUS';
    document.querySelector('[name="filter-value"]').value = 'N';
    document.querySelector('.sv-add').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(document.querySelector('.sv-count').textContent).toBe('3 of 4 rows');
    [...document.querySelectorAll('.sv-sort')].find((sort) => sort.textContent === 'DAY').click();
    expect(cells()[0]).toBe('S1HeadacheN3');
    [...document.querySelectorAll('.sv-sort')]
      .find((sort) => sort.textContent.startsWith('DAY'))
      .click();
    expect(cells()[0]).toBe('S1Nausea, mildN10');
    press('.sv-chip');
    expect(handle.state().filters).toEqual([]);
    press('[data-action="download"]');
    expect(save).toHaveBeenCalledWith('ae.csv.csv', AE, 'text/csv');
  });

  it('profiles the columns, offers a column’s mapping to the page, and a bar filters the rows', () => {
    const onColumn = vi.fn();
    mounted({ table: 'ae.csv', view: 'columns', onColumn });
    expect(
      [...document.querySelectorAll('.sv-column-head span')].map((cell) => cell.textContent)
    ).toEqual(['Column', 'Used as', 'Kind', 'Filled', 'Values', 'Range or commonest', 'Spread']);
    expect(document.querySelector('[data-column="TERM"] .sv-used').textContent).toBe('Term');
    press('[data-todo="SERIOUS"]');
    expect(onColumn.mock.calls[0][1].name).toBe('SERIOUS');
    const bars = document.querySelectorAll('[data-column="SERIOUS"] .sv-bar');
    expect(bars).toHaveLength(2);
    bars[1].click();
    expect(handle.state()).toMatchObject({
      view: 'tables',
      filters: [{ column: 'SERIOUS', op: 'is', value: 'Y' }]
    });
    expect(cells()).toEqual(['S2RashY7']);
  });

  it('follows a participant from their id in a row, steps to the next, and opens their rows in a table', () => {
    const open = vi.fn();
    const onChange = vi.fn();
    mounted({ participantAction: { label: 'Open the profile', open }, onChange });
    press('[data-participant="S2"]');
    expect(handle.state()).toMatchObject({ view: 'participant', participant: 'S2' });
    expect(
      [...document.querySelectorAll('[data-block]')].map((block) => block.dataset.block)
    ).toEqual(['dm.csv', 'ae.csv']);
    expect(document.querySelector('.sv-person .sv-meta').textContent).toBe('2 of 3 · in 2 tables');
    press('[data-action="participant"]');
    expect(open).toHaveBeenCalledWith('S2');
    press('[aria-label="Next participant"]');
    expect(handle.state().participant).toBe('S3');
    expect(onChange).toHaveBeenLastCalledWith({
      view: 'participant',
      table: 'dm.csv',
      participant: 'S3'
    });
    document.querySelector('[data-block="ae.csv"] .sv-link').click();
    expect(handle.state()).toMatchObject({
      view: 'tables',
      table: 'ae.csv',
      filters: [{ column: 'SUBJID', op: 'is', value: 'S3' }]
    });
  });

  it('says so when no table names a participant, and when a study has no tables', () => {
    mounted({
      study: { tables: [{ id: 'sites', records: [{ SITE: 'A' }] }] },
      view: 'participant'
    });
    expect(document.querySelector('.sv-empty').textContent).toContain('names a participant');
    handle.setStudy({ tables: [] });
    expect(document.querySelector('.sv-empty').textContent).toBe(
      'This study has no tables to look at yet.'
    );
  });
});

describe('a study study.builder built, for the viewer', () => {
  it('lists its tables by layer, with what made each and what its metadata says of each column', () => {
    const built = {
      id: 'BUILT-001',
      said: 'A simulated study.',
      snapshotDate: '2012-09-30',
      args: { phase: 'P2', therapeutic_area: 'Oncology', participants: 2, sites: 1, months: 3 },
      layers: [
        {
          id: 'raw',
          label: 'Raw',
          tables: [
            {
              id: 'SUBJ',
              label: 'Participants',
              name: 'Raw_SUBJ.csv',
              rows: 1,
              text: 'subjid\nS1\n',
              grain: 'One row per participant',
              columns: [{ name: 'subjid', type: 'character' }],
              made: { workflow: 'gsm.datasim', from: [] }
            }
          ]
        },
        {
          id: 'adam',
          label: 'ADaM',
          tables: [
            {
              id: 'ADSL',
              label: 'ADSL',
              name: 'adsl.csv',
              rows: 1,
              text: 'USUBJID\nS1\n',
              columns: [{ name: 'USUBJID', type: 'character' }],
              made: { workflow: 'ADSL', from: ['Raw_SUBJ'] }
            }
          ]
        }
      ],
      spec: (layer, id) =>
        id === 'ADSL'
          ? { columns: [{ name: 'USUBJID', label: 'Participant id', key: true }] }
          : null
    };
    const study = viewerStudy(fromBuilt(built));
    expect(study.tables.map((table) => [table.id, table.group, table.made])).toEqual([
      ['raw:SUBJ', 'Raw', 'simulated by gsm.datasim'],
      ['adam:ADSL', 'ADaM', 'built from Raw_SUBJ by the ADSL workflow']
    ]);
    expect(study.tables[1].columns[0]).toMatchObject({
      label: 'Participant id',
      key: true,
      type: 'character'
    });
    expect(study.facts.map((fact) => fact.label)).toContain('Therapeutic area');
    expect(viewerStudy(fromBuilt(built, { layers: ['adam'] })).tables).toHaveLength(1);
  });
});
