// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StudyBuilderError, createBuilder, rOptions, studyOf } from '../src/engine/build.js';
import { createConnection, foldersOf } from '../src/engine/r.js';
import { mount } from '../src/loader/widget.js';
import { readSettings } from '../src/engine/core.js';
import {
  CONFIG_FORMAT,
  PRESETS_FORMAT,
  STUDY_FORMAT,
  configOf,
  createShelf,
  fetchPresets,
  memoryBackend,
  openPreset,
  openStudy,
  readDocument,
  readPresets,
  savedOf
} from '../src/engine/saved.js';

// The build function and the widget, with a stand-in for R: the connection
// answers with a small study in the shape r/builder.R returns. Real R is held
// by a run in a browser.

const column = (name, type = 'character') => ({ name, type });
const ANSWER = {
  study_id: 'BUILT-001',
  snapshot_date: '2012-09-30',
  snapshots: 9,
  seconds: 1.3,
  simulator: '2.1.0',
  notes: ['Site ids are written SITE1234 where gsm.datasim writes 0X1234.'],
  packages: { 'gsm.datasim': '2.1.0', 'gsm.mapping': '1.1.6', 'gsm.core': '1.3.1', workr: '1.1.0' },
  layers: [
    {
      id: 'raw',
      label: 'Raw',
      tables: [
        {
          id: 'SUBJ',
          table: 'Raw_SUBJ',
          name: 'Raw_SUBJ.csv',
          layer: 'raw',
          rows: 2,
          columns: [column('studyid'), column('subjid'), column('agerep', 'integer')],
          text: '"studyid","subjid","agerep"\n"BUILT-001","S1",40\n"BUILT-001","S2",51\n',
          made: { workflow: 'gsm.datasim', from: [] }
        },
        {
          id: 'AE',
          table: 'Raw_AE',
          name: 'Raw_AE.csv',
          layer: 'raw',
          rows: 1,
          columns: [column('subjid'), column('aetoxgr', 'integer')],
          text: '"subjid","aetoxgr"\n"S1",2\n',
          made: { workflow: 'gsm.datasim', from: [] }
        }
      ]
    },
    {
      id: 'raw.rbqm',
      label: 'Raw.RBQM',
      tables: [
        {
          id: 'AE',
          table: 'Mapped_AE',
          name: 'Mapped_AE.csv',
          layer: 'raw.rbqm',
          description: 'AE Data Mapping',
          rows: 1,
          columns: [column('subjid'), column('aetoxgr', 'integer')],
          text: '"subjid","aetoxgr"\n"S1",2\n',
          // One table read: R hands a list of one as it is.
          made: { workflow: 'Mapped_AE', from: 'Raw_AE' }
        }
      ]
    },
    {
      id: 'adam',
      label: 'ADaM',
      tables: [
        {
          id: 'ADAE',
          table: 'ADaM_ADAE',
          name: 'adae.csv',
          layer: 'adam',
          domain: 'ae',
          description: 'Adverse events analysis table',
          rows: 1,
          columns: [column('USUBJID'), column('AESEV')],
          text: '"USUBJID","AESEV"\n"S1","MODERATE"\n',
          made: { workflow: 'ADaM_ADAE', from: ['Raw_AE', 'ADaM_ADSL'] },
          mapping: [
            { column: 'USUBJID', from: 'Raw_AE.subjid', how: 'Copied' },
            { column: 'AESEV', from: 'Raw_AE.aetoxgr', how: 'Derived: the toxicity grade in words' }
          ]
        }
      ]
    }
  ]
};
const RAW = ANSWER.layers[0].tables;
const ADAE = ANSWER.layers[2].tables[0];

function fakeR(answer = { status: 'ok', value: ANSWER }) {
  const made = [];
  const connect = vi.fn((options) => {
    const connection = {
      options,
      runs: [],
      run: vi.fn(async (name, request) => {
        connection.runs.push({ name, request });
        return typeof answer === 'function' ? answer() : answer;
      }),
      close: vi.fn(async () => {})
    };
    made.push(connection);
    return connection;
  });
  return { connect, made };
}

