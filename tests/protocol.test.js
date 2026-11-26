// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROTOCOL_FORMAT,
  daysOf,
  designSaid,
  domainOf,
  endpointLink,
  isUsdm,
  planOf,
  protocolSaid,
  protocolSettings,
  readProtocol,
  readUsdm
} from '../src/engine/protocol.js';
import { LIMITS, readSettings } from '../src/engine/core.js';
import { createBuilder, studyOf } from '../src/engine/build.js';
import { configOf, protocolOfArgs, readDocument, readPresets } from '../src/engine/saved.js';
import { mount } from '../src/app/widget.js';
import { design as drawDesign } from '../src/study/design.js';
import { domOf } from '../src/shared/dom.js';

// A protocol's schedule of activities: read from CDISC's pilot study as a USDM
// study definition, the public example study.builder's reader is held to, and
// carried through the settings to R and onto the page. Real R is held by
// `npm run test:r`.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USDM = readFileSync(path.join(root, 'vendor/cdisc-ddf-ra/CDISC_Pilot_Study.json'), 'utf8');
const pilot = () => readUsdm(USDM);

describe('reading a USDM study definition', () => {
  it('reads the pilot study’s main timeline: sixteen visits on their study days with their windows, in day order', () => {
    const protocol = pilot();
    expect(protocol).toMatchObject({
      format: PROTOCOL_FORMAT,
      phase: 'P2',
      participants: 300,
      arms: ['Placebo', 'Xanomeline Low Dose', 'Xanomeline High Dose'],
      source: { kind: 'usdm', version: '4.0.0' }
    });
    expect(protocol.visits.map((visit) => [visit.name, visit.day])).toEqual([
      ['Screening 1', -14],
      ['Screening 2', -2],
      ['Baseline', 1],
      ['Week 2', 15],
      ['Week 4', 29],
      ['Week 6', 43],
      ['Week 8', 57],
      ['Week 8 Home', 71],
      ['Week 12', 85],
      ['Week 12 Home', 99],
      ['Week 16', 113],
      ['Week 16 Home', 127],
      ['Week 20', 141],
      ['Week 20 Home', 155],
      ['Week 24', 169],
      ['Week 26', 183]
    ]);
    expect(protocol.visits.find((visit) => visit.name === 'Week 12')).toMatchObject({
      epoch: 'Treatment Two',
      before: 4,
      after: 4
    });
    expect(protocolSaid(protocol)).toBe(
      '16 visits from day -14 to day 183, 30 activities, 6 simulated'
    );
  });

  it('says which activities stand for a domain the simulator makes, and what each collects', () => {
    const protocol = pilot();
    const by = Object.fromEntries(protocol.activities.map((activity) => [activity.name, activity]));
    expect(by.Chemistry).toMatchObject({ domain: 'LB' });
    expect(by.Chemistry.collects).toHaveLength(7);
    expect(by.Hematology).toMatchObject({ domain: 'LB', collects: [] });
    expect(by['Informed consent'].domain).toBeNull();
    expect(domainOf('Vital signs')).toBe('VS');
    expect(domainOf('ADAS-Cog')).toBeNull();
    const plan = planOf(protocol);
    expect(plan[0]).toMatchObject({ name: 'Screening 1', day: -14, vs: true });
    expect(plan[0].lb.map((panel) => panel.panel)).toEqual([
      'Hematology',
      'Chemistry',
      'Uninalysis',
      'Hemoglobin A1C'
    ]);
    expect(plan.find((visit) => visit.name === 'Week 8 Home')).toMatchObject({ vs: false, lb: [] });
  });

  it('reads durations, and refuses what is not a study definition in a sentence', () => {
    expect([daysOf('P2W'), daysOf('P3D'), daysOf('PT4H'), daysOf('P1M'), daysOf('soon')]).toEqual([
      14,
      3,
      0,
      30,
      null
    ]);
    expect(isUsdm(JSON.parse(USDM))).toBe(true);
    expect(() => readUsdm('{"study":{"versions":[{}]}}')).toThrow(/no study design/);
    expect(() => readUsdm('nope')).toThrow(/not JSON/);
    expect(() => readProtocol({ visits: [] })).toThrow(/no visits/);
    expect(() => readProtocol({ visits: [{ id: 'a', day: 0 }] })).toThrow(/study day/);
    expect(() =>
      readProtocol({
        visits: [
          { id: 'a', name: 'V', day: 1 },
          { id: 'b', name: 'V', day: 8 }
        ]
      })
    ).toThrow(/Two visits are called V/);
  });

  it('the copied example matches its record', () => {
    const record = JSON.parse(
      readFileSync(path.join(root, 'vendor/cdisc-ddf-ra/SOURCE.json'), 'utf8')
    );
    expect(createHash('sha256').update(USDM).digest('hex')).toBe(record.files[0].sha256);
    expect(record.license).toContain('CC-BY-4.0');
  });
});

