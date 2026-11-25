import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AREAS,
  DEFAULTS,
  DEFAULT_DOMAINS,
  DOMAINS,
  LIMITS,
  OUTLIERS,
  PHASES,
  STANDARD,
  readSettings,
  withNeeds,
  withPhase
} from '../src/core.js';
import { PACKAGES } from '../src/build.js';
import { firstRows } from '../src/csv.js';
import { crc32, zipOf } from '../src/zip.js';
import { COPIES, copyProblems, filesModule } from '../scripts/files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const builderR = readFileSync(path.join(root, 'r/builder.R'), 'utf8');
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
      domains: ['VISIT', 'AE', 'LB', 'VS', 'PD', 'STUDCOMP', 'SDRGCOMP']
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

  it('on the standard files and the domain each is made from', () => {
    for (const file of STANDARD) {
      expect(builderR, file.id).toContain(`id = "${file.id}", name = "${file.name}"`);
      expect(DOMAINS.find((domain) => domain.id === file.from).feeds).toBe(file.id);
    }
  });

  it('on the phases and therapeutic areas gsm.datasim names', () => {
    const study = readFileSync(path.join(root, 'vendor/gsm.datasim/R/Raw_STUDY.R'), 'utf8');
    for (const area of AREAS) expect(study).toContain(`"${area}"`);
    for (const phase of PHASES) expect(study).toContain(`"${phase.id}"`);
  });

  it('every standard column has a line saying where it came from', () => {
    for (const [frame, mapping] of [
      ['.builder_subject', '.builder_subject_mapping'],
      ['.builder_events', '.builder_events_mapping'],
      ['.builder_results', '.builder_results_mapping']
    ]) {
      const body = builderR.slice(builderR.indexOf(`${frame} <- function`));
      const made = [
        ...body.slice(0, body.indexOf('stringsAsFactors')).matchAll(/^\s{4,6}([A-Z]+) = /gm)
      ].map((match) => match[1]);
      const lines = builderR.slice(builderR.indexOf(`${mapping} <- list(`));
      const mapped = [
        ...lines.slice(0, lines.indexOf('\n)\n')).matchAll(/\.builder_line\("([A-Z]+)"/g)
      ].map((match) => match[1]);
      expect(made.length, frame).toBeGreaterThan(4);
      expect(mapped, frame).toEqual(made);
    }
  });
});

describe('the copies', () => {
  it('match their records, and src/files.js lists what the records list', () => {
    expect(copyProblems()).toEqual([]);
    expect(readFileSync(path.join(root, 'src/files.js'), 'utf8')).toBe(filesModule());
    expect(COPIES.map((copy) => copy.directory)).toEqual([
      'vendor/gsm.datasim',
      'vendor/gsm.mapping-vitals'
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
