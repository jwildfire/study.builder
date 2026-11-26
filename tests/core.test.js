import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AREAS,
  DEFAULTS,
  DEFAULT_DOMAINS,
  DEFAULT_LAYERS,
  DOMAINS,
  LAYERS,
  LIMITS,
  OUTLIERS,
  PHASES,
  STANDARD,
  readSettings,
  withLayerNeeds,
  withNeeds,
  withPhase,
  CAVEATS,
  PROFILE_SAID,
  profileSaid
} from '../src/engine/core.js';
import { PACKAGES } from '../src/engine/build.js';
import { firstRows } from '../src/shared/csv.js';
import { columnsOf, overviewOf } from '../src/engine/overview.js';
import { studyOf } from '../src/engine/build.js';
import { crc32, zipOf } from '../src/engine/zip.js';
import { COPIES, copyProblems, filesModule, workflowFiles } from '../scripts/files.mjs';
import { WORKFLOW_FILES } from '../src/engine/files.js';
import { parse as parseYaml } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const builderR = readFileSync(path.join(root, 'r/builder.R'), 'utf8');
const ownWorkflows = workflowFiles().map((file) =>
  parseYaml(readFileSync(path.join(root, file), 'utf8'))
);
const adamWorkflows = workflowFiles()
  .filter((file) => file.startsWith('workflows/adam/'))
  .map((file) => parseYaml(readFileSync(path.join(root, file), 'utf8')));
const listed = (name) =>
  [...builderR.match(new RegExp(`${name} <- c\\(([^)]*)\\)`))[1].matchAll(/"([^"]+)"/g)].map(
    (match) => match[1]
  );

describe('settings', () => {
  it('default to a study R accepts, with the default domains', () => {
    const { problems, args, domains } = readSettings();
    expect(problems).toEqual([]);
    expect(args).toEqual({
      study_name: 'BUILT-001',
      participants: 150,
      sites: 20,
      months: 9,
      outlier_intensity: 1,
      phase: 'P2',
      therapeutic_area: 'Oncology',
      domains: ['VISIT', 'AE', 'LB', 'VS', 'EG', 'PD', 'STUDCOMP', 'SDRGCOMP'],
      layers: ['raw.rbqm', 'adam', 'analysis', 'reporting']
    });
    expect(domains.slice(0, 4)).toEqual(['STUDY', 'SITE', 'SUBJ', 'ENROLL']);
  });

  it('take numbers as numbers or as the text a form field holds', () => {
    expect(readSettings({ participants: '200', sites: 15, months: ' 6 ' }).args).toMatchObject({
      participants: 200,
      sites: 15,
      months: 6
    });
  });

  it('send a seed only when one is given', () => {
    expect(readSettings().args).not.toHaveProperty('seed');
    expect(readSettings({ seed: '42' }).args.seed).toBe(42);
    expect(readSettings({ seed: '' }).args).not.toHaveProperty('seed');
  });

  it('bring the domain a chosen domain needs, and never send a core domain', () => {
    const { args, domains } = readSettings({ domains: ['VS', 'Death', 'SUBJ'] });
    expect(args.domains).toEqual(['VISIT', 'VS', 'STUDCOMP', 'Death']);
    expect(domains).toEqual([
      'STUDY',
      'SITE',
      'SUBJ',
      'ENROLL',
      'VISIT',
      'VS',
      'STUDCOMP',
      'Death'
    ]);
    expect(withNeeds(['OverallResponse'])).toContain('VISIT');
  });

  it('take the layers wanted besides raw, in the order they are shown, and refuse one they do not know', () => {
    expect(readSettings({ layers: ['adam', 'raw'] }).args.layers).toEqual(['adam']);
    // A layer made from another brings it.
    expect(readSettings({ layers: ['reporting'] }).args.layers).toEqual([
      'raw.rbqm',
      'adam',
      'analysis',
      'reporting'
    ]);
    expect(withLayerNeeds(['analysis'])).toEqual(['raw.rbqm', 'adam', 'analysis']);
    expect(readSettings({ layers: ['adam', 'raw.rbqm'] }).args.layers).toEqual([
      'raw.rbqm',
      'adam'
    ]);
    expect(readSettings({ layers: [] }).args.layers).toEqual([]);
    expect(readSettings({ layers: ['sdtm'] }).problems).toEqual([
      'Not a layer study.builder makes: sdtm.'
    ]);
  });

  it('name every problem, each in a sentence', () => {
    const { problems, args } = readSettings({
      participants: 501,
      sites: '1.5',
      months: '',
      name: ' ',
      phase: 'P9',
      area: 'Neurology',
      outliers: 'none',
      seed: '-3',
      domains: ['AE', 'XX']
    });
    expect(args).toBeNull();
    expect(problems).toEqual([
      'Participants must be a whole number from 20 to 500.',
      'Sites must be a whole number from 2 to 100.',
      'Months must be a whole number from 3 to 12.',
      'The study needs a name.',
      'Choose a phase.',
      'Choose a therapeutic area.',
      'Choose how many outliers.',
      'The seed must be a whole number, or left empty.',
      'Not a domain study.builder makes: XX.'
    ]);
  });

  it('refuse more sites than participants, and a study with no domain of its own', () => {
    expect(readSettings({ participants: 20, sites: 30 }).problems).toEqual([
      'Sites must be no more than participants.'
    ]);
    expect(readSettings({ domains: [] }).problems).toEqual([
      'Choose at least one domain besides the four every study has.'
    ]);
    expect(readSettings({ domains: ['SUBJ'] }).problems).toHaveLength(1);
  });

  it('fill in a typical size for a phase, within the limits', () => {
    expect(withPhase(DEFAULTS, 'P1')).toMatchObject({
      phase: 'P1',
      participants: 40,
      sites: 4,
      months: 6
    });
    expect(withPhase(DEFAULTS, 'P9')).toEqual(DEFAULTS);
    for (const phase of PHASES) {
      expect(readSettings(withPhase(DEFAULTS, phase.id)).problems, phase.id).toEqual([]);
    }
  });
});