describe('what R is given', () => {
  it('is the builder’s R, gsm.datasim’s own files and the vital signs spec, served under one address', () => {
    const options = rOptions('https://example.org/sb');
    expect(options.files[0]).toEqual({
      path: '/study.builder/r/builder.R',
      url: 'https://example.org/sb/r/builder.R'
    });
    expect(options.files.filter((file) => /gsm\.datasim\/R\/.+\.R$/.test(file.path))).toHaveLength(
      41
    );
    expect(options.files.map((file) => file.path)).toContain(
      '/study.builder/vendor/gsm.mapping-vitals/workflow/1_mappings/VS.yaml'
    );
    expect(options.files.slice(-4).map((file) => file.path)).toEqual([
      '/study.builder/workflows/adam/ADAE.yaml',
      '/study.builder/workflows/adam/ADSL.yaml',
      '/study.builder/workflows/adam/ADVS.yaml',
      '/study.builder/workflows/analysis/AESummary.yaml'
    ]);
    // gsm's metric and reporting workflows, and the one R file the reporting needs.
    const paths = options.files.map((file) => file.path);
    expect(paths).toContain('/study.builder/vendor/gsm.kri/workflow/2_metrics/kri0001.yaml');
    expect(paths).toContain('/study.builder/vendor/gsm.kri/R/util-Report.R');
    expect(paths).toContain(
      '/study.builder/vendor/gsm.reporting/workflow/3_reporting/Results.yaml'
    );
    expect(options.source).toEqual(['/study.builder/r/builder.R']);
    expect(options.repos).toEqual([
      'https://example.org/sb/vendor/r-wasm/repo',
      'https://repo.r-wasm.org'
    ]);
  });

  it('installs gsm’s packages from where a page already serves them, when told', () => {
    expect(rOptions('./sb/', { repository: './r-wasm' }).repos).toEqual([
      './r-wasm',
      'https://repo.r-wasm.org'
    ]);
  });

  it('lists a path’s folders shallowest first', () => {
    expect(foldersOf('/a/b/c.R')).toEqual(['/a', '/a/b']);
  });
});

