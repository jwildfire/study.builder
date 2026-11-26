// The study view, on a page by itself: one built study and nothing else.
//
//   StudyBuilder.mountStudy('#study', { study });
//
// It builds nothing and lists nothing, so it starts no R and reads no shelf.

import { injectStyles } from '../shared/styles.js';
import { watchHostTheme } from '../shared/theme.js';
import { domOf, saveFile, themed } from '../shared/dom.js';
import { studyScreen } from './screen.js';

/**
 * Draw one built study and nothing else: its facts in a line, then its
 * overview, its schedule when it followed a protocol, and its tables, columns
 * and participants. For a page that lists studies itself.
 * @param {string|Element} target The element, or a selector for it, to draw into.
 * @param {Object} options
 * @param {Object} options.study A built study, as `buildStudy` or `openStudy` gives one.
 * @param {?string} [options.theme] `light` or `dark`. Unless told, the widget matches the page behind it.
 * @param {{view: string, table: string}} [options.viewing] Where the study's views open.
 * @param {(at: Object) => void} [options.onView] Called as the reader moves between views and tables.
 * @param {(name: string, bytes: Uint8Array|string, type: string) => void} [options.save] Something else to save a file with.
 * @returns {{study: Function, state: Function, destroy: Function}} The handle.
 */
export function mountStudy(target, options = {}) {
  const { study, theme = null, viewing: opening = null, onView = null, save = saveFile } = options;
  if (!study) throw new Error('study.builder: mountStudy needs a study.');
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) throw new Error('study.builder: there is no element to mount into.');
  const doc = root.ownerDocument;
  injectStyles(doc);
  const { el, button } = domOf(doc);

  let viewing = { ...(opening || {}) };
  let destroyed = false;
  const shell = el('div', 'sb');
  themed(shell, theme, root);
  const { page, viewer } = studyScreen({
    el,
    button,
    study,
    studyOnly: true,
    theme,
    save,
    viewing,
    onChange: (at) => {
      viewing = at;
      if (typeof onView === 'function') onView(at);
    }
  });
  shell.append(page);
  root.textContent = '';
  root.append(shell);
  // The page can change its theme while the widget is open.
  const stopTheme = theme
    ? () => {}
    : watchHostTheme(root, () => {
        if (!destroyed) themed(shell, theme, root);
      });

  return {
    /** The study that is shown. */
    study: () => study,
    /** What is on the page. */
    state: () => ({ screen: 'study', viewing: { ...viewing } }),
    /** Empty the element. */
    destroy() {
      destroyed = true;
      stopTheme();
      viewer.destroy();
      root.textContent = '';
    }
  };
}