describe('the page and R agree', () => {
  it('on the limits of each number', () => {
    for (const [field, { min, max }] of Object.entries(LIMITS)) {
      expect(builderR, field).toMatch(new RegExp(`${field} = c\\(${min}L, ${max}L\\)`));
    }
    const [, low, high] = builderR.match(/outlier_intensity = c\(([\d.]+), ([\d.]+)\)/);
    for (const entry of OUTLIERS) {
      expect(entry.intensity).toBeGreaterThanOrEqual(Number(low));
      expect(entry.intensity).toBeLessThanOrEqual(Number(high));
    }
  });

  it('on the domains: the core four, every optional one, and which needs which', () => {
    const ids = (pick) => DOMAINS.filter(pick).map((domain) => domain.id);
    expect(ids((domain) => domain.core)).toEqual(listed('builder_core'));
    expect(ids((domain) => !domain.core).sort()).toEqual(listed('builder_optional').sort());
    for (const domain of DOMAINS.filter((entry) => entry.needs)) {
      expect(builderR, domain.id).toMatch(new RegExp(`${domain.id} = "${domain.needs}"`));
    }
    // What R makes when it is told no domains is what the page ticks by default.
    const [, fallback] = builderR.match(/wanted <- if \(is\.null\(domains\)\) \{\s*c\(([^)]*)\)/);
    expect([...fallback.matchAll(/"([^"]+)"/g)].map((match) => match[1])).toEqual([
      ...DEFAULT_DOMAINS
    ]);
  });

  it('on the packages R attaches', () => {
    expect([...PACKAGES].sort()).toEqual(listed('builder_packages').sort());
  });

  it('on the layers built off raw', () => {
    const made = [...builderR.matchAll(/list\(id = "([a-z.]+)", label = "([^"]+)", type = /g)].map(
      (match) => [match[1], match[2]]
    );
    expect(made).toEqual(
      LAYERS.filter((layer) => layer.optional).map((layer) => [layer.id, layer.label])
    );
    expect(builderR).toContain('layers = c("raw.rbqm", "adam", "analysis", "reporting")');
    expect([...DEFAULT_LAYERS]).toEqual(['raw.rbqm', 'adam', 'analysis', 'reporting']);
    // And on which layer is made from which.
    for (const layer of LAYERS.filter((entry) => entry.needs)) {
      expect(builderR, layer.id).toContain(
        `${layer.id} = ${layer.needs.length > 1 ? `c(${layer.needs.map((id) => `"${id}"`).join(', ')})` : `"${layer.needs[0]}"`}`
      );
    }
  });

  it('on the standard files: each is an ADaM workflow’s table, made from the domain that feeds it', () => {
    for (const file of STANDARD) {
      const workflow = adamWorkflows.find((entry) => entry.meta.File === file.name);
      expect(workflow, file.name).toBeTruthy();
      expect(workflow.meta.Domain).toBe(file.id);
      expect(Object.keys(workflow.spec)).toContain(`Raw_${file.from}`);
      expect(DOMAINS.find((domain) => domain.id === file.from).feeds).toBe(file.id);
    }
  });

  it('on the phases and therapeutic areas gsm.datasim names', () => {
    const study = readFileSync(path.join(root, 'vendor/gsm.datasim/R/Raw_STUDY.R'), 'utf8');
    for (const area of AREAS) expect(study).toContain(`"${area}"`);
    for (const phase of PHASES) expect(study).toContain(`"${phase.id}"`);
  });
});

