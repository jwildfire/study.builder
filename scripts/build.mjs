// Builds study.builder into _site/ (gitignored): the bundle a page loads, as a
// script that defines `StudyBuilder` and as a module, the files R is given
// beside it, and the page that shows the builder on its own.
//
//   _site/study.builder.js       script tag: defines the global StudyBuilder
//   _site/study.builder.mjs      the same, as a module
//   _site/r/, _site/vendor/      what R in the browser fetches
//   _site/index.html             the builder on a page of its own

import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyProblems, filesModule } from './files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

const problems = copyProblems();
if (problems.length) {
  for (const problem of problems) console.error(`✗ ${problem}`);
  process.exit(1);
}
// The list of files R is given is always the records': written before bundling.
writeFileSync(path.join(root, 'src/files.js'), filesModule());

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const shared = {
  entryPoints: [path.join(root, 'src/index.js')],
  bundle: true,
  minify: true,
  sourcemap: false,
  target: 'es2020',
  define: { __STUDY_BUILDER_VERSION__: JSON.stringify(version) },
  legalComments: 'none'
};
await build({
  ...shared,
  format: 'iife',
  globalName: 'StudyBuilder',
  outfile: path.join(out, 'study.builder.js')
});
await build({ ...shared, format: 'esm', outfile: path.join(out, 'study.builder.mjs') });

cpSync(path.join(root, 'r'), path.join(out, 'r'), { recursive: true });
cpSync(path.join(root, 'vendor'), path.join(out, 'vendor'), { recursive: true });
const page = readFileSync(path.join(root, 'site/index.html'), 'utf8').replaceAll(
  '{{version}}',
  version
);
writeFileSync(path.join(out, 'index.html'), page);
// GitHub Pages would otherwise run the folder through Jekyll.
writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`✓ Built _site/ — study.builder ${version}`);
