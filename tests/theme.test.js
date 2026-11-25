// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hostTheme } from '../src/shared/theme.js';
import { mountViewer } from '../src/viewer/widget.js';

/** Paint the page: every element gets the background its `data-bg` names. */
function paint(scheme = '') {
  vi.spyOn(window, 'getComputedStyle').mockImplementation((node) => ({
    backgroundColor: node.dataset.bg || 'rgba(0, 0, 0, 0)',
    colorScheme: scheme
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.textContent = '';
  delete document.body.dataset.bg;
});

function holder() {
  const made = document.createElement('div');
  document.body.append(made);
  return made;
}

describe('the theme of the page behind a widget', () => {
  it('is light on a light page and dark on a dark one, whatever the reader set', () => {
    paint();
    const at = holder();
    document.body.dataset.bg = 'rgb(250, 250, 248)';
    expect(hostTheme(at)).toBe('light');
    document.body.dataset.bg = 'rgb(21, 25, 28)';
    expect(hostTheme(at)).toBe('dark');
  });

  it('looks past what is see-through to the nearest painted element', () => {
    paint();
    const at = holder();
    document.body.dataset.bg = 'rgb(21, 25, 28)';
    at.dataset.bg = 'rgba(255, 255, 255, 0)';
    expect(hostTheme(at)).toBe('dark');
    at.dataset.bg = 'rgba(255, 255, 255, 1)';
    expect(hostTheme(at)).toBe('light');
  });

  it('is light on an unpainted page that does not allow dark', () => {
    paint('light');
    expect(hostTheme(holder())).toBe('light');
  });

  it('says nothing when the page cannot be read', () => {
    paint();
    expect(hostTheme(holder())).toBe(null);
  });

  it('is what the viewer wears, unless the page names a theme', () => {
    paint();
    document.body.dataset.bg = 'rgb(250, 250, 248)';
    const study = { name: 'S', tables: [{ id: 'a', name: 'a.csv', text: 'x\n1\n' }] };
    const at = holder();
    const one = mountViewer(at, { study });
    expect(at.querySelector('.sv').dataset.theme).toBe('light');
    one.destroy();
    const told = mountViewer(at, { study, theme: 'dark' });
    expect(at.querySelector('.sv').dataset.theme).toBe('dark');
    told.destroy();
  });
});