describe('the ADaM workflows', () => {
  it('are workr workflows: a type, an id, a spec of what they read, and steps', () => {
    expect(adamWorkflows.map((workflow) => workflow.meta.ID).sort()).toEqual([
      'ADAE',
      'ADEG',
      'ADLB',
      'ADQS',
      'ADSL',
      'ADVS'
    ]);
    for (const workflow of adamWorkflows) {
      expect(workflow.meta.Type).toBe('ADaM');
      expect(Object.keys(workflow.spec).length).toBeGreaterThan(0);
      expect(workflow.steps.length).toBeGreaterThan(0);
      // The last step writes the table the workflow is named for.
      expect(workflow.steps.at(-1).output).toBe(`ADaM_${workflow.meta.ID}`);
      // A query step names its table as workr asks, once.
      for (const step of workflow.steps.filter((entry) => entry.name === 'workr::RunQuery')) {
        expect(step.params.strQuery.match(/FROM df\b/g), workflow.meta.ID).toHaveLength(1);
      }
    }
  });

  it('say where every column they write came from, and no column they do not write', () => {
    for (const workflow of adamWorkflows) {
      const query = workflow.steps.at(-1).params.strQuery;
      // The columns the last query selects, by the names it gives them.
      // The select list, split at the commas that are not inside brackets;
      // the column an item writes is its last word.
      const list = query.slice('SELECT '.length, query.indexOf(' FROM '));
      const items = [];
      let depth = 0;
      let item = '';
      for (const char of list) {
        if (char === '(') depth += 1;
        if (char === ')') depth -= 1;
        if (char === ',' && depth === 0) {
          items.push(item);
          item = '';
        } else item += char;
      }
      items.push(item);
      const selected = items.map((entry) => entry.trim().split(' ').at(-1));
      expect(selected.length, workflow.meta.ID).toBeGreaterThan(5);
      expect(Object.keys(workflow.columns).sort(), workflow.meta.ID).toEqual(
        [...new Set(selected)].sort()
      );
      for (const line of Object.values(workflow.columns)) expect(line.how).toBeTruthy();
    }
  });

  it('read a join’s second table under a quoted key, which YAML would otherwise read as true', () => {
    for (const file of WORKFLOW_FILES) {
      const text = readFileSync(path.join(root, file), 'utf8');
      expect(text, file).not.toMatch(/^\s+y:/m);
    }
  });

  it('are listed in src/engine/files.js, so R is given every one', () => {
    expect([...WORKFLOW_FILES]).toEqual(workflowFiles());
  });
});