describe('a study with no page', () => {
  it('starts R on the first build, asks for the study, and returns its domains and files', async () => {
    const r = fakeR();
    const stages = [];
    const builder = createBuilder({
      base: './',
      createConnection: r.connect,
      onStage: (name) => stages.push(name)
    });
    expect(builder.started()).toBe(false);
    const study = await builder.build({ participants: 60, sites: 6, months: 4, domains: ['AE'] });
    expect(r.connect).toHaveBeenCalledTimes(1);
    expect(r.made[0].runs[0]).toEqual({
      name: 'builder_run',
      request: {
        args: {
          simulator: '/study.builder/vendor/gsm.datasim',
          study_name: 'BUILT-001',
          participants: 60,
          sites: 6,
          months: 4,
          outlier_intensity: 1,
          phase: 'P2',
          workflows: '/study.builder/workflows',
          therapeutic_area: 'Oncology',
          domains: ['AE'],
          kri: '/study.builder/vendor/gsm.kri',
          reporting: '/study.builder/vendor/gsm.reporting',
          layers: ['raw', 'raw.rbqm', 'adam', 'analysis', 'reporting']
        }
      }
    });
    expect(study.id).toBe('BUILT-001');
    expect(
      study.domains.map((domain) => [domain.id, domain.label, domain.rows, domain.core])
    ).toEqual([
      ['SUBJ', 'Participants', 2, true],
      ['AE', 'Adverse events', 1, false]
    ]);
    expect(study.standard[0]).toMatchObject({ id: 'ae', name: 'adae.csv', from: ['AE', 'ADSL'] });
    expect(study.standard[0].mapping[1]).toEqual({
      column: 'AESEV',
      label: '',
      from: 'Raw_AE.aetoxgr',
      how: 'Derived: the toxicity grade in words'
    });
    expect(study.files()).toEqual({
      raw: [
        { name: 'Raw_SUBJ.csv', text: RAW[0].text },
        { name: 'Raw_AE.csv', text: RAW[1].text }
      ],
      standard: [{ name: 'adae.csv', text: ADAE.text }],
      layers: {
        raw: [
          { name: 'Raw_SUBJ.csv', text: RAW[0].text },
          { name: 'Raw_AE.csv', text: RAW[1].text }
        ],
        'raw.rbqm': [{ name: 'Mapped_AE.csv', text: RAW[1].text }],
        adam: [{ name: 'adae.csv', text: ADAE.text }]
      }
    });
    // Every layer, and one table by its layer and its id.
    expect(study.layers.map((layer) => [layer.id, layer.label, layer.tables.length])).toEqual([
      ['raw', 'Raw', 2],
      ['raw.rbqm', 'Raw.RBQM', 1],
      ['adam', 'ADaM', 1]
    ]);
    expect(study.table('adam', 'ADAE').rows).toBe(1);
    expect(study.table('raw.rbqm', 'AE').made).toEqual({ workflow: 'Mapped_AE', from: ['Raw_AE'] });
    expect(study.table('adam', 'ADVS')).toBeNull();
    expect(study.table('sdtm', 'AE')).toBeNull();
    // The manifest: a checksum for each table, and one key for the study.
    expect(study.manifest.format).toBe('study.builder/manifest/1');
    expect(study.manifest.key).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(study.manifest.tables.map((table) => table.file)).toEqual([
      'raw/Raw_SUBJ.csv',
      'raw/Raw_AE.csv',
      'raw.rbqm/Mapped_AE.csv',
      'adam/adae.csv'
    ]);
    expect(study.manifest.tables[3].made).toEqual({
      workflow: 'ADaM_ADAE',
      from: ['Raw_AE', 'ADaM_ADSL']
    });
    expect(study.manifest.packages['gsm.datasim']).toBe('2.1.0');
    expect(study.manifest.simulation.participants).toBe(60);
    // The metadata: a spec for every table, with its key and what each column joins to.
    expect(study.metadata.tables).toHaveLength(4);
    expect(study.spec('raw', 'SUBJ')).toMatchObject({ keys: ['subjid'], rows: 2 });
    expect(study.spec('raw', 'AE').columns[0]).toEqual({
      name: 'subjid',
      type: 'character',
      label: 'Participant id',
      key: false,
      joins: { layer: 'raw', id: 'SUBJ', column: 'subjid' }
    });
    expect(study.spec('adam', 'ADAE').columns[1]).toMatchObject({
      name: 'AESEV',
      from: 'Raw_AE.aetoxgr',
      how: 'Derived: the toxicity grade in words'
    });
    expect(study.spec('adam', 'ADVS')).toBeNull();
    expect(study.said).toContain(
      '60 participants at 6 sites over 4 months, in 2 domains and 3 layers'
    );
    // A second study is built on the same R, and says only that it is simulating.
    await builder.build();
    expect(r.connect).toHaveBeenCalledTimes(1);
    expect(stages).toEqual(['simulate']);
  });

  it('hands R the vital signs spec only when vital signs are wanted', async () => {
    const r = fakeR();
    const builder = createBuilder({ createConnection: r.connect });
    await builder.build({ domains: ['VS'] });
    await builder.build({ domains: ['AE'] });
    expect(r.made[0].runs[0].request.args.vitals).toBe(
      '/study.builder/vendor/gsm.mapping-vitals/workflow/1_mappings/VS.yaml'
    );
    expect(r.made[0].runs[1].request.args).not.toHaveProperty('vitals');
    // And its own workflows only when the ADaM layer is.
    await builder.build({ layers: ['raw.rbqm'] });
    expect(r.made[0].runs[0].request.args.workflows).toBe('/study.builder/workflows');
    expect(r.made[0].runs[2].request.args).not.toHaveProperty('workflows');
    // Raw is always named, so a study of raw alone is not asked for with an empty list.
    await builder.build({ layers: [] });
    expect(r.made[0].runs[3].request.args.layers).toEqual(['raw']);
  });

  it('uses a connection the page already has, and never closes it', async () => {
    const r = fakeR();
    const connection = r.connect({});
    const builder = createBuilder({ connection, createConnection: r.connect });
    expect(builder.started()).toBe(true);
    await builder.build();
    await builder.close();
    expect(r.connect).toHaveBeenCalledTimes(1);
    expect(connection.close).not.toHaveBeenCalled();
  });

  it('refuses settings R would refuse, without starting R', async () => {
    const r = fakeR();
    const builder = createBuilder({ createConnection: r.connect });
    await expect(builder.build({ sites: 900 })).rejects.toMatchObject({
      name: 'StudyBuilderError',
      problems: ['Sites must be a whole number from 2 to 100.']
    });
    expect(r.connect).not.toHaveBeenCalled();
  });

  it('says what R said when the build stops, and that R did not start when it did not', async () => {
    const stopped = createBuilder({
      createConnection: fakeR({ status: 'error', message: 'no visits' }).connect
    });
    await expect(stopped.build()).rejects.toThrow('The study was not built. R said: no visits');
    const offline = fakeR({ status: 'unavailable', message: 'Failed to fetch' });
    const builder = createBuilder({ createConnection: offline.connect });
    await expect(builder.build()).rejects.toThrow(
      'R could not be started in this browser: Failed to fetch'
    );
    // The next build starts R again.
    expect(builder.started()).toBe(false);
    await expect(builder.build()).rejects.toBeInstanceOf(StudyBuilderError);
    expect(offline.connect).toHaveBeenCalledTimes(2);
  });

  it('refuses an answer with no domains, or a table it cannot read', () => {
    const { args } = readSettings();
    expect(() => studyOf({ layers: [] }, args)).toThrow('R returned no domains');
    expect(() => studyOf({ layers: [{ id: 'raw', tables: [] }] }, args)).toThrow(
      'R returned no domains'
    );
    expect(() =>
      studyOf({ layers: [{ id: 'raw', tables: [{ id: 'AE', name: 'Raw_AE.csv' }] }] }, args)
    ).toThrow('a table that cannot be read');
  });
});

