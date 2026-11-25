// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StudyBuilderError, createBuilder, rOptions, studyOf } from '../src/build.js';
import { createConnection, foldersOf } from '../src/r.js';
import { mount } from '../src/widget.js';
import { readSettings } from '../src/core.js';

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
  domains: [
    {
      id: 'SUBJ',
      table: 'Raw_SUBJ',
      name: 'Raw_SUBJ.csv',
      rows: 2,
      columns: [column('studyid'), column('subjid'), column('agerep', 'integer')],
      text: '"studyid","subjid","agerep"\n"BUILT-001","S1",40\n"BUILT-001","S2",51\n'
    },
    {
      id: 'AE',
      table: 'Raw_AE',
      name: 'Raw_AE.csv',
      rows: 1,
      columns: [column('subjid'), column('aetoxgr', 'integer')],
      text: '"subjid","aetoxgr"\n"S1",2\n'
    }
  ],
  standard: [
    {
      id: 'ae',
      name: 'adae.csv',
      label: 'Adverse events',
      from: ['AE', 'SUBJ'],
      rows: 1,
      columns: [column('USUBJID'), column('AESEV')],
      text: '"USUBJID","AESEV"\n"S1","MODERATE"\n',
      mapping: [
        { column: 'USUBJID', from: 'Raw_AE.subjid', how: 'Copied' },
        { column: 'AESEV', from: 'Raw_AE.aetoxgr', how: 'Derived: the toxicity grade in words' }
      ]
    }
  ]
};

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
    expect(options.files.at(-1).path).toBe(
      '/study.builder/vendor/gsm.mapping-vitals/workflow/1_mappings/VS.yaml'
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
          therapeutic_area: 'Oncology',
          domains: ['AE']
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
    expect(study.standard[0].mapping[1]).toEqual({
      column: 'AESEV',
      from: 'Raw_AE.aetoxgr',
      how: 'Derived: the toxicity grade in words'
    });
    expect(study.files()).toEqual({
      raw: [
        { name: 'Raw_SUBJ.csv', text: ANSWER.domains[0].text },
        { name: 'Raw_AE.csv', text: ANSWER.domains[1].text }
      ],
      standard: [{ name: 'adae.csv', text: ANSWER.standard[0].text }]
    });
    expect(study.said).toContain('60 participants at 6 sites over 4 months, in 2 domains');
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
    expect(() => studyOf({ domains: [] }, args)).toThrow('R returned no domains');
    expect(() => studyOf({ domains: [{ id: 'AE', name: 'Raw_AE.csv' }] }, args)).toThrow(
      'a table that cannot be read'
    );
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

describe('the builder on a page', () => {
  let handle = null;
  afterEach(() => {
    if (handle) handle.destroy();
    handle = null;
    document.body.innerHTML = '';
  });

  function mounted(options = {}, answer) {
    document.body.innerHTML = '<div id="b"></div>';
    const r = fakeR(answer);
    const saved = [];
    handle = mount('#b', {
      createBuilder: (given) => createBuilder({ ...given, createConnection: r.connect }),
      save: (name, bytes, type) => saved.push({ name, bytes, type }),
      ...options
    });
    return { r, saved };
  }
  const card = (id) => document.querySelector(`[data-domain="${id}"]`);
  const box = (id) => card(id).querySelector('input');

  it('opens on the form and a card for every domain, with nothing asked of R', () => {
    const { r } = mounted();
    expect(document.querySelector('[name="participants"]').value).toBe('150');
    expect(document.querySelectorAll('[data-domain]')).toHaveLength(19);
    expect(box('SUBJ').checked && box('SUBJ').disabled).toBe(true);
    expect(card('SUBJ').textContent).toContain('Always');
    expect(box('AE').checked).toBe(true);
    expect(box('DATACHG').checked).toBe(false);
    expect(card('DATACHG').textContent).toContain('Large');
    expect(document.querySelector('.sb-status').textContent).toContain('downloads about 55 MB');
    expect(r.connect).not.toHaveBeenCalled();
  });

  it('keeps a domain another needs in the study, and says which needs it', () => {
    mounted();
    expect(card('VISIT').textContent).toContain('Needed by Vital signs');
    expect(box('VISIT').disabled).toBe(true);
    box('VS').click();
    expect(box('VISIT').disabled).toBe(false);
    box('VISIT').click();
    expect(handle.settings().domains).not.toContain('VISIT');
    box('OverallResponse').click();
    expect(box('VISIT').checked && box('VISIT').disabled).toBe(true);
  });

  it('fills in a typical size when the phase changes', () => {
    mounted();
    const phase = document.querySelector('[name="phase"]');
    phase.value = 'P1';
    phase.dispatchEvent(new Event('change'));
    expect(document.querySelector('[name="participants"]').value).toBe('40');
    expect(handle.settings().sites).toBe(4);
  });

  it('says what is wrong with the form and does not start R', async () => {
    const { r } = mounted();
    const sites = document.querySelector('[name="sites"]');
    sites.value = '900';
    sites.dispatchEvent(new Event('input'));
    expect(await handle.build()).toBeNull();
    expect(document.querySelector('[role="alert"]').textContent).toContain(
      'Sites must be a whole number from 2 to 100.'
    );
    expect(r.connect).not.toHaveBeenCalled();
  });

  it('builds on the press, shows each domain’s rows, and tells the page', async () => {
    const onBuilt = vi.fn();
    const { r } = mounted({ onBuilt });
    document.querySelector('[data-action="build"]').click();
    expect(handle.state().phase).toBe('building');
    expect(document.querySelector('[data-action="build"]').disabled).toBe(true);
    await vi.waitFor(() => expect(handle.state().phase).toBe('done'));
    expect(r.made[0].runs[0].name).toBe('builder_run');
    expect(document.querySelector('[data-built]').textContent).toContain(
      'BUILT-001 is a simulated Phase 2 Oncology study'
    );
    expect(card('AE').querySelector('.sb-rows').textContent).toBe('1 row');
    expect(card('SUBJ').querySelector('.sb-rows').textContent).toBe('2 rows');
    // A domain the study does not hold has no rows to show.
    expect(card('LB').querySelector('.sb-rows')).toBeNull();
    expect(document.querySelector('[data-standard="ae"]').textContent).toContain(
      'Made from Adverse events and Participants.'
    );
    expect(onBuilt).toHaveBeenCalledWith(handle.study());
  });

  it('shows a domain’s columns, types and first rows, and downloads it', async () => {
    const { saved } = mounted();
    await handle.build();
    document.querySelector('[data-details="raw:SUBJ"]').click();
    const panel = document.querySelector('.sb-detail');
    expect(panel.textContent).toContain('Raw_SUBJ.csv · 2 rows · 3 columns');
    const [columns, preview] = panel.querySelectorAll('table');
    expect([...columns.querySelectorAll('tbody tr')].map((row) => row.textContent)).toEqual([
      'studyidcharacter',
      'subjidcharacter',
      'agerepinteger'
    ]);
    expect([...preview.querySelectorAll('th')].map((th) => th.textContent)).toEqual([
      'studyid',
      'subjid',
      'agerep'
    ]);
    expect(preview.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(panel.textContent).toContain('All 2 rows');
    expect(card('SUBJ').dataset.open).toBe('true');
    panel.querySelector('[data-download]').click();
    expect(saved).toEqual([
      { name: 'Raw_SUBJ.csv', bytes: ANSWER.domains[0].text, type: 'text/csv' }
    ]);
    // Pressing it again hides the details.
    document.querySelector('[data-details="raw:SUBJ"]').click();
    expect(document.querySelector('.sb-detail')).toBeNull();
  });

  it('says where each column of a standard file came from', async () => {
    mounted();
    await handle.build();
    document.querySelector('[data-details="standard:ae"]').click();
    const rows = [...document.querySelectorAll('.sb-detail table')[0].querySelectorAll('tbody tr')];
    expect(rows.map((row) => [...row.children].map((cell) => cell.textContent))).toEqual([
      ['USUBJID', 'character', 'Raw_AE.subjid', 'Copied'],
      ['AESEV', 'character', 'Raw_AE.aetoxgr', 'Derived: the toxicity grade in words']
    ]);
  });

  it('hands the study to the page, and downloads every file as one zip', async () => {
    const onStudy = vi.fn();
    const { saved } = mounted({ onStudy, useLabel: 'Load into the demo' });
    expect(document.querySelector('[data-action="use"]')).toBeNull();
    await handle.build();
    const use = document.querySelector('[data-action="use"]');
    expect(use.textContent).toBe('Load into the demo');
    use.click();
    expect(onStudy).toHaveBeenCalledWith(handle.study());
    document.querySelector('[data-action="zip"]').click();
    expect(saved[0].name).toBe('BUILT-001.zip');
    expect(saved[0].type).toBe('application/zip');
    const text = new TextDecoder().decode(saved[0].bytes);
    for (const name of ['raw/Raw_SUBJ.csv', 'raw/Raw_AE.csv', 'standard/adae.csv']) {
      expect(text).toContain(name);
    }
  });

  it('makes its connection the page’s own way, with what R is to be given, on the first build', async () => {
    document.body.innerHTML = '<div id="b"></div>';
    const r = fakeR();
    handle = mount('#b', {
      base: './sb/',
      repository: './r-wasm',
      createConnection: r.connect
    });
    expect(r.connect).not.toHaveBeenCalled();
    await handle.build();
    const [options] = r.connect.mock.calls[0];
    expect(options.repos).toEqual(['./r-wasm', 'https://repo.r-wasm.org']);
    expect(options.files[0].url).toBe('./sb/r/builder.R');
    expect(typeof options.onStage).toBe('function');
    expect(handle.study().id).toBe('BUILT-001');
    // An R the page made is the page's to close.
    handle.destroy();
    handle = null;
    expect(r.made[0].close).not.toHaveBeenCalled();
  });

  it('has no hand-over button on a page that takes no study', async () => {
    mounted();
    await handle.build();
    expect(document.querySelector('[data-action="use"]')).toBeNull();
    expect(document.querySelector('[data-action="zip"]')).not.toBeNull();
  });

  it('says so when the settings have changed since the study was built', async () => {
    mounted();
    await handle.build();
    expect(document.querySelector('[data-stale]')).toBeNull();
    box('PK').click();
    expect(document.querySelector('[data-stale]').textContent).toContain(
      'The settings have changed since this study was built.'
    );
    box('PK').click();
    expect(document.querySelector('[data-stale]')).toBeNull();
  });

  it('says what R said when the build stops, and keeps the last study', async () => {
    let answer = { status: 'ok', value: ANSWER };
    mounted({}, () => answer);
    await handle.build();
    answer = { status: 'error', message: 'no visits' };
    expect(await handle.build()).toBeNull();
    expect(handle.state().phase).toBe('failed');
    expect(document.querySelector('[role="alert"]').textContent).toBe(
      'The study was not built. R said: no visits'
    );
    expect(handle.study().id).toBe('BUILT-001');
  });

  it('opens on the settings a page gives it', () => {
    mounted({ settings: { participants: 60, phase: 'P1', domains: ['AE'] }, theme: 'dark' });
    expect(document.querySelector('[name="participants"]').value).toBe('60');
    expect(handle.settings().domains).toEqual(['AE']);
    expect(box('LB').checked).toBe(false);
    expect(document.querySelector('.sb').dataset.theme).toBe('dark');
  });
});