describe('study.builder’s workflows, of every layer', () => {
  it('give every column they write a label, and name the columns that are the table’s key', () => {
    expect(
      ownWorkflows.map((workflow) => `${workflow.meta.Type}_${workflow.meta.ID}`).sort()
    ).toEqual([
      'ADaM_ADAE',
      'ADaM_ADEG',
      'ADaM_ADLB',
      'ADaM_ADQS',
      'ADaM_ADSL',
      'ADaM_ADVS',
      'Analysis_AESummary',
      'Analysis_AESummaryByArm',
      'Analysis_EfficacySummary'
    ]);
    for (const workflow of ownWorkflows) {
      for (const [column, line] of Object.entries(workflow.columns)) {
        expect(line.label, `${workflow.meta.ID}.${column}`).toBeTruthy();
      }
      expect(workflow.meta.Keys.length, workflow.meta.ID).toBeGreaterThan(0);
      for (const key of workflow.meta.Keys) expect(Object.keys(workflow.columns)).toContain(key);
    }
  });
});

describe('the copies', () => {
  it('match their records, and src/engine/files.js lists what the records list', () => {
    expect(copyProblems()).toEqual([]);
    expect(readFileSync(path.join(root, 'src/engine/files.js'), 'utf8')).toBe(filesModule());
    expect(COPIES.map((copy) => copy.directory)).toEqual([
      'vendor/gsm.datasim',
      'vendor/gsm.mapping-vitals',
      'vendor/gsm.kri',
      'vendor/gsm.reporting'
    ]);
  });
});

describe('a preview', () => {
  it('reads the header and the first rows, quotes and all, and no more than asked', () => {
    const text = '"a","b"\n"x, y","say ""hi"""\n1,\n3,4\n';
    expect(firstRows(text, 2)).toEqual({
      header: ['a', 'b'],
      rows: [
        ['x, y', 'say "hi"'],
        ['1', '']
      ]
    });
    expect(firstRows('a,b\n1,2').rows).toEqual([['1', '2']]);
    expect(firstRows('')).toEqual({ header: [], rows: [] });
  });
});

describe('a zip file', () => {
  it('has the checksum zip files use', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('holds each file whole, stored, with a directory that finds it', () => {
    const files = [
      { name: 'raw/Raw_AE.csv', text: 'a,b\n1,2\n' },
      { name: 'standard/adae.csv', text: 'é\n' }
    ];
    const bytes = zipOf(files, new Date(2026, 10, 24, 12, 0, 0));
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const directory = view.getUint32(end + 16, true);
    expect(view.getUint32(directory, true)).toBe(0x02014b50);
    // The second entry's local header is where the directory says it is.
    const second = directory + 46 + view.getUint16(directory + 28, true);
    const offset = view.getUint32(second + 42, true);
    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    const nameLength = view.getUint16(offset + 26, true);
    const size = view.getUint32(offset + 18, true);
    const decoder = new TextDecoder();
    expect(decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength))).toBe(
      'standard/adae.csv'
    );
    expect(
      decoder.decode(bytes.slice(offset + 30 + nameLength, offset + 30 + nameLength + size))
    ).toBe('é\n');
  });
});

