// Small things every screen draws with.

import { hostTheme } from './theme.js';

/** `3 sites`, `1 site`. */
export const count = (number, noun) =>
  `${Number(number).toLocaleString('en-US')} ${noun}${Number(number) === 1 ? '' : 's'}`;

/** What an error says. */
export const messageOf = (error) => (error && error.message ? error.message : String(error));

/**
 * The two makers every screen uses.
 * @param {Document} doc The document to make elements in.
 * @returns {{el: Function, button: Function}} `el(tag, className, text)` and `button(className, label, onClick, action)`.
 */
export function domOf(doc) {
  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (className, label, onClick, action) => {
    const made = el('button', `sb-button${className ? ` ${className}` : ''}`, label);
    made.type = 'button';
    made.onclick = onClick;
    if (action) made.dataset.action = action;
    return made;
  };
  return { el, button };
}

/**
 * Light or dark: what the page said, else what the page behind looks like.
 * @param {Element} shell The widget's outer element.
 * @param {?string} theme `light`, `dark`, or null to match the page.
 * @param {Element} root The element the widget is drawn in.
 * @returns {void}
 */
export function themed(shell, theme, root) {
  const shown = theme || hostTheme(root);
  if (shown) shell.dataset.theme = shown;
  else delete shell.dataset.theme;
}

/**
 * Save a file from the page: a link with the bytes behind it, pressed.
 * @param {string} name The file's name.
 * @param {Uint8Array|string} bytes What it holds.
 * @param {string} type Its media type.
 * @returns {void}
 */
export function saveFile(name, bytes, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
