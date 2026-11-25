// Builds study.builder: the bundle into dist/ (committed), and the whole site
// into _site/ (gitignored): the bundle a page loads, as a
// script that defines `StudyBuilder` and as a module, the files R is given
// beside it, and the page that shows the builder on its own.
//
//   _site/study.builder.js       script tag: defines the global StudyBuilder
//   _site/study.builder.mjs      the same, as a module
//   _site/r/, _site/vendor/,     what R in the browser fetches
//   _site/workflows/
//   _site/index.html             the builder on a page of its own

import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

const shared = {
  entryPoints: [path.join(root, 'src/index.js')],
  bundle: true,
  minify: true,
  sourcemap: false,
  target: 'es2020',
  define: { __STUDY_BUILDER_VERSION__: JSON.stringify(version) },
  legalComments: 'none',
  write: false
};
const bundles = [
  ['study.builder.js', { format: 'iife', globalName: 'StudyBuilder' }],
  ['study.builder.mjs', { format: 'esm' }]
];
const built = new Map();
for (const [name, format] of bundles) {
  const result = await build({ ...shared, ...format, outfile: name });
  built.set(name, result.outputFiles[0].text);
}

// dist/ is committed, so a page or a package can take the bundle from a tag
// without building. `--check` fails when it is not what src/ builds to.
const dist = path.join(root, 'dist');
if (process.argv.includes('--check')) {
  const drifted = [...built].filter(([name, text]) => {
    try {
      return readFileSync(path.join(dist, name), 'utf8') !== text;
    } catch {
      return true;
    }
  });
  for (const [name] of drifted)
    console.error(`✗ dist/${name} is not what src/ builds to: run \`npm run build\`.`);
  if (drifted.length) process.exit(1);
  console.log('✓ dist/ is what src/ builds to.');
  process.exit(0);
}
mkdirSync(dist, { recursive: true });
for (const [name, text] of built) writeFileSync(path.join(dist, name), text);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const [name, text] of built) writeFileSync(path.join(out, name), text);

cpSync(path.join(root, 'r'), path.join(out, 'r'), { recursive: true });
cpSync(path.join(root, 'vendor'), path.join(out, 'vendor'), { recursive: true });
cpSync(path.join(root, 'workflows'), path.join(out, 'workflows'), { recursive: true });
// The presets a page offers: the list, and each hosted study.
mkdirSync(path.join(out, 'presets'), { recursive: true });
for (const name of readdirSync(path.join(root, 'presets'))) {
  if (name === 'index.json' || name.endsWith('.study.json.gz')) {
    cpSync(path.join(root, 'presets', name), path.join(out, 'presets', name));
  }
}
const page = readFileSync(path.join(root, 'site/index.html'), 'utf8').replaceAll(
  '{{version}}',
  version
);
writeFileSync(path.join(out, 'index.html'), page);
// GitHub Pages would otherwise run the folder through Jekyll.
writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`✓ Built _site/ — study.builder ${version}`);