describe('a protocol’s design', () => {
  it('keeps what the pilot study says: arms by epochs, objectives with endpoints, the estimand and the population', () => {
    const protocol = pilot();
    const { design } = protocol;
    expect(designSaid(protocol)).toEqual({
      arms: 3,
      epochs: 5,
      objectives: 6,
      endpoints: 11,
      estimands: 1
    });
    expect(design).toMatchObject({ model: 'Parallel Study', blinding: 'Double Blind Study' });
    expect(design.arms.map((arm) => [arm.name, arm.type])).toEqual([
      ['Placebo', 'Placebo Control Arm'],
      ['Xanomeline Low Dose', 'Active Comparator Arm'],
      ['Xanomeline High Dose', 'Active Comparator Arm']
    ]);
    // A cell for every arm in every epoch.
    expect(design.cells).toHaveLength(15);
    expect(
      design.cells
        .filter((cell) => cell.arm === 'Xanomeline High Dose')
        .map((cell) => cell.elements.map((element) => element.name).join())
    ).toEqual(['Screening', 'High - Start', 'High - Middle', 'High - End', 'Follow up']);
    expect(design.objectives.map((objective) => objective.level)).toEqual([
      'Primary Objective',
      'Primary Objective',
      'Secondary Objective',
      'Secondary Objective',
      'Secondary Objective',
      'Secondary Objective'
    ]);
    const [first] = design.objectives[0].endpoints;
    expect(first.text).toContain('ADAS-Cog (11)] at Week 24');
    expect(design.estimands[0]).toMatchObject({
      endpoint: first.id,
      summary: 'Group mean changes from baseline in the primary efficacy parameters',
      events: [{ text: 'Temporary Treatment Interruption' }]
    });
    expect(design.population).toMatchObject({ completes: 300, sex: 'Both' });
    // It is written back whole, and a protocol that says none keeps none.
    expect(readProtocol(JSON.parse(JSON.stringify(protocol))).design).toEqual(design);
    const { design: _dropped, ...bare } = protocol;
    expect(readProtocol(bare).design).toBeUndefined();
  });

  it('says what the schedule and the simulator have for an endpoint, by name', () => {
    const protocol = pilot();
    expect(endpointLink(protocol, 'ADAS-Cog (11) at Week 24')).toEqual({
      activity: 'ADAS-Cog',
      visits: 5,
      simulated: false
    });
    expect(endpointLink(protocol, 'Adverse events')).toMatchObject({ simulated: true });
    expect(endpointLink(protocol, '*** To be determined from protocol ***')).toEqual({
      activity: null,
      visits: 0,
      simulated: false
    });
  });

  it('is drawn as a grid of arms by epochs, then objectives with their endpoints and the estimand under its endpoint', () => {
    const protocol = pilot();
    document.body.innerHTML = '<div id="d"></div>';
    const box = document.querySelector('#d');
    drawDesign(domOf(document), protocol, box);
    expect([...box.querySelectorAll('.sb-tile-value')].map((tile) => tile.textContent)).toEqual([
      '3',
      '300',
      '6',
      '11',
      '1'
    ]);
    expect(box.querySelectorAll('.sb-arms thead th[data-epoch]')).toHaveLength(5);
    expect(box.querySelectorAll('.sb-arms tbody tr')).toHaveLength(3);
    expect(box.querySelectorAll('.sb-element')).toHaveLength(15);
    expect(box.querySelector('.sb-arms th[data-epoch="Screening"] small').textContent).toBe(
      'Day -14 to -2'
    );
    expect(box.querySelectorAll('.sb-objective')).toHaveLength(6);
    expect(box.querySelectorAll('.sb-objective[data-level="primary"]')).toHaveLength(2);
    expect(box.querySelectorAll('.sb-endpoint')).toHaveLength(11);
    // The estimand sits right after the endpoint it is of.
    const estimand = box.querySelector('.sb-estimand-line');
    expect(estimand.previousElementSibling.textContent).toContain('ADAS-Cog (11)] at Week 24');
    expect(estimand.textContent).toContain('Treatment Policy');
    expect(box.querySelectorAll('[data-link="scheduled"]').length).toBeGreaterThan(0);
    expect(box.querySelectorAll('[data-link="simulated"]').length).toBeGreaterThan(0);
  });
});

