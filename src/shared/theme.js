// Light or dark, taken from the page a widget sits in.
//
// A widget hosted in someone else's page must match that page, not the
// reader's system setting: a page that is always light, read on a computer set
// to dark, would otherwise get a dark widget on a light page. So the widget
// looks at what is painted behind it.

/**
 * Read a computed colour.
 * @param {string} value What `getComputedStyle` gave, such as `rgba(0, 0, 0, 0)`.
 * @returns {?{light: boolean}} Null when the colour is see-through or not understood.
 */
function painted(value) {
  const found = /^rgba?\(([^)]+)\)$/.exec(String(value || '').trim());
  if (!found) return null;
  const parts = found[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  const alpha = parts.length > 3 && !Number.isNaN(parts[3]) ? parts[3] : 1;
  if (alpha < 0.5) return null;
  const [red, green, blue] = parts;
  // Perceived brightness, 0 to 255.
  return { light: 0.299 * red + 0.587 * green + 0.114 * blue >= 128 };
}

/**
 * The theme of the page behind an element.
 * @param {Element} element The element the widget is drawn in.
 * @returns {?string} `light`, `dark`, or null when the page does not say (then the style sheet falls back to the reader's setting).
 */
export function hostTheme(element) {
  const doc = element && element.ownerDocument;
  const view = doc && doc.defaultView;
  if (!view || typeof view.getComputedStyle !== 'function') return null;
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    let colour = null;
    try {
      colour = painted(view.getComputedStyle(node).backgroundColor);
    } catch {
      colour = null;
    }
    if (colour) return colour.light ? 'light' : 'dark';
  }
  // Nothing is painted: the browser's own canvas shows. It is dark only when
  // the page allows dark and the reader asked for it.
  let scheme = '';
  try {
    scheme = view.getComputedStyle(doc.documentElement).colorScheme || '';
  } catch {
    scheme = '';
  }
  if (!scheme) return null;
  const asksDark =
    typeof view.matchMedia === 'function' &&
    view.matchMedia('(prefers-color-scheme: dark)').matches;
  return /dark/.test(scheme) && asksDark ? 'dark' : 'light';
}

/**
 * Tell a widget when the page's theme may have changed.
 * @param {Element} element The element the widget is drawn in.
 * @param {Function} changed Called with no arguments.
 * @returns {Function} Stops watching.
 */
export function watchHostTheme(element, changed) {
  const doc = element && element.ownerDocument;
  const view = doc && doc.defaultView;
  if (!view) return () => {};
  const stops = [];
  if (typeof view.matchMedia === 'function') {
    const query = view.matchMedia('(prefers-color-scheme: dark)');
    if (query && typeof query.addEventListener === 'function') {
      query.addEventListener('change', changed);
      stops.push(() => query.removeEventListener('change', changed));
    }
  }
  if (typeof view.MutationObserver === 'function') {
    // A page's own switch usually sets an attribute on the root or the body.
    const watcher = new view.MutationObserver(changed);
    const what = { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] };
    watcher.observe(doc.documentElement, what);
    if (doc.body) watcher.observe(doc.body, what);
    stops.push(() => watcher.disconnect());
  }
  return () => stops.forEach((stop) => stop());
}
