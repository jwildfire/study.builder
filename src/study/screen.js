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
import { overview } from './overview.js';
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
              )
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
  if (!studyOnly) {
    facts.append(button('sb-link', 'Change and rebuild', () => go('describe'), 'change'));
  }
  page.append(facts);
  const line = studyOnly ? null : saidLine();
  if (line) page.append(line);

  const holder = el('div', 'sb-viewer');
  page.append(holder);
  const viewer = mountViewer(holder, {
    study: fromBuilt(study),
    theme,
    save,
    view: viewing.view,
    table: viewing.table,
    views: [
      { id: 'overview', label: 'Overview', render: (box) => overview({ el }, study, box) },
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
              }
            }
          ]
        : [])
    ],
    onChange: (at) => {
      if (typeof onChange === 'function') onChange(at);
    }
  });
  return { page, viewer };
}