describe('the connection to R', () => {
  // A webR that records what is asked of it and answers with JSON text.
  function standIn(json = '{"ok":true}') {
    const calls = [];
    class WebR {
      constructor(options) {
        calls.push(['new', options]);
        this.FS = {
          mkdir: async (folder) => calls.push(['mkdir', folder]),
          writeFile: async (file, bytes) =>
            calls.push(['write', file, new TextDecoder().decode(bytes)])
        };
        this.Shelter = class {
          constructor() {
            return Promise.resolve({
              RList: class {
                constructor(value) {
                  return Promise.resolve({ rList: value });
                }
              },
              evalR: async (code, options) => {
                calls.push(['evalR', code, options.env]);
                return { toString: async () => json };
              },
              purge: async () => {}
            });
          }
        };
      }
      async init() {
        calls.push(['init']);
      }
      async installPackages(packages, options) {
        calls.push(['install', packages, options]);
      }
      async evalRVoid(code) {
        calls.push(['evalRVoid', code]);
      }
      close() {
        calls.push(['close']);
      }
    }
    return {
      calls,
      importWebR: async () => ({ WebR, ChannelType: { PostMessage: 'post-message' } })
    };
  }
  const fetchOf = (texts) => async (url) =>
    url in texts
      ? { ok: true, status: 200, text: async () => texts[url] }
      : { ok: false, status: 404, text: async () => '' };

  it('starts R once, installs the packages, writes the files, sources the R and carries the answer back', async () => {
    const webR = standIn('{"study_id":"A","rows":[1,2]}');
    const stages = [];
    const connection = createConnection({
      packages: ['workr'],
      repos: ['https://example.org/repo/'],
      files: [{ path: '/sb/r/builder.R', url: 'u1' }],
      source: ['/sb/r/builder.R'],
      onStage: (name) => stages.push(name),
      importWebR: webR.importWebR,
      fetch: fetchOf({ u1: 'builder_run <- function() 1' })
    });
    expect(webR.calls).toEqual([]);
    const answer = await connection.run('builder_run', { args: { participants: 20 } });
    expect(answer).toEqual({ status: 'ok', value: { study_id: 'A', rows: [1, 2] } });
    await connection.run('builder_run');
    const names = webR.calls.map(([name]) => name);
    expect(names.filter((name) => name === 'new')).toHaveLength(1);
    expect(webR.calls.find(([name]) => name === 'install')).toEqual([
      'install',
      ['workr', 'jsonlite'],
      { quiet: true, repos: ['https://example.org/repo'] }
    ]);
    expect(webR.calls).toContainEqual(['write', '/sb/r/builder.R', 'builder_run <- function() 1']);
    expect(webR.calls).toContainEqual(['evalRVoid', 'source("/sb/r/builder.R", local = FALSE)']);
    expect(stages).toEqual(['runtime', 'packages', 'files', 'source']);
  });

  it('answers that R did not start when a file cannot be fetched, closes it, and tries again next time', async () => {
    const webR = standIn();
    const connection = createConnection({
      files: [{ path: '/sb/x.R', url: 'missing' }],
      importWebR: webR.importWebR,
      fetch: fetchOf({})
    });
    expect(await connection.run('f')).toEqual({
      status: 'unavailable',
      message: 'missing answered 404'
    });
    await connection.run('f');
    expect(webR.calls.filter(([name]) => name === 'new')).toHaveLength(2);
    expect(webR.calls.filter(([name]) => name === 'close')).toHaveLength(2);
  });
});