describe('a protocol in the settings', () => {
  it('fills the settings it says, within the simulator’s limits, and brings the domains its schedule needs', () => {
    const { settings, notes } = protocolSettings(pilot(), LIMITS);
    expect(settings).toMatchObject({ phase: 'P2', participants: 300, months: 7 });
    expect(settings.domains).toEqual(['VISIT', 'VS', 'LB']);
    expect(notes).toEqual([]);
    const big = protocolSettings({ ...pilot(), participants: 9000 }, LIMITS);
    expect(big.settings.participants).toBe(500);
    expect(big.notes[0]).toContain('plans 9000 participants');
  });

  it('goes to R as text with the plan worked out, brings visits, vitals and labs, and is read back from what R was asked', () => {
    const read = readSettings({ domains: ['AE'], protocol: pilot() });
    expect(read.problems).toEqual([]);
    expect(read.args.domains).toEqual(expect.arrayContaining(['AE', 'VISIT', 'VS', 'LB']));
    const sent = JSON.parse(read.args.protocol);
    expect(sent.plan).toHaveLength(16);
    expect(protocolOfArgs(read.args)).toEqual(pilot());
    expect(configOf({ protocol: pilot() }).settings.protocol.visits).toHaveLength(16);
    expect(readSettings({ protocol: { visits: [] } }).problems).toEqual([
      'The protocol has no visits.'
    ]);
    // A study built to a protocol keeps it.
    const study = studyOf(
      {
        study_id: 'X',
        layers: [
          {
            id: 'raw',
            tables: [
              {
                id: 'SUBJ',
                table: 'Raw_SUBJ',
                name: 'Raw_SUBJ.csv',
                rows: 0,
                columns: [],
                text: 'subjid\n',
                made: {}
              }
            ]
          }
        ]
      },
      read.args
    );
    expect(study.protocol.visits).toHaveLength(16);
  });

  it('a protocol file, study.builder’s own or a USDM one, is read as a protocol; a preset may carry one', () => {
    expect(readDocument(USDM)).toMatchObject({ kind: 'protocol' });
    expect(readDocument(JSON.stringify(pilot())).document.visits).toHaveLength(16);
    const listed = JSON.parse(readFileSync(path.join(root, 'presets/index.json'), 'utf8'));
    const preset = readPresets(listed).find((one) => one.id === 'cdisc-pilot-protocol');
    expect(preset.settings.protocol.visits).toHaveLength(16);
    expect(preset.study).toBe('cdisc-pilot-protocol.study.json.gz');
  });
});

