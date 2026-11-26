// @vitest-environment jsdom
// The study view's sections: the viewer's two rows of tabs, and the views
// that read the site metrics and the adverse event summaries.

import { afterEach, describe, expect, it } from 'vitest';
import { mountViewer } from '../src/viewer/widget.js';
import { domOf } from '../src/shared/dom.js';
import { adverse, eventsByArm } from '../src/study/adverse.js';
import { pooledEvents, rbqm, safety, siteResults } from '../src/study/operations.js';
import { protocolView } from '../src/study/protocol.js';

const csv = (header, rows) =>
  [header, ...rows].map((row) => row.map((value) => `"${value}"`).join(',')).join('\n') + '\n';
const studyOf = (tables) => ({
  snapshotDate: '2012-07-31',
  table: (layer, id) => {
    const text = tables[`${layer}:${id}`];
    return text ? { text, rows: text.trim().split('\n').length - 1 } : null;
  }
});
const STUDY = studyOf({
  'reporting:Metrics': csv(
    ['ID', 'Abbreviation', 'Metric', 'Numerator', 'Denominator', 'MetricID'],
    [
      [
        'kri0001',
        'AE',
        'Adverse Event Rate',
        'Adverse Events',
        'Days on Study',
        'Analysis_kri0001'
      ],
      [
        'kri0002',
        'SAE',
        'Serious Adverse Event Rate',
        'Serious Adverse Events',
        'Days on Study',
        'Analysis_kri0002'
      ],
      ['kri0009', 'XX', 'Not run', 'A', 'B', 'Analysis_kri0009']
    ]
  ),
  'reporting:Results': csv(
    ['GroupID', 'GroupLevel', 'Numerator', 'Denominator', 'Metric', 'Score', 'Flag', 'MetricID'],
    [
      ['SITE1', 'Site', 24, 962, 0.02, -1.04, 0, 'Analysis_kri0001'],
      ['SITE2', 'Site', 54, 700, 0.07, 2.6, 2, 'Analysis_kri0001'],
      ['SITE1', 'Site', 2, 962, 0.002, 1.2, 1, 'Analysis_kri0002'],
      ['SITE2', 'Site', 1, 3, 0.33, '', '', 'Analysis_kri0002'],
      ['US', 'Country', 1, 3, 0.33, 0, 0, 'Analysis_kri0001']
    ]
  ),
  'analysis:AESummary': csv(
    ['AEBODSYS', 'AEDECOD', 'EVENTS', 'SERIOUS', 'PARTICIPANTS', 'BIGN', 'PERCENT'],
    [
      ['Cardiac disorders', 'Palpitations', 1, 0, 1, 81, 1.2],
      ['Gastrointestinal disorders', 'Nausea', 12, 1, 9, 81, 11.1],
      ['Gastrointestinal disorders', 'Abdominal pain', 4, 1, 3, 81, 3.7]
    ]
  ),
  'analysis:AESummaryByArm': csv(
    ['ARM', 'AEBODSYS', 'AEDECOD', 'EVENTS', 'SERIOUS', 'PARTICIPANTS', 'BIGN', 'PERCENT'],
    [
      ['Active', 'Gastrointestinal disorders', 'Nausea', 9, 1, 7, 40, 17.5],
      ['Placebo', 'Gastrointestinal disorders', 'Nausea', 3, 0, 2, 41, 4.9],
      ['Placebo', 'Cardiac disorders', 'Palpitations', 1, 0, 1, 41, 2.4]
    ]
  )
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the viewer’s sections', () => {
  const views = ['overview', 'protocol', 'pipeline'].map((id) => ({
    id,
    label: id[0].toUpperCase() + id.slice(1),
    render: (box) => box.append(id)
  }));
  const tabs = (selector) => [...document.querySelectorAll(selector)].map((tab) => tab.textContent);

  it('draws a row of sections and, under it, the open section’s views when it has more than one; a view no section names stands alone', () => {
    document.body.innerHTML = '<div id="v"></div>';
    const handle = mountViewer('#v', {
      study: { name: 'S', tables: [{ id: 'dm', records: [{ USUBJID: 'S1' }] }] },
      views,
      sections: [
        { id: 'overview', label: 'Overview', views: ['overview'] },
        { id: 'design', label: 'Design', views: ['protocol', 'schedule'] },
        { id: 'data', label: 'Data', views: ['pipeline', 'tables', 'columns'] },
        { id: 'gone', label: 'Gone', views: ['nothing'] }
      ]
    });
    expect(tabs('[data-section]')).toEqual(['Overview', 'Design', 'Data', 'One participant']);
    // Overview and Design hold one view each: no second row.
    expect(document.querySelector('.sv-subviews')).toBeNull();
    document.querySelector('[data-section="data"]').click();
    expect(tabs('.sv-subviews .sv-view')).toEqual(['Pipeline', 'Tables', 'Columns']);
    expect(handle.state()).toMatchObject({ view: 'pipeline', section: 'data' });
    document.querySelector('[data-view="columns"]').click();
    document.querySelector('[data-section="overview"]').click();
    // A section opens again on the view last looked at in it.
    document.querySelector('[data-section="data"]').click();
    expect(handle.state().view).toBe('columns');
    handle.show('protocol');
    expect(handle.state().section).toBe('design');
    handle.destroy();
  });

  it('is one row of every view when the page asks for no sections', () => {
    document.body.innerHTML = '<div id="v"></div>';
    const handle = mountViewer('#v', {
      study: { name: 'S', tables: [{ id: 'dm', records: [{ USUBJID: 'S1' }] }] },
      views
    });
    expect(document.querySelector('[data-section]')).toBeNull();
    expect(tabs('.sv-view')).toHaveLength(6);
    handle.destroy();
  });
});