describe('the loader on a page', () => {
  let handle = null;
  afterEach(() => {
    if (handle) handle.destroy();
    handle = null;
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  function mounted(options = {}, answer) {
    document.body.innerHTML = '<div id="b"></div>';
    const r = fakeR(answer);
    const saved = [];
    handle = mount('#b', {
      createBuilder: (given) => createBuilder({ ...given, createConnection: r.connect }),
      save: (name, bytes, type) => saved.push({ name, bytes, type }),
      presets: false,
      shelf: false,
      ...options
    });
    return { r, saved };
  }
  const q = (selector) => document.querySelector(selector);
  const press = (action) => q(`[data-action="${action}"]`).click();
  const settle = async () => {
    for (let turn = 0; turn < 6; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const SETTINGS_ONLY = {
    id: 'big',
    name: 'Big settings',
    about: 'Too large to host.',
    settings: { ...readSettingsOf({ participants: 400, sites: 40 }) },
    study: null
  };

  function readSettingsOf(settings) {
    return configOf(settings).settings;
  }

  it('with nothing to list, opens on the form: the trial, the layers as a pipeline, the raw domains as chips, and what building gives; nothing is asked of R', () => {
    const { r } = mounted();
    expect(handle.state().screen).toBe('describe');
    expect(q('[data-action="back"]')).toBeNull();
    expect([...document.querySelectorAll('.sb h3')].map((h) => h.textContent)).toEqual([
      'The trial',
      'Layers: each is built from the one before it',
      'Raw domains: 11 of 19',
      'What you will get'
    ]);
    expect(q('[name="participants"]').value).toBe('150');
    expect(q('[data-phase="P2"]').getAttribute('aria-pressed')).toBe('true');
    expect([...document.querySelectorAll('.sb-layer')].map((layer) => layer.dataset.layer)).toEqual(
      ['raw', 'raw.rbqm', 'adam', 'analysis', 'reporting']
    );
    expect(q('[data-layer="raw"]').disabled).toBe(true);
    expect(q('.sb-warn').textContent).toContain('First build in this browser');
    expect(r.connect).not.toHaveBeenCalled();
  });

  it('a phase fills in a typical size; a layer another is built from stays in; a domain another needs stays in', () => {
    mounted();
    q('[data-phase="P1"]').click();
    expect(q('[name="participants"]').value).toBe('40');
    // Reporting is built from Analysis, which is built from Raw.RBQM and ADaM.
    expect(q('[data-layer="analysis"]').disabled).toBe(true);
    q('[data-layer="reporting"]').click();
    expect(q('[data-layer="reporting"]').getAttribute('aria-pressed')).toBe('false');
    expect(q('[data-layer="analysis"]').disabled).toBe(false);
    expect(handle.settings().layers).toEqual(['raw.rbqm', 'adam', 'analysis']);
    expect(q('[data-domain="SUBJ"]').disabled).toBe(true);
    q('[data-domain="AE"]').click();
    expect(handle.settings().domains).not.toContain('AE');
    expect(q('.sb h3:nth-of-type(3)').textContent).toBe('Raw domains: 10 of 19');
  });

  it('says every problem with the settings and asks nothing of R', async () => {
    const { r } = mounted({ settings: { participants: 5, sites: 9 } });
    expect(await handle.build()).toBeNull();
    expect(
      [...document.querySelectorAll('.sb-problems li')].map((item) => item.textContent)
    ).toEqual(['Participants must be a whole number from 20 to 500.']);
    expect(r.connect).not.toHaveBeenCalled();
  });

  it('builds the study, says each step as R takes it, and opens the study: its name, how it was made, its key, its settings, and study.viewer on its overview', async () => {
    const onBuilt = vi.fn();
    const { r } = mounted({ onBuilt });
    const building = handle.build();
    expect(handle.state()).toMatchObject({ phase: 'building', stage: 'runtime' });
    expect([...document.querySelectorAll('.sb-steps li')].map((step) => step.dataset.step)).toEqual(
      ['now', 'next', 'next', 'next']
    );
    expect(q('[data-action="build"]').disabled).toBe(true);
    r.made[0].options.onStage('packages');
    expect(q('.sb-steps li[data-step="now"]').textContent).toBe('Install R’s packages');
    const study = await building;
    expect(onBuilt).toHaveBeenCalledWith(study);
    expect(handle.state().screen).toBe('study');
    expect(q('.sb-title h2').textContent).toBe('BUILT-001');
    expect(q('.sb-title .sb-pill').textContent).toBe('Built in 1.3 s');
    expect(q('[data-key]').dataset.key).toBe(study.manifest.key);
    expect([...document.querySelectorAll('.sb-fact')].map((fact) => fact.textContent)).toEqual([
      'Phase 2',
      'Oncology',
      '150 participants',
      '20 sites',
      '9 months',
      'No seed'
    ]);
    // The viewer: the study's layers in its rail, and the overview first.
    expect([...document.querySelectorAll('.sv-view')].map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Tables',
      'Columns',
      'One participant'
    ]);
    expect([...document.querySelectorAll('.sv-group')].map((group) => group.textContent)).toEqual(
      ANSWER.layers.map((layer) => `${layer.label}${layer.tables.length}`)
    );
    expect(q('[data-own="overview"] .sb-tile-label').textContent).toBe('Participants');
    expect(q('.sb-caveats').textContent).toContain('Every row is synthetic');
    q('[data-table="adam:ADAE"]').click();
    expect(q('.sv-title').textContent).toContain('ADAE');
    expect(handle.state().viewing).toMatchObject({ view: 'tables', table: 'adam:ADAE' });
  });

  it('hands the study to the page, downloads it whole, and goes back to its settings to change them', async () => {
    const onStudy = vi.fn();
    const { saved } = mounted({ onStudy, useLabel: 'Load into the demo' });
    expect(q('[data-action="use"]')).toBeNull();
    await handle.build();
    expect(q('[data-action="use"]').textContent).toBe('Load into the demo');
    press('use');
    expect(onStudy).toHaveBeenCalledWith(handle.study());
    press('zip');
    expect(saved[0]).toMatchObject({ name: 'BUILT-001.zip', type: 'application/zip' });
    press('change');
    expect(handle.state().screen).toBe('describe');
    expect(q('[data-action="to-study"]').textContent).toBe('Back to BUILT-001');
    press('to-study');
    expect(handle.state().screen).toBe('study');
  });

  it('says what R said when the build stops, and keeps the last study', async () => {
    let answer = { status: 'ok', value: ANSWER };
    mounted({}, () => answer);
    await handle.build();
    answer = { status: 'error', message: 'no visits' };
    expect(await handle.build()).toBeNull();
    expect(handle.state()).toMatchObject({ phase: 'failed', screen: 'describe' });
    expect(q('p.sb-problems').textContent).toBe('The study was not built. R said: no visits');
    expect(handle.study().id).toBe('BUILT-001');
  });

  it('opens on the settings and the theme a page gives it', () => {
    mounted({
      settings: { participants: 60, phase: 'P1', domains: ['AE'], layers: ['adam'] },
      theme: 'dark'
    });
    expect(q('[name="participants"]').value).toBe('60');
    expect(handle.settings().domains).toEqual(['AE']);
    expect(handle.settings().layers).toEqual(['adam']);
    expect(q('[data-layer="raw.rbqm"]').getAttribute('aria-pressed')).toBe('false');
    expect(q('[data-domain="LB"]').getAttribute('aria-pressed')).toBe('false');
    expect(q('.sb').dataset.theme).toBe('dark');
  });

  // ---- the library: ready-made and saved studies, and settings ----

  it('with something to list, opens on the library: a ready-made study opens at once with no R, and settings only fill the form or build', async () => {
    const hosted = savedOf(await openStudy(savedOf(studyOf(ANSWER, readSettings({}).args))));
    const presets = readPresets({
      format: PRESETS_FORMAT,
      presets: [
        {
          id: 'ready',
          name: 'Ready study',
          about: 'Hosted.',
          settings: {},
          study: 'ready.json',
          key: hosted.key,
          megabytes: 1.1
        },
        { id: 'big', name: 'Big settings', settings: { participants: 400, sites: 40 } },
        { id: 'bad', name: 'Will not build', settings: { participants: 1 } }
      ]
    });
    expect(presets.map((preset) => preset.id)).toEqual(['ready', 'big']);
    const fetched = vi.fn(async () => ({ ok: true, json: async () => hosted }));
    vi.stubGlobal('fetch', fetched);
    const { r } = mounted({ presets });
    expect(handle.state().screen).toBe('library');
    expect([...document.querySelectorAll('.sb h3')].map((h) => h.textContent)).toEqual([
      'Ready now: opens at once, with no R',
      'Settings only: Build makes the study'
    ]);
    expect(q('[data-study="preset:ready"] .sb-pill').textContent).toBe('Ready-made');
    expect(q('[data-study="preset:ready"]').textContent).toContain(
      '150 participants · 20 sites · 9 months'
    );
    q('[data-settings="preset:big"] [data-action="edit"]').click();
    await settle();
    expect(handle.state().screen).toBe('describe');
    expect(q('[name="participants"]').value).toBe('400');
    press('back');
    q('[data-study="preset:ready"] [data-action="open"]').click();
    await settle();
    expect(fetched).toHaveBeenCalledWith('ready.json');
    expect(handle.state().screen).toBe('study');
    expect(handle.study().opened).toBe(true);
    expect(q('.sb-title .sb-pill').textContent).toBe('Opened, not built');
    expect(handle.state().said).toBe('Opened Ready study, a ready-made study. Nothing was built.');
    expect(r.connect).not.toHaveBeenCalled();
    // Build on a settings-only row builds it.
    press('back');
    q('[data-settings="preset:big"] [data-action="build-these"]').click();
    await settle();
    expect(r.made).toHaveLength(1);
    expect(r.made[0].runs[0].request.args.participants).toBe(400);
  });

  it('saves a built study in this browser, lists it in the library, opens it again with no R, and removes it', async () => {
    const shelf = createShelf({ backend: memoryBackend() });
    const { r } = mounted({ shelf });
    await handle.build();
    press('save-study');
    await settle();
    expect(handle.state().shelved).toEqual(['study:BUILT-001']);
    expect(handle.state().said).toContain('saved in this browser as BUILT-001');
    const key = handle.study().manifest.key;
    handle.destroy();
    // Another visit: the same shelf, a new loader, and R never asked.
    const again = mounted({ shelf });
    await settle();
    expect(handle.state().screen).toBe('library');
    expect(q('[data-study="shelf:study:BUILT-001"] .sb-pill').textContent).toBe('Saved by you');
    q('[data-study="shelf:study:BUILT-001"] [data-action="open"]').click();
    await settle();
    expect(again.r.connect).not.toHaveBeenCalled();
    expect(handle.study().opened).toBe(true);
    expect(handle.study().manifest.key).toBe(key);
    expect(handle.state().said).toBe('Opened BUILT-001, saved in this browser. Nothing was built.');
    press('back');
    q('[data-study="shelf:study:BUILT-001"] [data-action="remove"]').click();
    await settle();
    expect(handle.state().shelved).toEqual([]);
    expect(r.made).toHaveLength(1);
  });

  it('saves the settings in this browser and as a file, and lists them under Settings only', async () => {
    const shelf = createShelf({ backend: memoryBackend() });
    const { saved } = mounted({
      shelf,
      settings: { name: 'SMALL-1', participants: 40, sites: 4, seed: 11 }
    });
    press('save-settings');
    press('download-settings');
    await settle();
    expect(saved[0].name).toBe('SMALL-1.settings.json');
    const file = JSON.parse(saved[0].bytes);
    expect(file.format).toBe(CONFIG_FORMAT);
    expect(file.settings).toMatchObject({ name: 'SMALL-1', participants: 40, sites: 4, seed: 11 });
    handle.show('library');
    expect(q('[data-settings="shelf:config:SMALL-1"]').textContent).toContain(
      '40 participants · 4 sites · 9 months'
    );
    expect(SETTINGS_ONLY.settings.participants).toBe(400);
  });

  it('downloads a study file, which opens to the same study; a file that is neither kind is refused in a sentence', async () => {
    const { saved } = mounted();
    await handle.build();
    expect(q('[data-action="save-study"]')).toBeNull();
    press('download-study');
    expect(saved[0].name).toBe('BUILT-001.study.json');
    const key = handle.study().manifest.key;
    handle.destroy();
    const { r } = mounted();
    await handle.open(saved[0].bytes);
    expect(handle.study().manifest.key).toBe(key);
    expect(handle.state().screen).toBe('study');
    expect(r.connect).not.toHaveBeenCalled();
    await expect(handle.open('{"format":"other"}')).rejects.toThrow(/not one study.builder saved/);
  });
});

describe('saving and opening, with no page', () => {
  const built = async () => {
    const study = studyOf(ANSWER, readSettings({ seed: 3 }).args);
    study.manifest = await (await import('../src/engine/manifest.js')).manifestOf(study);
    return study;
  };

  it('a saved study opens to the same tables, metadata and key', async () => {
    const study = await built();
    const document = JSON.parse(JSON.stringify(savedOf(study, { name: 'Mine' })));
    expect(document).toMatchObject({ format: STUDY_FORMAT, name: 'Mine', key: study.manifest.key });
    expect(document.settings.seed).toBe(3);
    const opened = await openStudy(document);
    expect(opened.manifest).toEqual(study.manifest);
    expect(opened.metadata).toEqual(study.metadata);
    expect(opened.files()).toEqual(study.files());
    expect(readDocument(JSON.stringify(document)).kind).toBe('study');
  });

  it('a study file that was changed is refused', async () => {
    const document = JSON.parse(JSON.stringify(savedOf(await built())));
    document.study.layers[0].tables[0].text += '"X","S3",9\n';
    await expect(openStudy(document)).rejects.toThrow(/not as it was saved/);
    await expect(openStudy({ format: 'nope' })).rejects.toThrow(/not a study file/);
  });

  it('settings that would not build are not saved, and say why', () => {
    expect(() => configOf({ participants: 1 })).toThrow(/Participants must be a whole number/);
    expect(configOf({ name: 'A', seed: '5' }).settings.seed).toBe(5);
    expect(() => readDocument('not json')).toThrow(/not JSON/);
  });

  it('a shelf lists what it holds, newest first, and replaces one of the same name', async () => {
    let clock = 0;
    const shelf = createShelf({
      backend: memoryBackend(),
      now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, (clock += 1)))
    });
    await shelf.save(configOf({ name: 'A' }));
    await shelf.save(savedOf(await built()));
    await shelf.save(configOf({ name: 'A', participants: 60 }));
    const listed = await shelf.list();
    expect(listed.map((entry) => entry.id)).toEqual(['config:A', 'study:BUILT-001']);
    expect(listed[0].size).toBe('60 participants, 20 sites, 9 months');
    expect((await shelf.open('config:A')).settings.participants).toBe(60);
    await shelf.remove('config:A');
    expect(await shelf.open('config:A')).toBeNull();
    // With nowhere to keep them, a shelf says so.
    const none = createShelf();
    expect(none.available).toBe(false);
    await expect(none.save(configOf({}))).rejects.toThrow(/nowhere to keep it/);
  });

  it('a page with no presets has none, and a hosted study that is not the one listed is refused', async () => {
    expect(await fetchPresets('x', { fetch: async () => ({ ok: false }) })).toEqual([]);
    expect(
      await fetchPresets('x', {
        fetch: async () => {
          throw new Error('offline');
        }
      })
    ).toEqual([]);
    const document = savedOf(await built());
    const preset = {
      id: 'p',
      name: 'P',
      settings: document.settings,
      study: 'p.json',
      key: 'sha256:other'
    };
    await expect(
      openPreset(preset, { fetch: async () => ({ ok: true, json: async () => document }) })
    ).rejects.toThrow(/not the one its list names/);
  });

  it('a hosted study is unpacked when it is gzipped, and read as it is when it is not', async () => {
    const { gzipSync } = await import('node:zlib');
    const document = savedOf(await built());
    const text = JSON.stringify(document);
    const answer = (bytes) => ({
      ok: true,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
    });
    const preset = {
      id: 'p',
      name: 'P',
      settings: document.settings,
      study: 'p.json.gz',
      key: document.key
    };
    for (const bytes of [gzipSync(Buffer.from(text)), Buffer.from(text)]) {
      const opened = await openPreset(preset, { fetch: async () => answer(bytes) });
      expect(opened.study.manifest.key).toBe(document.key);
    }
  });
});
