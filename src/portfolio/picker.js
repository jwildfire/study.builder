// The study picker: the studies feed as a list to pick from, a line a study,
// for a page that is not study.builder.
//
//   StudyBuilder.mountPicker('#pick', { onPick: (entry) => … });
//
// It picks and does nothing else: it opens no file, builds nothing and has no
// heading. The page is told the entry, and decides what a pick does (open it
// with `StudyBuilder.openListed(entry)`, say). Its look is the `--sb-`
// variables, which a page may set on the element it mounts into.

import { listStudies, readStudies } from '../engine/studies.js';
import { injectStyles } from '../shared/styles.js';
import { watchHostTheme } from '../shared/theme.js';
import { domOf, messageOf, themed } from '../shared/dom.js';

/**
 * Mount the picker.
 * @param {string|Element} target The element, or a selector for it, to draw into.
 * @param {Object} [options]
 * @param {string} [options.feed] The feed's address; `studies/index.json` under the base unless told.
 * @param {Object|Object[]} [options.studies] The feed itself, or its entries, when the page has them already: nothing is fetched.
 * @param {string[]} [options.kinds] The kinds to list: `study`, `settings`, `protocol`. All of them unless told.
 * @param {string} [options.picked] The id of the entry that is picked already.
 * @param {(entry: Object) => void} [options.onPick] Called with the entry the reader picks.
 * @param {string} [options.label] What the list is, for a screen reader.
 * @param {?string} [options.theme] `light` or `dark`. Unless told, the widget matches the page behind it.
 * @param {string} [options.base] Where study.builder's files are served.
 * @param {Function} [options.fetch] Something else to fetch with.
 * @returns {{studies: Function, picked: Function, pick: Function, ready: Promise, destroy: Function}} The handle.
 */
export function mountPicker(target, options = {}) {
  const {
    feed = null,
    studies: given = null,
    kinds = null,
    picked: opening = null,
    onPick = null,
    label = 'Studies',
    theme = null,
    base = './',
    fetch: get = globalThis.fetch
  } = options;
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) throw new Error('study.builder: there is no element to mount into.');
  const doc = root.ownerDocument;
  injectStyles(doc);
  const { el } = domOf(doc);

  let entries = [];
  let picked = opening;
  let said = 'Fetching the studies…';
  let destroyed = false;
  const kept = (list) =>
    Array.isArray(kinds) ? list.filter((one) => kinds.includes(one.kind)) : list;
  const shell = el('div', 'sb sb-picker');
  themed(shell, theme, root);

  function draw() {
    if (destroyed) return;
    shell.textContent = '';
    if (!entries.length) {
      const line = el('p', 'sb-soft sb-picker-said', said);
      line.setAttribute('role', 'status');
      shell.append(line);
      return;
    }
    const list = el('ul', 'sb-picker-list');
    list.setAttribute('aria-label', label);
    for (const entry of entries) {
      const item = el('li');
      const pick = el('button', 'sb-pick');
      pick.type = 'button';
      pick.dataset.pick = entry.id;
      pick.dataset.kind = entry.kind;
      pick.setAttribute('aria-pressed', String(entry.id === picked));
      const words = el('span', 'sb-pick-words');
      words.append(el('strong', null, entry.name), el('span', 'sb-soft', entry.line));
      const mark = el('span', 'sb-data', entry.mark);
      mark.dataset.data = entry.kind === 'study' ? 'ready' : entry.kind;
      pick.append(words, mark);
      pick.onclick = () => {
        picked = entry.id;
        draw();
        if (typeof onPick === 'function') onPick(entry);
      };
      item.append(pick);
      list.append(item);
    }
    shell.append(list);
  }

  root.textContent = '';
  root.append(shell);
  const withSlash = base.endsWith('/') ? base : `${base}/`;
  const ready = (async () => {
    try {
      if (Array.isArray(given)) entries = kept(given);
      else if (given) entries = kept(readStudies(given));
      else
        entries = await listStudies(feed || `${withSlash}studies/index.json`, {
          fetch: get,
          kinds
        });
      if (!entries.length) said = 'There are no studies to pick from.';
    } catch (error) {
      said = messageOf(error);
    }
    draw();
    return entries;
  })();
  draw();
  const stopTheme = theme
    ? () => {}
    : watchHostTheme(root, () => {
        if (!destroyed) themed(shell, theme, root);
      });

  return {
    /** The entries that are listed. */
    studies: () => [...entries],
    /** The id of the entry that is picked, or null. */
    picked: () => picked,
    /** Mark an entry as picked, as the page says; the page is not told. */
    pick(id) {
      picked = id;
      draw();
    },
    /** Resolves to the entries once the feed is read. */
    ready,
    /** Empty the element. */
    destroy() {
      destroyed = true;
      stopTheme();
      root.textContent = '';
    }
  };
}
