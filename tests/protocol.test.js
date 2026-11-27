// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROTOCOL_FORMAT,
  READY_PROTOCOLS,
  daysOf,
  designSaid,
  domainOf,
  efficacyOf,
  endpointLink,
  isUsdm,
  planOf,
  protocolSaid,
  protocolSettings,
  readProtocol,
  readUsdm
} from '../src/engine/protocol.js';
import { LIMITS, readAssumptions, readEfficacy, readSettings } from '../src/engine/core.js';
import { efficacy as drawEfficacy, efficacyResults } from '../src/study/efficacy.js';
import { settingsOfArgs } from '../src/engine/saved.js';
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
    expect(record.license).toBe('CC-BY-4.0');
    expect(record.attribution).toContain('Content based on DDF-RA (GitHub)');
  });

  it('every protocol made from CDISC’s files carries the attribution, the commit and what was changed', () => {
    const record = JSON.parse(
      readFileSync(path.join(root, 'vendor/cdisc-ddf-ra/SOURCE.json'), 'utf8')
    );
    const listed = JSON.parse(readFileSync(path.join(root, 'protocols/index.json'), 'utf8'));
    expect(listed).toHaveLength(5);
    for (const entry of listed) {
      expect(entry.attribution).toBe(record.attribution);
      const { source } = JSON.parse(readFileSync(path.join(root, 'protocols', entry.file), 'utf8'));
      expect(source.attribution).toBe(record.attribution);
      expect(source.license).toBe('CC-BY-4.0');
      expect(source.license_url).toBe('https://creativecommons.org/licenses/by/4.0/');
      expect(source.commit).toBe(record.commit);
      expect(source.changes).toContain('Changed from CDISC’s file');
    }
  });
});

