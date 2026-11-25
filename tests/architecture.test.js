import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The three modules and what each may read (ARCHITECTURE.md). A module that
// reaches into another it may not is caught here, before it becomes a habit.

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const MAY_READ = {
  shared: [],
  engine: ['shared'],
  viewer: ['shared'],
  loader: ['shared', 'engine', 'viewer']
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

  it('the viewer’s bundle is built from the viewer alone', () => {
    const build = readFileSync(path.resolve(src, '../scripts/build.mjs'), 'utf8');
    expect(build).toContain('src/viewer/index.js');
  });
});