describe('a study’s overview', () => {
  const raw = (id, text, rows) => ({
    id,
    table: `Raw_${id}`,
    name: `Raw_${id}.csv`,
    rows,
    columns: text
      .split('\n')[0]
      .split(',')
      .map((name) => ({ name, type: 'character' })),
    text,
    made: { workflow: 'gsm.datasim', from: [] }
  });
  const study = studyOf(
    {
      study_id: 'OV-001',
      snapshot_date: '2012-06-30',
      snapshots: 6,
      layers: [
        {
          id: 'raw',
          label: 'Raw',
          tables: [
            raw('STUDY', 'studyid,phase,therapeutic_area,status\nOV-001,P3,Virology,Active\n', 1),
            raw('SITE', 'invid,Country\nSITE1,US\nSITE2,US\nSITE3,Japan\n', 3),
            raw(
              'SUBJ',
              'subjid,invid,enrollyn\nS1,SITE1,Y\nS2,SITE1,Y\nS3,SITE3,N\nS4,SITE9,Y\n',
              4
            ),
            raw('AE', 'subjid,aeser\nS1,Y\nS1,N\nS2,N\n', 3),
            raw('PD', 'subjid\nS1\n', 1)
          ]
        }
      ]
    },
    readSettings().args
  );

  it('says what the trial is and counts what it holds', () => {
    const said = overviewOf(study);
    expect(said.facts).toEqual([
      { label: 'Study', value: 'OV-001' },
      { label: 'Phase', value: 'P3' },
      { label: 'Therapeutic area', value: 'Virology' },
      { label: 'Status', value: 'Active' },
      { label: 'Snapshot', value: '2012-06-30' },
      { label: 'Monthly snapshots', value: '6' }
    ]);
    expect(said.counts).toEqual([
      { label: 'Participants', value: 4, note: '3 enrolled' },
      { label: 'Sites', value: 3, note: '2 countries' },
      { label: 'Adverse events', value: 3, note: '1 serious' },
      { label: 'Protocol deviations', value: 1 }
    ]);
    expect(said.layers).toEqual([{ id: 'raw', label: 'Raw', tables: 5, rows: 12 }]);
  });

  it('counts sites and participants by country, and says so when a site is not on the list', () => {
    expect(overviewOf(study).countries).toEqual([
      { country: 'US', sites: 2, participants: 2 },
      { country: 'Japan', sites: 1, participants: 1 },
      { country: 'Not recorded', sites: 0, participants: 1 }
    ]);
  });

  it('summarises a table’s columns, from its first rows when it is long', () => {
    const table = study.table('raw', 'SUBJ');
    expect(columnsOf(table).columns).toEqual([
      { name: 'subjid', type: 'character', filled: 1, distinct: 4, says: 'S1, S2, S3, S4' },
      { name: 'invid', type: 'character', filled: 1, distinct: 3, says: 'SITE1, SITE3, SITE9' },
      { name: 'enrollyn', type: 'character', filled: 1, distinct: 2, says: 'Y, N' }
    ]);
    expect(columnsOf(table, 2)).toMatchObject({ read: 2, of: 4 });
  });
});

describe('what a phase and an area change', () => {
  it('is said for every phase and area the form offers, and Phase 2 says nothing of its own', () => {
    expect(Object.keys(PROFILE_SAID.phases)).toEqual(PHASES.map((phase) => phase.id));
    expect(Object.keys(PROFILE_SAID.areas)).toEqual([...AREAS]);
    expect(PROFILE_SAID.phases.P2).toBe('');
    expect(profileSaid('P2', 'Inflammation')).toBe(PROFILE_SAID.areas.Inflammation);
    expect(profileSaid('P1', 'Oncology')).toBe(
      `${PROFILE_SAID.phases.P1} ${PROFILE_SAID.areas.Oncology}`
    );
    expect(profileSaid('P2', 'Nowhere')).toContain('nothing is changed');
  });

  it('is no longer called a label in what every study is said to be', () => {
    expect(CAVEATS.join(' ')).not.toContain('are labels');
    expect(CAVEATS.join(' ')).toContain('study profile');
  });
});
