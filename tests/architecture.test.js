import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The source folders and what each may read (ARCHITECTURE.md). A folder that
// reaches into another it may not is caught here, before it becomes a habit.
// The three modules a reader uses are portfolio, study and builder; app is
// the page that moves between them.

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const MAY_READ = {
  shared: [],
  engine: ['shared'],
  viewer: ['shared'],
  study: ['shared', 'engine', 'viewer'],
  portfolio: ['shared', 'engine'],
  builder: ['shared', 'engine', 'study'],
  app: ['shared', 'engine', 'portfolio', 'study', 'builder']
};

const importsOf = (file) =>
  [...readFileSync(file, 'utf8').matchAll(/from '(\.{1,2}\/[^']+)'/g)].map((match) => match[1]);

describe('the modules keep to themselves', () => {
  for (const [module, allowed] of Object.entries(MAY_READ)) {
    it(`${module} reads only ${allowed.length ? `itself, ${allowed.join(' and ')}` : 'itself'}`, () => {
      const folder = path.join(src, module);
      const strays = [];
      for (const name of readdirSync(folder)) {
        for (const from of importsOf(path.join(folder, name))) {
          const target = path.relative(src, path.resolve(folder, from)).split(path.sep)[0];
          if (target !== module && !allowed.includes(target)) strays.push(`${name} → ${from}`);
        }
      }
      expect(strays).toEqual([]);
    });
  }

  it('every folder under src is one of them', () => {
    const folders = readdirSync(src, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(folders.sort()).toEqual(Object.keys(MAY_READ).sort());
  });

  it('the study view starts no R: it never reads the engine’s build', () => {
    for (const name of readdirSync(path.join(src, 'study'))) {
      const reads = importsOf(path.join(src, 'study', name));
      expect(reads.filter((from) => /engine\/(build|r)\.js$/.test(from))).toEqual([]);
    }
  });

  it('the viewer’s bundle is built from the viewer alone', () => {
    const build = readFileSync(path.resolve(src, '../scripts/build.mjs'), 'utf8');
    expect(build).toContain('src/viewer/index.js');
  });
});

describe('the builder makes no data', () => {
  // Every row is gsm.datasim's. What study.builder's R still makes or changes
  // is fenced, to be moved; outside the fence it only asks, runs workflows and
  // writes tables out as text.
  const r = readFileSync(path.resolve(src, '../r/builder.R'), 'utf8');
  const begin = '# ==== TO MOVE TO gsm.datasim: begin ====';
  const end = '# ==== TO MOVE TO gsm.datasim: end ====';

  it('what makes or changes a table is inside the fence, and nowhere else', () => {
    expect(r.split(begin)).toHaveLength(2);
    expect(r.split(end)).toHaveLength(2);
    const outside = r.slice(0, r.indexOf(begin)) + r.slice(r.indexOf(end));
    const code = outside
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    for (const making of [
      'data.frame(',
      'sample(',
      'sample.int(',
      'rbind(',
      'rnorm(',
      'runif(',
      '$phase <-'
    ]) {
      expect(
        code.replaceAll('is.data.frame(', '').replaceAll('as.data.frame(', ''),
        making
      ).not.toContain(making);
    }
  });

  it('the fence lists the pieces it holds, and holds no others', () => {
    const inside = r.slice(r.indexOf(begin), r.indexOf(end));
    const defined = [...inside.matchAll(/^(\.builder_[a-z_]+) <- function/gm)].map((m) => m[1]);
    expect(defined.sort()).toEqual([
      '.builder_gsm_names',
      '.builder_site_id',
      '.builder_site_ids',
      '.builder_study',
      '.builder_vitals'
    ]);
  });
});
