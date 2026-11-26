// Builds a study on every copied example protocol with real R, and holds each
// to its own schedule. `npm run test:r` holds the pilot protocol closely; this
// holds all of them to what any protocol must come to.
//
//   npm run test:r:protocols
//
// It downloads R and its packages as `npm run test:r` does.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMITS } from '../src/engine/core.js';
import { designSaid, planOf, protocolSettings, readUsdm } from '../src/engine/protocol.js';
import { firstRows } from '../src/shared/csv.js';
import { startR } from './r-node.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'vendor/cdisc-ddf-ra');
const record = JSON.parse(readFileSync(path.join(folder, 'SOURCE.json'), 'utf8'));
const failures = [];
const check = (what, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : `: ${detail}`}`);
  if (!ok) failures.push(what);
};

const started = Date.now();
const { build, close } = await startR();
console.log(`R is ready (${Math.round((Date.now() - started) / 1000)} s).`);

const column = (table, name) => {
  const at = table.header.indexOf(name);
  return table.rows.map((row) => row[at]);
};

for (const { file } of record.files) {
  const usdm = JSON.parse(readFileSync(path.join(folder, file), 'utf8'));
  const design = usdm.study.versions[0].studyDesigns[0];
  const protocol = readUsdm(usdm);
  const planned = planOf(protocol);
  const { settings } = protocolSettings(protocol, LIMITS);
  let study;
  try {
    study = await build({ ...settings, participants: 40, sites: 4, seed: 11, protocol });
  } catch (error) {
    check(`${file}: builds a study on its schedule`, false, error.message);
    continue;
  }
  const has = (id) => Boolean(study.table('raw', id));
  check(
    `${file}: builds a study on its schedule, through every layer`,
    study.layers.length === 5 && study.table('adam', 'ADSL').rows > 0,
    study.layers.map((layer) => `${layer.id} ${layer.tables.length}`).join(', ')
  );

  // Every visit made is one the schedule names, and the first one is there.
  const visits = firstRows(study.table('raw', 'VISIT').text, Infinity);
  const names = new Set(column(visits, 'visit'));
  check(
    `${file}: every visit made is one of its ${planned.length} planned visits, the first among them`,
    [...names].every((name) => planned.some((visit) => visit.name === name)) &&
      names.has(planned[0].name),
    [...names].filter((name) => !planned.some((visit) => visit.name === name)).join(', ')
  );

  // Each visit of an enrolled participant is on its planned day, within its window.
  const subjects = firstRows(study.table('raw', 'SUBJ').text, Infinity);
  const dayOne = Object.fromEntries(
    subjects.rows.map((row) => [
      row[subjects.header.indexOf('subjid')],
      row[subjects.header.indexOf('firstdosedate')] || row[subjects.header.indexOf('enrolldt')]
    ])
  );
  const [subjAt, nameAt, dateAt] = ['subjid', 'visit', 'visit_dt'].map((name) =>
    visits.header.indexOf(name)
  );
  const timed = visits.rows
    .filter((row) => dayOne[row[subjAt]])
    .map((row) => {
      const visit = planned.find((one) => one.name === row[nameAt]);
      const days = Math.round((new Date(row[dateAt]) - new Date(dayOne[row[subjAt]])) / 864e5);
      const offset = visit.day > 0 ? visit.day - 1 : visit.day;
      return days - offset >= -visit.before && days - offset <= visit.after;
    });
  check(
    `${file}: every visit is on its planned day, within its window`,
    timed.length > 0 && timed.every(Boolean),
    `${timed.filter((ok) => !ok).length} of ${timed.length} outside`
  );

  // Vital signs and labs only where the schedule has them.
  const takes = new Set(planned.filter((visit) => visit.vs).map((visit) => visit.name));
  const draws = new Set(planned.filter((visit) => visit.lb.length).map((visit) => visit.name));
  if (takes.size) {
    const at = new Set(column(firstRows(study.table('raw', 'VS').text, Infinity), 'visit'));
    check(
      `${file}: vital signs are taken only at the ${takes.size} visits that take them`,
      at.size > 0 && [...at].every((name) => takes.has(name)),
      [...at].filter((name) => !takes.has(name)).join(', ')
    );
  } else {
    check(`${file}: no visit takes vital signs, and none are made`, !has('VS'));
  }
  if (draws.size) {
    const at = new Set(column(firstRows(study.table('raw', 'LB').text, Infinity), 'visnam'));
    check(
      `${file}: labs are drawn only at the ${draws.size} visits that draw them`,
      at.size > 0 && [...at].every((name) => draws.has(name)),
      [...at].filter((name) => !draws.has(name)).join(', ')
    );
  } else {
    check(`${file}: no visit draws labs, and none are made`, !has('LB'));
  }

  // The arms are the protocol's, and the design is counted as the file has it.
  const arms = new Set(column(subjects, 'arm').filter(Boolean));
  check(
    `${file}: participants are in the protocol's own arms`,
    arms.size > 0 && [...arms].every((arm) => protocol.arms.includes(arm)),
    [...arms].join(', ')
  );
  const counted = designSaid(study.protocol);
  const objectives = design.objectives || [];
  check(
    `${file}: the study keeps the protocol's design as the file has it`,
    counted &&
      counted.arms === design.arms.length &&
      counted.epochs === design.epochs.length &&
      counted.objectives === objectives.length &&
      counted.endpoints ===
        objectives.reduce((sum, objective) => sum + (objective.endpoints || []).length, 0) &&
      counted.estimands === (design.estimands || []).length &&
      study.protocol.design.cells.length === design.studyCells.length,
    JSON.stringify(counted)
  );
}

close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nEvery check passed (${Math.round((Date.now() - started) / 1000)} s).`);
