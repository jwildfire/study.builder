// The protocol the study followed, in full: what it is and where it was read
// from, the design it sets out, the activities it schedules and which of them
// are simulated, and what the reader left out. It shows what the protocol file
// holds; the Schedule view beside it has the visits by activities.

import { PHASES } from '../engine/core.js';
import { protocolSaid } from '../engine/protocol.js';
import { design } from './design.js';

/**
 * The Protocol view, for a study that followed a protocol.
 * @param {{el: Function}} dom The maker of elements.
 * @param {Object} protocol The protocol the study followed.
 * @param {Element} box Where to draw.
 * @returns {void}
 */
export function protocolView({ el }, protocol, box) {
  const name = protocol.title || protocol.name;
  box.append(el('h4', 'sb-design-head sb-protocol-name', name));
  if (protocol.title && protocol.name && protocol.name !== protocol.title) {
    box.append(el('p', 'sb-soft', protocol.name));
  }

  // What the file says of the trial, and where the file is from.
  const facts = el('dl', 'sb-protocol-facts');
  const fact = (label, value) => {
    if (value === null || value === undefined || value === '') return;
    facts.append(el('dt', null, label), el('dd', null, String(value)));
  };
  const phase = PHASES.find((entry) => entry.id === protocol.phase);
  const source = protocol.source || {};
  fact('Phase', phase ? phase.label : protocol.phase);
  fact('Indication', protocol.indication);
  fact(
    'Planned participants',
    protocol.participants ? Number(protocol.participants).toLocaleString('en-US') : ''
  );
  fact('Arms', (protocol.arms || []).join(', '));
  fact('Epochs', (protocol.epochs || []).join(', '));
  fact('Schedule', protocolSaid(protocol));
  fact(
    'Read from',
    [source.file, source.kind && `${String(source.kind).toUpperCase()} ${source.version || ''}`]
      .filter(Boolean)
      .map((part) => String(part).trim())
      .join(' · ')
  );
  fact('Timeline', source.timeline);
  fact('Licence', source.license);
  box.append(facts);

  // Arms by epochs, the population, and the objectives with their endpoints.
  if (protocol.design) design({ el }, protocol, box);

  // The activities the schedule names, and which the simulator makes data for.
  const activities = protocol.activities || [];
  if (activities.length) {
    const made = activities.filter((activity) => activity.domain);
    box.append(
      el('h4', 'sb-design-head', `Activities · ${made.length} of ${activities.length} simulated`)
    );
    const list = el('ul', 'sb-activities');
    for (const activity of [...made, ...activities.filter((one) => !one.domain)]) {
      const line = el('li', 'sb-activity');
      line.dataset.activity = activity.name;
      const pill = el('span', 'sb-pill', activity.domain || 'Not simulated');
      if (activity.domain) pill.dataset.link = 'simulated';
      else pill.dataset.kind = 'none';
      line.append(pill, el('span', null, activity.name));
      list.append(line);
    }
    box.append(list);
  }

  // What the reader left out of the protocol file, as it says it.
  const left = protocol.notes || [];
  if (left.length) {
    box.append(el('h4', 'sb-design-head', 'What was left out of the protocol file'));
    const notes = el('ul', 'sb-protocol-notes');
    notes.dataset.notes = 'protocol';
    for (const line of left) notes.append(el('li', null, line));
    box.append(notes);
  }
}
