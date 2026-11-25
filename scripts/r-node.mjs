// R under Node, given exactly what a page's R is given (`rOptions`), and asked
// for a study as a page asks: webR, gsm's own packages served from vendor/ on
// this machine, and r/builder.R. `npm run test:r` and `npm run presets` use it.
//
// It downloads R and its packages (about 55 MB) from webr.r-wasm.org and
// repo.r-wasm.org.

import { WebR } from 'webr';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGES, PUBLIC_INDEX, rOptions, studyOf } from '../src/build.js';
import { readSettings } from '../src/core.js';
import { foldersOf } from '../src/r.js';
import { manifestOf } from '../src/manifest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Start R.
 * @returns {Promise<{build: (settings: Object) => Promise<Object>, webR: Object, close: () => void}>} `build` makes a study as a page does.
 */
export async function startR() {
  // gsm's own packages, served as a package repository.
  const repo = path.join(root, 'vendor/r-wasm/repo');
  const server = http.createServer((request, response) => {
    const file = path.join(repo, decodeURIComponent(request.url.split('?')[0]));
    if (!file.startsWith(repo) || !existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200);
    createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const repository = `http://127.0.0.1:${server.address().port}`;

  const webR = new WebR({ interactive: false });
  await webR.init();
  await webR.installPackages([...PACKAGES, 'jsonlite'], {
    quiet: true,
    repos: [repository, PUBLIC_INDEX]
  });
  // The files a page fetches, read from the repository and written where R keeps them.
  const options = rOptions('./');
  for (const file of options.files) {
    for (const folder of foldersOf(file.path)) await webR.FS.mkdir(folder).catch(() => {});
    await webR.FS.writeFile(file.path, readFileSync(path.join(root, file.url)));
  }
  for (const source of options.source) {
    await webR.evalRVoid(`source(${JSON.stringify(source)}, local = FALSE)`);
  }

  /** Ask R for a study as a page does, and read the answer as a page does. */
  async function build(settings) {
    const read = readSettings(settings);
    if (!read.args) throw new Error(read.problems.join(' '));
    const args = {
      simulator: '/study.builder/vendor/gsm.datasim',
      ...(read.args.domains.includes('VS')
        ? { vitals: options.files.find((file) => file.path.endsWith('/VS.yaml')).path }
        : {}),
      ...(read.args.layers.includes('adam') ? { workflows: '/study.builder/workflows' } : {}),
      ...(read.args.layers.includes('analysis') ? { kri: '/study.builder/vendor/gsm.kri' } : {}),
      ...(read.args.layers.includes('reporting')
        ? { reporting: '/study.builder/vendor/gsm.reporting' }
        : {}),
      ...read.args,
      layers: ['raw', ...read.args.layers]
    };
    const shelter = await new webR.Shelter();
    try {
      const list = await new shelter.RList(args);
      const answer = await shelter.evalR(
        'jsonlite::toJSON(do.call(.name, .args), auto_unbox = TRUE, null = "null", na = "null", digits = NA)',
        { env: { '.name': 'builder_run', '.args': list } }
      );
      const study = studyOf(JSON.parse(await answer.toString()), read.args);
      study.manifest = await manifestOf(study);
      return study;
    } finally {
      await shelter.purge();
    }
  }

  return {
    build,
    webR,
    close() {
      server.close();
      webR.close();
    }
  };
}
