// @vitest-environment jsdom
// The studies feed, the functions over it that need no page, and the picker.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STUDIES_FORMAT,
  describeStudy,
  factsLine,
  listStudies,
  openListed,
  readStudies,
  readTable
} from '../src/engine/studies.js';
import { mountPicker } from '../src/portfolio/picker.js';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEED = JSON.parse(readFileSync(path.join(here, 'studies/index.json'), 'utf8'));
const SCHEMA = JSON.parse(readFileSync(path.join(here, 'studies/studies.schema.json'), 'utf8'));
const answer = (body) => ({
  ok: true,
  json: async () => body,
  arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(body)).buffer
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the studies feed', () => {
  it('is one list of every kind, each entry with the names its schema requires and an id used once', () => {
    expect(FEED.format).toBe(STUDIES_FORMAT);
    expect(SCHEMA.properties.format.const).toBe(STUDIES_FORMAT);
    const kinds = new Set(FEED.studies.map((entry) => entry.kind));
    expect([...kinds].sort()).toEqual(SCHEMA.$defs.entry.properties.kind.enum.slice().sort());
    const ids = FEED.studies.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of FEED.studies) {
      for (const name of SCHEMA.$defs.entry.required) expect(entry).toHaveProperty(name);
      expect(entry.id).toMatch(new RegExp(SCHEMA.$defs.entry.properties.id.pattern));
      expect(entry.line).toBe(factsLine(entry));
      if (entry.kind === 'settings') expect(entry.settings.participants).toBeGreaterThan(0);
      else expect(entry.file.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('reads back with each file’s address made whole, and leaves out what is not whole', () => {
    const entries = readStudies(FEED, 'https://example.org/sb/studies/index.json');
    expect(entries).toHaveLength(FEED.studies.length);
    expect(entries.find((entry) => entry.id === 'protocol:cdisc-pilot').file.url).toBe(
      'https://example.org/sb/protocols/cdisc-pilot.protocol.json'
    );
    expect(entries[0]).toMatchObject({ kind: 'study', mark: 'Data ready' });
    expect(
      readStudies({
        format: STUDIES_FORMAT,
        studies: [{ id: 'a', kind: 'study', name: 'No file' }, { id: 'b', kind: 'other' }, null]
      })
    ).toEqual([]);
    expect(() => readStudies({ format: 'else' })).toThrow(/not a list of studies/);
  });

  it('is fetched, kept to the kinds asked for, and says so when it cannot be', async () => {
    const got = await listStudies('https://example.org/studies/index.json', {
      fetch: async () => answer(FEED),
      kinds: ['protocol']
    });
    expect(got.map((entry) => entry.kind)).toEqual(Array(5).fill('protocol'));
    await expect(
      listStudies('x', { fetch: async () => ({ ok: false, status: 404 }) })
    ).rejects.toThrow(/could not be fetched: the page answered 404/);
  });

  it('describes an entry as plain JSON', () => {
    const [entry] = readStudies(FEED);
    expect(describeStudy(entry)).toMatchObject({
      id: 'preset:phase1-small',
      opened: false,
      kind: 'study',
      line: 'Phase 1 · 40 participants · 4 sites · 6 months',
      mark: 'Data ready'
    });
    expect(() => describeStudy({})).toThrow(/neither an entry/);
  });

  it('opens a protocol only when the file is the one the feed names, and hands settings over as they are', async () => {
    const protocol = { format: 'study.builder/protocol/1', name: 'P' };
    const bytes = new TextEncoder().encode(JSON.stringify(protocol));
    const entry = {
      id: 'protocol:p',
      kind: 'protocol',
      name: 'P',
      file: { url: 'p.json', sha256: createHash('sha256').update(bytes).digest('hex') }
    };
    const options = { fetch: async () => answer(protocol), subtle: webcrypto.subtle };
    expect(await openListed(entry, options)).toEqual({ kind: 'protocol', protocol });
    await expect(
      openListed({ ...entry, file: { ...entry.file, sha256: 'f'.repeat(64) } }, options)
    ).rejects.toThrow(/not the file its list names/);
    await expect(openListed(entry, { ...options, subtle: null })).rejects.toThrow(
      /cannot be checked/
    );
    expect(await openListed({ id: 's', kind: 'settings', settings: { sites: 4 } })).toEqual({
      kind: 'settings',
      settings: { sites: 4 }
    });
  });

  it('reads one table of an open study as records, a page at a time', () => {
    const study = {
      table: (layer, id) =>
        layer === 'raw' && id === 'AE'
          ? { rows: 3, text: '"subjid","aeser"\n"S1","N"\n"S2","Y"\n"S3","N"\n' }
          : null
    };
    expect(readTable(study, 'raw', 'AE', { limit: 2, offset: 1 })).toEqual({
      layer: 'raw',
      id: 'AE',
      rows: 3,
      columns: ['subjid', 'aeser'],
      offset: 1,
      records: [
        { subjid: 'S2', aeser: 'Y' },
        { subjid: 'S3', aeser: 'N' }
      ]
    });
    expect(() => readTable(study, 'adam', 'ADSL')).toThrow(/no table ADSL/);
  });
});

describe('the study picker', () => {
  it('lists a line a study with its mark, tells the page the entry picked, and does nothing else', async () => {
    document.body.innerHTML = '<div id="p"></div>';
    const onPick = vi.fn();
    const handle = mountPicker('#p', { studies: FEED, onPick, picked: 'preset:phase2-oncology' });
    await handle.ready;
    const picks = [...document.querySelectorAll('.sb-pick')];
    expect(picks).toHaveLength(FEED.studies.length);
    expect(picks[0].querySelector('strong').textContent).toContain('Phase 1, small');
    expect(picks[0].querySelector('.sb-soft').textContent).toBe(
      'Phase 1 · 40 participants · 4 sites · 6 months'
    );
    expect(picks[0].querySelector('.sb-data').textContent).toBe('Data ready');
    expect(document.querySelector('[aria-pressed="true"]').dataset.pick).toBe(
      'preset:phase2-oncology'
    );
    // No heading, no file opening, no building.
    expect(document.querySelector('#p h2, #p h3, #p input, #p [data-action]')).toBeNull();
    document.querySelector('[data-pick="protocol:observational"]').click();
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0]).toMatchObject({
      id: 'protocol:observational',
      kind: 'protocol'
    });
    expect(handle.picked()).toBe('protocol:observational');
    handle.destroy();
    expect(document.querySelector('#p').textContent).toBe('');
  });

  it('fetches the feed from under its base, keeps the kinds asked for, and says when there is none', async () => {
    document.body.innerHTML = '<div id="p"></div>';
    const fetched = vi.fn(async () => answer(FEED));
    const handle = mountPicker('#p', {
      base: 'https://example.org/sb',
      kinds: ['study'],
      fetch: fetched
    });
    expect(document.querySelector('[role=status]').textContent).toBe('Fetching the studies…');
    await handle.ready;
    expect(fetched).toHaveBeenCalledWith('https://example.org/sb/studies/index.json');
    expect(handle.studies().map((entry) => entry.kind)).toEqual(['study', 'study', 'study']);
    handle.destroy();
    const none = mountPicker('#p', { fetch: async () => ({ ok: false, status: 500 }) });
    await none.ready;
    expect(document.querySelector('[role=status]').textContent).toMatch(/could not be fetched/);
  });
});