describe('a protocol in the loader', () => {
  let handle = null;
  afterEach(() => {
    if (handle) handle.destroy();
    handle = null;
    document.body.innerHTML = '';
  });
  const q = (selector) => document.querySelector(selector);

  function mounted(options = {}) {
    document.body.innerHTML = '<div id="b"></div>';
    const runs = [];
    const saved = [];
    handle = mount('#b', {
      presets: false,
      shelf: false,
      save: (name, bytes) => saved.push({ name, bytes }),
      createBuilder: (given) =>
        createBuilder({
          ...given,
          createConnection: () => ({
            run: async (name, request) => {
              runs.push(request.args);
              return { status: 'error', message: 'not built in this test' };
            }
          })
        }),
      ...options
    });
    return { runs, saved };
  }

  it('offers to open a protocol; opening one fills the form and shows its schedule as a grid of visits and activities', async () => {
    mounted();
    expect(q('.sb-protocol-ask').textContent).toContain('CDISC USDM study definition');
    await handle.open(USDM);
    expect(handle.state()).toMatchObject({ screen: 'describe' });
    expect(handle.state().said).toContain('16 visits from day -14 to day 183');
    expect(q('[name="participants"]').value).toBe('300');
    expect(q('[data-phase="P2"]').getAttribute('aria-pressed')).toBe('true');
    expect(q('[data-domain="VS"]').getAttribute('aria-pressed')).toBe('true');
    expect(
      [...document.querySelectorAll('.sb h3')].map((heading) => heading.textContent)
    ).toContain('Schedule of activities: 16 visits, from the protocol');
    expect(document.querySelectorAll('.sb-grid thead th[data-visit]')).toHaveLength(16);
    // The activities that simulate something come first, each saying what it stands for.
    const first = q('.sb-grid tbody tr');
    expect(first.querySelector('.sb-pill').textContent).not.toBe('Not simulated');
    expect(q('.sb-grid tr[data-simulated="false"] .sb-pill').textContent).toBe('Not simulated');
  });

  it('offers a ready-made protocol to try, fetched from the page; one that cannot be fetched is said', async () => {
    const fetched = vi.fn(async () => ({ ok: true, json: async () => pilot() }));
    vi.stubGlobal('fetch', fetched);
    mounted({ protocols: [{ label: 'pilot protocol', url: './p.json' }] });
    const tryIt = q('[data-action="try-protocol"]');
    expect(tryIt.textContent).toBe('Try the pilot protocol');
    tryIt.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetched).toHaveBeenCalledWith('./p.json');
    expect(handle.settings().protocol.visits).toHaveLength(16);
    q('[data-action="remove-protocol"]').click();
    vi.stubGlobal('fetch', async () => ({ ok: false }));
    q('[data-action="try-protocol"]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handle.state().said).toBe('The pilot protocol could not be fetched from this page.');
    vi.unstubAllGlobals();
    mounted({ protocols: false });
    expect(q('[data-action="try-protocol"]')).toBeNull();
  });

  it('a visit’s day is changed, a visit removed and added, and an activity ticked off; Build sends R the plan as changed', async () => {
    const { runs, saved } = mounted();
    await handle.open(USDM);
    const week2 = handle.settings().protocol.visits.find((visit) => visit.name === 'Week 2');
    const day = q(`[name="day-${week2.id}"]`);
    day.value = '16';
    day.onchange();
    const home = handle.settings().protocol.visits.find((visit) => visit.name === 'Week 8 Home');
    q(`[data-remove="${home.id}"]`).click();
    q('[data-action="add-visit"]').click();
    const chemistry = handle
      .settings()
      .protocol.activities.find((activity) => activity.name === 'Chemistry');
    const box = q(`tr[data-activity="${chemistry.id}"] td input`);
    expect(box.checked).toBe(true);
    box.checked = false;
    box.onchange();
    const edited = handle.settings().protocol;
    expect(edited.visits).toHaveLength(16);
    expect(edited.visits.at(-1)).toMatchObject({ name: 'Visit 16', day: 190 });
    expect(edited.source.edited).toBe(true);
    await handle.build();
    const plan = JSON.parse(runs[0].protocol).plan;
    expect(plan.find((visit) => visit.name === 'Week 2').day).toBe(16);
    expect(plan.some((visit) => visit.name === 'Week 8 Home')).toBe(false);
    expect(plan[0].lb.map((panel) => panel.panel)).not.toContain('Chemistry');
    // A day that cannot be is said, and the protocol stays as it was.
    const again = q(`[name="day-${week2.id}"]`);
    again.value = '0';
    again.onchange();
    expect(q('.sb-problems').textContent).toContain('needs a study day');
    q('[data-action="download-protocol"]').click();
    expect(JSON.parse(saved[0].bytes).format).toBe(PROTOCOL_FORMAT);
    q('[data-action="remove-protocol"]').click();
    expect(handle.settings().protocol).toBeNull();
    expect(q('.sb-grid')).toBeNull();
  });
});