describe('every example protocol CDISC publishes', () => {
  const example = (file) =>
    JSON.parse(readFileSync(path.join(root, 'vendor/cdisc-ddf-ra', file), 'utf8'));
  const record = JSON.parse(
    readFileSync(path.join(root, 'vendor/cdisc-ddf-ra/SOURCE.json'), 'utf8')
  );

  it('is copied whole with its record, and comes ready-made as the reader makes it', () => {
    expect(record.files.map((entry) => entry.file).sort()).toEqual([
      'Alexion_NCT04573309_Wilsons.json',
      'CDISC_Pilot_Study.json',
      'EliLilly_NCT03421379_Diabetes.json',
      'devices.json',
      'observational.json'
    ]);
    for (const entry of record.files) {
      const bytes = readFileSync(path.join(root, 'vendor/cdisc-ddf-ra', entry.file));
      expect(createHash('sha256').update(bytes).digest('hex'), entry.file).toBe(entry.sha256);
    }
    const list = JSON.parse(readFileSync(path.join(root, 'protocols/index.json'), 'utf8'));
    expect(list.map((one) => one.id)).toEqual(READY_PROTOCOLS.map((ready) => ready.id));
    for (const ready of READY_PROTOCOLS) {
      const made = JSON.parse(
        readFileSync(path.join(root, `protocols/${ready.id}.protocol.json`), 'utf8')
      );
      expect(readDocument(made).kind, ready.id).toBe('protocol');
    }
  });

  it('reads, and would build: its visits in day order, its arms, its design counted as the file has it', () => {
    const came = Object.fromEntries(
      record.files.map(({ file }) => {
        const usdm = example(file);
        const protocol = readUsdm(usdm);
        const read = readSettings({ ...protocolSettings(protocol, LIMITS).settings, protocol });
        expect(read.problems, file).toEqual([]);
        const design = usdm.study.versions[0].studyDesigns[0];
        expect(designSaid(protocol), file).toEqual({
          arms: design.arms.length,
          epochs: design.epochs.length,
          objectives: design.objectives.length,
          endpoints: design.objectives.reduce((sum, one) => sum + one.endpoints.length, 0),
          estimands: (design.estimands || []).length
        });
        expect(protocol.design.cells, file).toHaveLength(design.studyCells.length);
        const days = protocol.visits.map((visit) => visit.day);
        expect(
          [...days].sort((a, b) => a - b),
          file
        ).toEqual(days);
        return [
          file,
          [
            protocol.visits.length,
            days[0],
            days.at(-1),
            protocol.arms.length,
            protocol.participants
          ]
        ];
      })
    );
    expect(came).toEqual({
      'CDISC_Pilot_Study.json': [16, -14, 183, 3, 300],
      'devices.json': [16, -14, 183, 3, 300],
      // A single arm, a visit a day for 40 days, and a decision point.
      'Alexion_NCT04573309_Wilsons.json': [51, -42, 54, 1, 10],
      // A crossover: two sequences as arms, and several visits on one day.
      'EliLilly_NCT03421379_Diabetes.json': [15, -29, 34, 2, 75],
      'observational.json': [6, -2, 43, 2, 120]
    });
  });

  it('says what it left out of a file: other timelines, decision points, visits that share a day, activities timed within a visit', () => {
    const alexion = readUsdm(example('Alexion_NCT04573309_Wilsons.json'));
    expect(alexion.notes).toEqual([
      '4 other timelines in the file are not simulated (Adverse Event Timeline, Early Termination Timeline, PKPD Timeline, Unscheduled Timeline): the times within a visit, and what happens off the schedule.',
      'The schedule has 1 decision point; every visit is read as if each participant has it, whichever way a decision goes.',
      '1 study day has more than one visit; they are kept apart by name, and simulated on the same day.',
      '1 activity has a timeline of its own within a visit (sampling at set hours, say); it is simulated once a visit.'
    ]);
    // The notes are kept when the protocol is read back, and go to R with it.
    expect(readProtocol(JSON.parse(JSON.stringify(alexion))).notes).toEqual(alexion.notes);
    // Visits a file times in minutes are apart by name on one study day.
    const lilly = readUsdm(example('EliLilly_NCT03421379_Diabetes.json'));
    expect(lilly.visits.filter((visit) => visit.day === 1).map((visit) => visit.name)).toEqual([
      'Radomisation',
      'Pre infusion',
      'Infusion',
      'Day 1',
      'Discharge'
    ]);
    expect(new Set(lilly.visits.map((visit) => visit.name)).size).toBe(lilly.visits.length);
  });

  it('lists what an activity collects from the file’s surrogates too, where it has no concept for a test', () => {
    const lilly = readUsdm(example('EliLilly_NCT03421379_Diabetes.json'));
    const labs = lilly.activities.find((activity) => activity.name === 'Clinical Lab Tests');
    expect(labs.domain).toBe('LB');
    expect(labs.collects).toContain('Erythrocyte count (RBC)');
    expect(labs.collects.length).toBeGreaterThan(30);
    const serology = lilly.activities.find(
      (activity) => activity.name === 'Clinical Serology Tests'
    );
    expect(serology.collects).toEqual(
      expect.arrayContaining(['Hepatitis B surface antigen', 'HIV'])
    );
  });

  it('ties an endpoint to a domain only when it names it outright, and takes only an estimand’s or a primary endpoint as the score', () => {
    const alexion = readUsdm(example('Alexion_NCT04573309_Wilsons.json'));
    // A copper balance and a PK parameter are not the labs, though they speak of plasma and urine.
    expect(
      endpointLink(alexion, 'PK parameters for plasma total and PUF-molybdenum at steady state')
    ).toEqual({ activity: null, visits: 0, simulated: false });
    expect(endpointLink(alexion, 'Copper quantified in food, drink, feces, and urine')).toEqual({
      activity: null,
      visits: 0,
      simulated: false
    });
    // Adverse events are simulated, by the activity that collects them or, with none, throughout.
    expect(endpointLink(alexion, 'Treatment emergent adverse events (TEAEs)')).toMatchObject({
      activity: 'Adverse events',
      simulated: true
    });
    expect(endpointLink(alexion, 'SAEs and TEAEs')).toEqual({
      activity: null,
      visits: 0,
      simulated: true
    });
    // One arm: no arm to differ from, so no score.
    expect(efficacyOf(alexion)).toBeNull();
    // An exploratory antibody endpoint is not the trial's efficacy score.
    expect(efficacyOf(readUsdm(example('EliLilly_NCT03421379_Diabetes.json')))).toBeNull();
    // With no estimand, a primary endpoint that is scheduled is taken.
    expect(efficacyOf(readUsdm(example('devices.json')))).toMatchObject({ name: 'ADAS-Cog' });
  });

  it('refuses an earlier version of the model in a sentence, reads a later one with a note, takes a range’s upper end, and finds the main timeline when none is flagged', () => {
    const usdm = example('observational.json');
    expect(() => readUsdm({ ...usdm, usdmVersion: '3.6.0' })).toThrow(
      'This study definition is USDM version 3.6.0. study.builder reads version 4: export it again as USDM 4.'
    );
    expect(readUsdm({ ...usdm, usdmVersion: '5.0.0' }).notes[0]).toBe(
      'The file is USDM version 5.0.0; it was read as version 4, so anything new in it is left out.'
    );
    const changed = JSON.parse(JSON.stringify(usdm));
    const design = changed.study.versions[0].studyDesigns[0];
    design.population.plannedEnrollmentNumber = {
      instanceType: 'Range',
      minValue: { value: 80 },
      maxValue: { value: 140 }
    };
    for (const timeline of design.scheduleTimelines) timeline.mainTimeline = false;
    design.scheduleTimelines.unshift({
      id: 'T0',
      name: 'A small one',
      mainTimeline: false,
      instances: [],
      timings: []
    });
    changed.study.versions[0].studyDesigns.push({ id: 'second' });
    const read = readUsdm(changed);
    expect(read.participants).toBe(140);
    expect(read.visits).toHaveLength(6);
    expect(read.notes).toEqual(
      expect.arrayContaining([
        'The file holds 2 study designs; the first was read.',
        '1 other timeline in the file is not simulated (A small one): the times within a visit, and what happens off the schedule.'
      ])
    );
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

describe('an efficacy score', () => {
  const PILOT_SCORE = {
    name: 'ADAS-Cog (11)',
    visits: ['Baseline', 'Week 8', 'Week 16', 'Week 24'],
    baseline: 24,
    sd: 6.5,
    change: 2.5,
    effects: { 'Xanomeline Low Dose': -1.5, 'Xanomeline High Dose': '-3' },
    min: 0,
    max: 70
  };

  it('is the one the protocol’s estimand points at, where it is scheduled, with no difference until one is said', () => {
    expect(efficacyOf(pilot())).toMatchObject({
      name: 'ADAS-Cog',
      visits: ['Screening 1', 'Baseline', 'Week 8', 'Week 16', 'Week 24'],
      effects: {},
      change: 0
    });
    const { design: _design, ...bare } = pilot();
    expect(efficacyOf(readProtocol(bare))).toBeNull();
  });

  it('is read whole: the reference arm, a difference for every other arm, and the day the full change is reached', () => {
    const read = readEfficacy(PILOT_SCORE, pilot());
    expect(read.problems).toEqual([]);
    expect(read.efficacy).toMatchObject({
      reference: 'Placebo',
      effects: { 'Xanomeline Low Dose': -1.5, 'Xanomeline High Dose': -3 },
      day: 169,
      better: 'lower'
    });
    expect(readEfficacy({ ...PILOT_SCORE, sd: 0 }, pilot()).problems).toEqual([
      'The standard deviation of the efficacy score must be above 0.'
    ]);
    expect(readEfficacy({ ...PILOT_SCORE, visits: ['Nowhere'] }, pilot()).problems).toEqual([
      'The efficacy score needs at least one of the protocol’s visits.'
    ]);
  });

  it('goes to R as text beside the protocol, brings the scores domain, and is read back; it needs a protocol', () => {
    const read = readSettings({ protocol: pilot(), efficacy: PILOT_SCORE, domains: ['AE', 'QS'] });
    expect(read.problems).toEqual([]);
    expect(read.args.domains).toContain('QS');
    expect(JSON.parse(read.args.efficacy).scores[0]).toEqual({
      name: 'ADAS-Cog (11)',
      visits: ['Baseline', 'Week 8', 'Week 16', 'Week 24'],
      baseline: 24,
      sd: 6.5,
      change: 2.5,
      effects: { 'Xanomeline Low Dose': -1.5, 'Xanomeline High Dose': -3 },
      day: 169,
      min: 0,
      max: 70
    });
    expect(settingsOfArgs(read.args).efficacy).toMatchObject({ name: 'ADAS-Cog (11)', sd: 6.5 });
    // Asked for by name with no score, the scores domain is not made.
    expect(readSettings({ protocol: pilot(), domains: ['AE', 'QS'] }).args.domains).not.toContain(
      'QS'
    );
    expect(readSettings({ efficacy: PILOT_SCORE }).problems).toEqual([
      'An efficacy score needs a protocol: its arms and the visits it is measured at.'
    ]);
  });

  it('reads what the simulator is to assume: a share who leave early, by arm where one differs, and how adverse events follow the arm', () => {
    const study = { arms: ['Placebo', 'Low', 'High'], day: 169 };
    // Nothing of its own: nothing is sent, and the simulator's own stand.
    expect(readAssumptions({}, study)).toEqual({
      problems: [],
      assumptions: { dropout: 0, dropoutByArm: {}, eventRatio: 1.5 },
      sent: null
    });
    expect(
      readAssumptions({ dropout: '0.2', dropoutByArm: { High: 0.35 }, eventRatio: 2 }, study).sent
    ).toEqual({ dropout: { rate: 0.2, arms: { High: 0.35 }, day: 169 }, events: { ratio: 2 } });
    expect(readAssumptions({ dropout: 1.2 }, study).problems).toEqual([
      'The share who leave early must be a number from 0 to 0.9.'
    ]);
    expect(readAssumptions({ dropoutByArm: { Other: 0.1 } }, study).problems).toEqual([
      'Other is not an arm of this study.'
    ]);
    expect(readAssumptions({ eventRatio: 0 }, study).problems).toHaveLength(1);
    // In the settings: the day is the protocol's last visit, or the study's months.
    const withProtocol = readSettings({ protocol: pilot(), assumptions: { dropout: 0.3 } });
    expect(JSON.parse(withProtocol.args.assumptions)).toEqual({ dropout: { rate: 0.3, day: 183 } });
    expect(settingsOfArgs(withProtocol.args).assumptions).toEqual({ dropout: 0.3 });
    const plain = readSettings({ months: 6, assumptions: { eventRatio: 3 } });
    expect(JSON.parse(plain.args.assumptions)).toEqual({ events: { ratio: 3 } });
    expect(readSettings({ assumptions: {} }).args.assumptions).toBeUndefined();
    expect(readSettings({ assumptions: { dropout: 2 } }).args).toBeNull();
  });

  it('shows the model under the chart when the results hold one: each arm against the reference arm at the last visit', () => {
    const line = (analysis, arm, statistic, value) =>
      `"${analysis}","Set","ADAS-Cog (11)","${arm}","Week 24",14,"${statistic}",${value},"Placebo"`;
    const text = [
      '"ANALYSIS","ANALYSISSET","PARAM","ARM","VISIT","VISITNUM","STATISTIC","VALUE","REFARM"',
      line('Change', 'Placebo', 'n', 40),
      line('Change', 'Placebo', 'mean', 2.4),
      line('Change', 'Active', 'n', 41),
      line('Change', 'Active', 'mean', -0.5),
      line('Change', 'Active', 'difference', -2.9),
      line('Model', 'Active', 'adjusted difference', -2.75),
      line('Model', 'Active', 'standard error', 0.9),
      line('Model', 'Active', 'lower 95% limit', -4.54),
      line('Model', 'Active', 'upper 95% limit', -0.96),
      line('Model', 'Active', 'p-value', 0.003),
      ''
    ].join('\n');
    const study = {
      table: (layer, id) =>
        layer === 'analysis' && id === 'EfficacySummary' ? { rows: 10, text } : null,
      args: {}
    };
    document.body.innerHTML = '<div id="e"></div>';
    const box = document.querySelector('#e');
    drawEfficacy(domOf(document), study, box);
    const row = box.querySelector('.sb-efficacy-model tr[data-arm="Active"]');
    expect([...row.children].map((cell) => cell.textContent)).toEqual([
      'Active',
      '−2.75',
      '−4.54 to −0.96',
      '0.90',
      '0.0030'
    ]);
    // With no model in the results, there is no model table.
    const bare = {
      ...study,
      table: () => ({ rows: 5, text: text.split('\n').slice(0, 6).join('\n') })
    };
    box.replaceChildren();
    drawEfficacy(domOf(document), bare, box);
    expect(box.querySelector('.sb-efficacy-model')).toBeNull();
  });

  it('is drawn from the results table: a line an arm, the numbers by visit, and what the simulator was told', () => {
    const line = (arm, visit, number, statistic, value) =>
      `"Change","Set","ADAS-Cog (11)","${arm}","${visit}",${number},"${statistic}",${value},"Placebo"`;
    const text = [
      '"ANALYSIS","ANALYSISSET","PARAM","ARM","VISIT","VISITNUM","STATISTIC","VALUE","REFARM"',
      line('Placebo', 'Baseline', 2, 'n', 50),
      line('Placebo', 'Baseline', 2, 'mean', 0),
      line('Active', 'Baseline', 2, 'n', 50),
      line('Active', 'Baseline', 2, 'mean', 0),
      line('Placebo', 'Week 24', 14, 'n', 40),
      line('Placebo', 'Week 24', 14, 'mean', 2.4),
      line('Placebo', 'Week 24', 14, 'sd', 6.1),
      line('Active', 'Week 24', 14, 'n', 41),
      line('Active', 'Week 24', 14, 'mean', -0.5),
      line('Active', 'Week 24', 14, 'sd', 6.6),
      line('Active', 'Week 24', 14, 'difference', -2.9),
      ''
    ].join('\n');
    const study = {
      table: (layer, id) =>
        layer === 'analysis' && id === 'EfficacySummary' ? { rows: 11, text } : null,
      args: {
        efficacy: JSON.stringify({ scores: [{ change: 2.5, sd: 6.5, effects: { Active: -3 } }] })
      }
    };
    const results = efficacyResults(study);
    expect(results.arms).toEqual(['Placebo', 'Active']);
    expect(results.value('Active', 'Week 24', 'difference')).toBe(-2.9);
    expect(efficacyResults({ table: () => null })).toBeNull();
    document.body.innerHTML = '<div id="e"></div>';
    const box = document.querySelector('#e');
    drawEfficacy(domOf(document), study, box);
    expect(box.querySelectorAll('polyline')).toHaveLength(2);
    expect(box.querySelector('polyline[data-arm="Active"]')).not.toBeNull();
    const active = box.querySelector('.sb-efficacy-table tr[data-arm="Active"]');
    expect([...active.children].map((cell) => cell.textContent)).toEqual([
      'Week 24',
      'Active',
      '41',
      '−0.5',
      '6.6',
      '−2.9'
    ]);
    expect(box.querySelector('.sb-efficacy-told').textContent).toContain('Active −3.0');
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
    // The score the protocol points at is offered, with a difference to type for each other arm.
    expect(handle.settings().efficacy).toMatchObject({ name: 'ADAS-Cog' });
    expect(document.querySelectorAll('.sb-efficacy-arms tbody tr')).toHaveLength(3);
    const high = q('[name="efficacy-effect-Xanomeline High Dose"]');
    high.value = '-3';
    high.dispatchEvent(new Event('input'));
    q('[name="efficacy-sd"]').value = '6.5';
    q('[name="efficacy-sd"]').dispatchEvent(new Event('input'));
    q('[name="efficacy-sd"]').dispatchEvent(new Event('change'));
    expect(handle.settings().efficacy.effects['Xanomeline High Dose']).toBe('-3');
    // 300 participants in three arms: the protocol's own 90% power.
    expect(
      q('.sb-efficacy-arms tr[data-arm="Xanomeline High Dose"] td:last-child').textContent
    ).toBe('About 90%');
    q('[data-efficacy="off"]').click();
    expect(handle.settings().efficacy).toBeNull();
    expect(q('.sb-efficacy-arms')).toBeNull();
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
