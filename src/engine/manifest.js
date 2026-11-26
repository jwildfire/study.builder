// A study's manifest: what is in it and what built it, with a checksum for
// every table and one for the whole study. Two builds with the same tables
// have the same key, whoever built them and whenever.
//
// It is modelled on the snapshot gsm.core v1.4.0 keeps of a gsm.datasim test
// data build (a digest for each object, the versions of the packages that
// built it, the settings of the simulation, and one fingerprint), with one
// addition: each table names its layer and what made it. It is study.builder's
// own format, named in `format`; it does not claim to be gsm.core's.

const hex = (buffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * A text's SHA-256, in hex.
 * @param {string} text The text.
 * @returns {Promise<string>} The checksum.
 */
export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  return hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
}

/** The manifest's format, by name and version. */
export const MANIFEST_FORMAT = 'study.builder/manifest/1';

/**
 * A study's manifest.
 * @param {Object} study What `studyOf` returned.
 * @returns {Promise<Object>} The manifest: `format`, `key`, `study`, `simulation`, `packages` and `tables`.
 */
export async function manifestOf(study) {
  const tables = [];
  for (const layer of study.layers) {
    for (const table of layer.tables) {
      tables.push({
        layer: layer.id,
        id: table.id,
        file: `${layer.id}/${table.name}`,
        rows: table.rows,
        columns: table.columns.length,
        made: { workflow: table.made.workflow, from: [...table.made.from] },
        sha256: await sha256(table.text)
      });
    }
  }
  // The key is of the tables alone: their layers, their names and their
  // checksums, in order. When and where the study was built is not in it.
  const lines = tables.map((table) => `${table.file}:${table.sha256}`);
  // A study that keeps its earlier snapshots is keyed by them too: each has a
  // key of its own, worked out the same way.
  const snapshots = [];
  for (const entry of (study.history || []).slice(0, -1)) {
    const then = entry.study();
    const key = then ? (await manifestOf(then)).key : `problem:${entry.problem}`;
    snapshots.push({ snapshot_date: entry.date, key });
    lines.push(`snapshot:${entry.date}:${key}`);
  }
  const key = await sha256(lines.join('\n'));
  return {
    format: MANIFEST_FORMAT,
    key: `sha256:${key}`,
    study: { id: study.id, snapshot_date: study.snapshotDate, snapshots: study.snapshots },
    simulation: { ...study.args },
    packages: { ...study.packages },
    ...(snapshots.length ? { snapshots } : {}),
    tables
  };
}
