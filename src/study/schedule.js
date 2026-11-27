// A protocol's schedule of activities, drawn. The study view reads it; the
// builder's form passes `edit` and the same grid takes changes.

import { ACTIVITY_DOMAINS } from '../engine/protocol.js';

/**
 * A protocol's schedule as a grid: a column a visit, a row an activity. In
 * the form the cells are ticks and a visit's day can be changed; on a study
 * it is read. `edit` is the form's: `change(fn)` changes the protocol, and
 * `disabled` is true while a build runs.
 */
export function scheduleGrid({ el }, protocol, edit = null) {
  const wrap = el('div', 'sb-schedule');
  const grid = el('table', 'sb-grid');
  const head = el('tr');
  const corner = el('th', null, 'Activity');
  corner.scope = 'col';
  head.append(corner);
  for (const visit of protocol.visits) {
    const th = el('th');
    th.scope = 'col';
    th.dataset.visit = visit.id;
    th.append(el('span', 'sb-grid-visit', visit.name));
    if (visit.epoch) th.append(el('small', null, visit.epoch));
    if (edit) {
      const day = el('input', 'sb-grid-day');
      day.type = 'number';
      day.name = `day-${visit.id}`;
      day.value = String(visit.day);
      day.setAttribute('aria-label', `Study day of ${visit.name}`);
      day.disabled = edit.disabled;
      day.onchange = () =>
        edit.change((next) => {
          next.visits.find((one) => one.id === visit.id).day = day.value;
        });
      th.append(day);
      const remove = el('button', 'sb-grid-remove', '✕');
      remove.type = 'button';
      remove.dataset.remove = visit.id;
      remove.setAttribute('aria-label', `Remove the visit ${visit.name}`);
      remove.disabled = edit.disabled;
      remove.onclick = () =>
        edit.change((next) => {
          next.visits = next.visits.filter((one) => one.id !== visit.id);
        });
      th.append(remove);
    } else {
      th.append(el('small', null, `Day ${visit.day}`));
    }
    const window = visit.before || visit.after ? `−${visit.before} / +${visit.after} days` : '';
    if (window) th.append(el('small', null, window));
    head.append(th);
  }
  const top = el('thead');
  top.append(head);
  const body = el('tbody');
  const at = new Set(Object.values(protocol.schedule).flat());
  // The activities that simulate something come first.
  const listed = protocol.activities
    .filter((activity) => at.has(activity.id) || edit)
    .sort((a, b) => Number(Boolean(b.domain)) - Number(Boolean(a.domain)));
  for (const activity of listed) {
    const row = el('tr');
    row.dataset.activity = activity.id;
    if (!activity.domain) row.dataset.simulated = 'false';
    const name = el('th');
    name.scope = 'row';
    name.append(el('span', null, activity.name));
    const domain = ACTIVITY_DOMAINS.find((one) => one.id === activity.domain);
    const pill = el('span', 'sb-pill', domain ? domain.label : 'Not simulated');
    pill.dataset.kind = domain ? 'ready' : 'none';
    name.append(pill);
    if (activity.collects.length) {
      name.title = `Collects: ${activity.collects.join(', ')}`;
      name.append(el('small', null, `${activity.collects.length} listed`));
    }
    row.append(name);
    for (const visit of protocol.visits) {
      const cell = el('td');
      const on = (protocol.schedule[visit.id] || []).includes(activity.id);
      if (edit) {
        const box = el('input');
        box.type = 'checkbox';
        box.checked = on;
        box.disabled = edit.disabled;
        box.setAttribute('aria-label', `${activity.name} at ${visit.name}`);
        box.onchange = () =>
          edit.change((next) => {
            const here = new Set(next.schedule[visit.id] || []);
            if (box.checked) here.add(activity.id);
            else here.delete(activity.id);
            next.schedule[visit.id] = [...here];
          });
        cell.append(box);
      } else if (on) {
        cell.textContent = '●';
        cell.setAttribute('aria-label', `${activity.name} at ${visit.name}`);
      }
      row.append(cell);
    }
    body.append(row);
  }
  grid.append(top, body);
  wrap.append(grid);
  // Whose protocol this is: said wherever its visits and activities are shown.
  const credit = attributionOf(protocol);
  if (credit) {
    const line = el('p', 'sb-soft sb-attribution', credit);
    line.dataset.attribution = 'protocol';
    wrap.append(line);
  }
  return wrap;
}

/** CDISC's attribution sentence, as the DDF-RA repository asks for it. */
export const CDISC_ATTRIBUTION =
  'Content based on DDF-RA (GitHub), https://github.com/cdisc-org/DDF-RA, used under the CC-BY-4.0 licence.';

/**
 * The attribution a protocol's source asks for, in a sentence, or '' when it
 * asks for none. A file of CDISC's made before the attribution travelled with
 * it is still given CDISC's.
 * @param {Object} protocol A protocol as read.
 * @returns {string} The sentence to show.
 */
export function attributionOf(protocol) {
  const source = (protocol && protocol.source) || {};
  if (source.attribution) return source.attribution;
  return String(source.file || '').includes('cdisc-org/DDF-RA') ? CDISC_ATTRIBUTION : '';
}