describe('the Operations and Reporting views', () => {
  const dom = () => domOf(document);
  const boxed = () => {
    const box = document.createElement('div');
    document.body.append(box);
    return box;
  };

  it('reads the site metrics: the metrics with a result, the sites with the most flags first, and no group that is not a site', () => {
    const said = siteResults(STUDY);
    expect(said.metrics.map((metric) => metric.short)).toEqual(['AE', 'SAE']);
    expect(said.sites).toEqual(['SITE2', 'SITE1']);
    expect(said.result('SITE2', 'Analysis_kri0001')).toMatchObject({ flag: 2, score: 2.6 });
    expect(said.result('SITE2', 'Analysis_kri0002').flag).toBeNull();
    expect(siteResults(studyOf({}))).toBeNull();
  });

  it('draws sites by metrics, a cell a flag, and opens the Results table when asked', () => {
    const box = boxed();
    const opened = [];
    rbqm(dom(), STUDY, box, { open: (id) => opened.push(id) });
    expect([...box.querySelectorAll('.sb-tile-value')].map((tile) => tile.textContent)).toEqual([
      '2',
      '2',
      '1',
      '1'
    ]);
    const flags = [...box.querySelectorAll('tbody .sb-flag')].map((flag) => flag.dataset.flag);
    expect(flags).toEqual(['red', 'none', 'green', 'amber']);
    expect(box.querySelector('tbody .sb-flag').textContent).toBe('+2.6');
    box.querySelector('[data-action="open-results"]').click();
    expect(opened).toEqual(['reporting:Results']);
  });

  it('pools the adverse events with no arm named: totals, the commonest terms, and the body systems', () => {
    const said = pooledEvents(STUDY);
    expect(said.people).toBe(81);
    expect(said.terms.map((one) => one.term)).toEqual(['Nausea', 'Abdominal pain', 'Palpitations']);
    expect(said.systems[0]).toMatchObject({
      system: 'Gastrointestinal disorders',
      events: 16,
      serious: 2
    });
    const box = boxed();
    safety(dom(), STUDY, box);
    expect([...box.querySelectorAll('.sb-tile-value')].map((tile) => tile.textContent)).toEqual([
      '81',
      '17',
      '2',
      '3'
    ]);
    expect(box.querySelector('.sb-bar-value').textContent).toBe('9 (11.1%)');
    expect(box.textContent).not.toContain('Placebo');
  });

  it('sets the adverse events out by arm, the reference arm first and the commonest term first', () => {
    expect(eventsByArm(STUDY).arms).toEqual([
      { name: 'Active', people: 40 },
      { name: 'Placebo', people: 41 }
    ]);
    const box = boxed();
    adverse(dom(), STUDY, box, 'Placebo');
    expect([...box.querySelectorAll('th')].map((th) => th.textContent)).toEqual([
      'Body system',
      'Term',
      'Placebo (N=41)',
      'Active (N=40)'
    ]);
    const first = [...box.querySelector('tbody tr').children].map((cell) => cell.textContent);
    expect(first).toEqual(['Gastrointestinal disorders', 'Nausea', '2 (4.9%)', '7 (17.5%)']);
    expect(box.querySelectorAll('tbody tr')[1].lastChild.textContent).toBe('0');
  });

  it('shows a protocol in full: what it is, where it was read from, its activities and what was left out', () => {
    const box = boxed();
    protocolView(
      dom(),
      {
        name: 'CDISC PILOT',
        title: 'LZZT',
        phase: 'P2',
        indication: 'Alzheimer’s disease',
        participants: 300,
        arms: ['Placebo', 'High'],
        epochs: ['Screening', 'Treatment'],
        source: { kind: 'usdm', version: '4.0.0', file: 'pilot.json', license: 'CC-BY-4.0' },
        visits: [{ id: 'v1', name: 'Baseline', epoch: 'Treatment', day: 1 }],
        activities: [
          { id: 'a1', name: 'Informed consent', domain: null },
          { id: 'a2', name: 'Vital signs', domain: 'VS' }
        ],
        schedule: { v1: ['a1', 'a2'] },
        notes: ['2 other timelines are not simulated.']
      },
      box
    );
    const facts = box.querySelector('.sb-protocol-facts').textContent;
    expect(facts).toContain('Phase 2');
    expect(facts).toContain('pilot.json · USDM 4.0.0');
    expect([...box.querySelectorAll('.sb-activity')].map((line) => line.textContent)).toEqual([
      'VSVital signs',
      'Not simulatedInformed consent'
    ]);
    expect(box.querySelector('[data-notes="protocol"]').textContent).toContain('2 other timelines');
  });
});
