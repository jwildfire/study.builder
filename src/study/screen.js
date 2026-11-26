// The study view's screen: what the study is, what to do with it, and
// study.viewer to look through it, with the overview and the schedule as its
// first views.

import { PHASES } from '../engine/core.js';
import { zipOf } from '../engine/zip.js';
import { savedOf } from '../engine/saved.js';
import { protocolSaid } from '../engine/protocol.js';
import { mountViewer } from '../viewer/widget.js';
import { fromBuilt } from '../viewer/built.js';
import { count } from '../shared/dom.js';
import { design } from './design.js';
import { efficacy, efficacyResults } from './efficacy.js';
import { overview } from './overview.js';
import { pipeline } from './pipeline.js';
import { scheduleGrid } from './schedule.js';

/**
 * Draw the study view.
 * @param {Object} context `el` and `button` (from `domOf`), the `study`, and what the page around it allows: `studyOnly`, `theme`, `save`, `viewing`, `onChange`, `shelf`, `keep`, `onStudy`, `useLabel`, `listed`, `go`, `saidLine`.
 * @returns {{page: Element, viewer: Object}} The screen, and the viewer mounted in it.
 */
export function studyScreen(context) {
  const {
    el,
    button,
    study,
    studyOnly = false,
    theme = null,
    save,
    viewing = {},
    onChange = null,
    shelf = null,
    keep = null,
    onStudy = null,
    useLabel = 'Use this study',
    listed = () => false,
    go = () => {},
    saidLine = () => null
  } = context;
  const page = el('div', 'sb-screen');
  page.dataset.screen = 'study';
  page.dataset.built = study.id;
  // A page with its own list of studies shows the study alone: no head.
  if (!studyOnly) {
    const head = el('div', 'sb-head');
    const words = el('div');
    if (listed()) words.append(button('sb-link', '← Studies', () => go('library'), 'back'));
    const title = el('div', 'sb-title');
    const state = el(
      'span',
      'sb-pill',
      study.opened ? 'Opened, not built' : `Built in ${Number(study.seconds).toFixed(1)} s`
    );
    state.dataset.kind = study.opened ? 'saved' : 'ready';
    title.append(el('h2', null, study.id), state);
    if (study.manifest) {
      const key = el('span', 'sb-soft sb-key', `key ${study.manifest.key.slice(7, 15)}…`);
      key.title = 'The same tables always give the same key.';
      key.dataset.key = study.manifest.key;
      title.append(key);
    }
    words.append(title);
    const actions = el('div', 'sb-row');
    if (shelf && shelf.available) {
      actions.append(button('', 'Save', () => keep(savedOf(study), 'This study'), 'save-study'));
    }
    actions.append(
      button(
        '',
        'Study file',
        () => save(`${study.id}.study.json`, JSON.stringify(savedOf(study)), 'application/json'),
        'download-study'
      ),
      button(
        '',
        'Download all (.zip)',
        () => {
          const { layers } = study.files();
          save(
            `${study.id}.zip`,
            zipOf([
              { name: 'manifest.json', text: `${JSON.stringify(study.manifest, null, 2)}\n` },
              { name: 'metadata.json', text: `${JSON.stringify(study.metadata, null, 2)}\n` },
              ...Object.entries(layers).flatMap(([layer, files]) =>
                files.map((file) => ({ ...file, name: `${layer}/${file.name}` }))
              ),
              // The earlier snapshots, when they were kept, each in a folder of its date.
              ...(study.history || []).slice(0, -1).flatMap((entry) => {
                const then = entry.study();
                return then
                  ? Object.entries(then.files().layers).flatMap(([layer, files]) =>
                      files.map((file) => ({
                        ...file,
                        name: `snapshots/${entry.date}/${layer}/${file.name}`
                      }))
                    )
                  : [];
              })
            ]),
            'application/zip'
          );
        },
        'zip'
      )
    );
    if (typeof onStudy === 'function') {
      actions.append(button('sb-primary', useLabel, () => onStudy(study), 'use'));
    }
    head.append(words, actions);
    page.append(head);
  }

  // The snapshot that is shown: the last, unless the reader was at another.
  const kept = study.history || [];
  let shown = (viewing.snapshot && study.at && study.at(viewing.snapshot)) || study;
  let viewer = null;
  let where = { view: viewing.view, table: viewing.table };
  const tell = () => {
    if (typeof onChange !== 'function') return;
    onChange(kept.length > 1 ? { ...where, snapshot: shown.snapshotDate } : where);
  };

  const args = study.args;
  const facts = el('div', 'sb-facts-row');
  const phaseOf = PHASES.find((entry) => entry.id === args.phase);
  for (const fact of [
    phaseOf ? phaseOf.label : args.phase,
    args.therapeutic_area,
    count(args.participants, 'participant'),
    count(args.sites, 'site'),
    count(args.months, 'month'),
    args.seed === undefined ? 'No seed' : `Seed ${args.seed}`
  ]) {
    facts.append(el('span', 'sb-fact', String(fact)));
  }
  // A study that kept its monthly snapshots can be looked at as it stood at any.
  if (kept.length > 1) {
    const pick = el('label', 'sb-fact sb-snapshot');
    const select = el('select');
    select.name = 'snapshot';
    for (const entry of kept) {
      const option = el(
        'option',
        null,
        `${entry.date} · ${entry.number} of ${kept.length}${entry.problem ? ' · not built' : ''}`
      );
      option.value = entry.date;
      option.disabled = Boolean(entry.problem);
      option.selected = entry.date === shown.snapshotDate;
      if (entry.problem) option.title = entry.problem;
      select.append(option);
    }
    select.onchange = () => {
      const next = study.at(select.value);
      if (!next) return;
      shown = next;
      page.dataset.snapshot = shown.snapshotDate;
      viewer.setStudy(fromBuilt(shown), { keep: true });
      tell();
    };
    pick.append(el('span', null, 'Snapshot'), select);
    facts.append(pick);
  }
  page.dataset.snapshot = shown.snapshotDate;
  if (!studyOnly) {
    facts.append(button('sb-link', 'Change and rebuild', () => go('describe'), 'change'));
  }
  page.append(facts);
  const line = studyOnly ? null : saidLine();
  if (line) page.append(line);

  const holder = el('div', 'sb-viewer');
  page.append(holder);
  viewer = mountViewer(holder, {
    study: fromBuilt(shown),
    theme,
    save,
    view: viewing.view,
    table: viewing.table,
    views: [
      { id: 'overview', label: 'Overview', render: (box) => overview({ el }, shown, box, study) },
      // The protocol the build followed, when it followed one.
      ...(study.protocol
        ? [
            {
              id: 'schedule',
              label: 'Schedule',
              render: (box) => {
                box.append(
                  el(
                    'p',
                    'sb-soft',
                    `${study.protocol.title || study.protocol.name}: ${protocolSaid(study.protocol)}.`
                  ),
                  scheduleGrid({ el }, study.protocol)
                );
                // What the reader left out of the protocol file, as it says it.
                const left = study.protocol.notes || [];
                if (left.length) {
                  const notes = el('details', 'sb-caveats');
                  notes.dataset.notes = 'protocol';
                  notes.append(el('summary', null, 'What was left out of the protocol file'));
                  const lines = el('ul');
                  for (const line of left) lines.append(el('li', null, line));
                  notes.append(lines);
                  box.append(notes);
                }
              }
            }
          ]
        : []),
      // What else the protocol says: arms by epochs, objectives, endpoints, estimands.
      ...(study.protocol && study.protocol.design
        ? [
            {
              id: 'design',
              label: 'Design',
              render: (box) => design({ el }, study.protocol, box)
            }
          ]
        : []),
      // The efficacy score, when the study simulated one.
      ...(efficacyResults(study)
        ? [
            {
              id: 'efficacy',
              label: 'Efficacy',
              render: (box) => efficacy({ el }, shown, box)
            }
          ]
        : []),
      // What the study was asked to be, and the workflows that built it.
      {
        id: 'pipeline',
        label: 'Pipeline',
        render: (box) =>
          pipeline({ el, button }, shown, box, {
            save,
            open: (table) => {
              viewer.show('tables');
              viewer.open(table);
            }
          })
      }
    ],
    onChange: (at) => {
      where = at;
      tell();
    }
  });
  return { page, viewer };
}
