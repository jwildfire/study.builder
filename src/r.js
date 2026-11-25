// A connection to R in the browser (webR) for study.builder. It starts
// nothing until it is first run. Then it imports webR from its host, starts
// R, installs the packages, fetches the files into R's own file system and
// evaluates the R source named. A run calls one R function and carries its
// answer back as plain values.
//
// A page that already has an R (safety.viz's demo app shares one between its
// tabs) hands study.builder its own connection instead: anything with a `run`
// of this shape will do.
//
//   run(name, { args }) resolves, and never rejects, to one of
//     { status: 'ok', value }                    R answered
//     { status: 'unavailable', message }         R did not start
//     { status: 'error', message }               R ran and stopped

/** The version of webR this is written for, and where it is fetched from. */
export const WEBR_VERSION = '0.6.0';
export const WEBR_BASE_URL = `https://webr.r-wasm.org/v${WEBR_VERSION}/`;

const importFromUrl = (url) => import(/* @vite-ignore */ url);
const messageOf = (error) =>
  (error && typeof error.message === 'string' && error.message) || String(error);

// R's answer crosses as JSON text: a table's text can be tens of megabytes,
// and text crosses whole where a deep list of R values is slow to walk.
const R_CALL = `
.sb_call <- function(name, args) {
  jsonlite::toJSON(do.call(name, args), auto_unbox = TRUE, null = "null", na = "null", digits = NA)
}`;

/** A file's folders, shallowest first: `/a/b/c.R` is `/a` then `/a/b`. */
export function foldersOf(file) {
  const parts = String(file).split('/').filter(Boolean).slice(0, -1);
  return parts.map((_, index) => `/${parts.slice(0, index + 1).join('/')}`);
}

/**
 * A connection to R in the browser.
 * @param {Object} [options]
 * @param {string} [options.baseUrl] Where webR is served from.
 * @param {string[]} [options.packages] R packages to install.
 * @param {string[]} [options.repos] The package repositories to install from, first one first. Relative addresses resolve against the page.
 * @param {Array<{path: string, url: string}>} [options.files] Files to put in R's file system: each fetched from its url.
 * @param {string[]} [options.source] Paths, among those files, of R source to evaluate.
 * @param {(stage: 'runtime'|'packages'|'files'|'source') => void} [options.onStage] Told each step of starting R as it begins.
 * @param {(url: string) => Promise<Object>} [options.importWebR] Something else to import webR with; used by the tests.
 * @param {(url: string) => Promise<Response>} [options.fetch] Something else to fetch the files with; used by the tests.
 * @returns {{run: Function, close: Function}} The connection.
 */
export function createConnection({
  baseUrl = WEBR_BASE_URL,
  packages = [],
  repos = [],
  files = [],
  source = [],
  onStage = null,
  importWebR = importFromUrl,
  fetch: fetchFile = (url) => globalThis.fetch(url)
} = {}) {
  let started = null;
  let live = null;
  const stage = (name) => {
    if (typeof onStage !== 'function') return;
    try {
      onStage(name);
    } catch {
      // What the page does with a step's name cannot stop R starting.
    }
  };

  async function start() {
    stage('runtime');
    const { WebR, ChannelType } = await importWebR(`${baseUrl}webr.mjs`);
    // The channel that needs no cross-origin isolation headers: a static host sends none.
    const webR = new WebR({ baseUrl, channelType: ChannelType.PostMessage });
    live = webR;
    await webR.init();
    if (packages.length) {
      stage('packages');
      const from = repos.map((repo) =>
        new URL(repo, globalThis.location?.href).href.replace(/\/$/, '')
      );
      // jsonlite carries the answer back, whatever else is asked for.
      await webR.installPackages([...new Set([...packages, 'jsonlite'])], {
        quiet: true,
        ...(from.length ? { repos: from } : {})
      });
    }
    if (files.length) stage('files');
    // Fetched side by side: there are dozens, each small.
    const texts = await Promise.all(
      files.map(async (file) => {
        const response = await fetchFile(file.url);
        if (!response.ok) throw new Error(`${file.url} answered ${response.status}`);
        return response.text();
      })
    );
    const encoder = new TextEncoder();
    const made = new Set();
    for (const [index, file] of files.entries()) {
      for (const folder of foldersOf(file.path)) {
        if (made.has(folder)) continue;
        made.add(folder);
        await webR.FS.mkdir(folder).catch(() => {});
      }
      await webR.FS.writeFile(file.path, encoder.encode(texts[index]));
    }
    await webR.evalRVoid(R_CALL);
    if (source.length) stage('source');
    for (const path of source) {
      await webR.evalRVoid(`source(${JSON.stringify(path)}, local = FALSE)`);
    }
    return webR;
  }

  function shut() {
    const webR = live;
    live = null;
    started = null;
    try {
      if (webR && typeof webR.close === 'function') webR.close();
    } catch {
      // Nothing to do: it is being let go of either way.
    }
  }

  return Object.freeze({
    /**
     * Ask R to call one function.
     * @param {string} name The R function.
     * @param {{args?: Object}} [request] Named arguments; an array becomes an R list.
     * @returns {Promise<Object>} The answer; it never rejects.
     */
    async run(name, { args = {} } = {}) {
      let webR;
      if (!started) started = start();
      const mine = started;
      try {
        webR = await mine;
      } catch (error) {
        // An R that could not be made ready is closed: the next run starts another.
        if (started === mine) shut();
        return { status: 'unavailable', message: messageOf(error) };
      }
      let shelter;
      try {
        shelter = await new webR.Shelter();
        const list = await new shelter.RList(args);
        const answer = await shelter.evalR('.sb_call(.sb_name, .sb_args)', {
          env: { '.sb_name': name, '.sb_args': list }
        });
        return { status: 'ok', value: JSON.parse(await answer.toString()) };
      } catch (error) {
        return { status: 'error', message: messageOf(error) };
      } finally {
        if (shelter) await shelter.purge().catch(() => {});
      }
    },
    /** Let go of R: the next run starts it again. */
    async close() {
      shut();
    }
  });
}
