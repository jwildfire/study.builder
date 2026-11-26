// What the protocol says of the trial's design, drawn: what each arm gets in
// each epoch, then the objectives with their endpoints and the estimand. It
// shows what the protocol file holds and adds nothing; none of it is simulated
// beyond what the pills say.

import { designSaid, endpointLink } from '../engine/protocol.js';

/**
 * The Design view, for a study that followed a protocol with a design.
 * @param {{el: Function}} dom The maker of elements.
 * @param {Object} protocol The protocol the study followed.
 * @param {Element} box Where to draw.
 * @returns {void}
 */
export function design({ el }, protocol, box) {
  const said = protocol.design;
  const counts = designSaid(protocol);

  const tiles = el('ul', 'sb-tiles');
  for (const [value, label] of [
    [counts.arms, 'Arms'],
    [protocol.participants, 'Planned participants'],
    [counts.objectives, 'Objectives'],
    [counts.endpoints, 'Endpoints'],
    [counts.estimands, counts.estimands === 1 ? 'Estimand' : 'Estimands']
  ]) {
    if (value === null || value === undefined) continue;
    const tile = el('li', 'sb-tile');
    tile.append(
      el('span', 'sb-tile-value', Number(value).toLocaleString('en-US')),
      el('span', 'sb-tile-label', label)
    );
    tiles.append(tile);
  }
  box.append(tiles);

  // Arms by epochs: what each arm gets in each epoch.
  if (said.cells.length) {
    const kind = [said.model, said.blinding].filter(Boolean).join(', ');
    box.append(el('h4', 'sb-design-head', `Arms by epochs${kind ? ` · ${kind}` : ''}`));
    const wrap = el('div', 'sb-schedule');
    const grid = el('table', 'sb-grid sb-arms');
    const head = el('tr');
    const corner = el('th', null, 'Arm');
    corner.scope = 'col';
    head.append(corner);
    for (const epoch of said.epochs) {
      const th = el('th');
      th.scope = 'col';
      th.dataset.epoch = epoch.name;
      th.append(el('span', 'sb-grid-visit', epoch.name));
      // When the epoch is, from the visits the schedule puts in it.
      const days = protocol.visits
        .filter((visit) => visit.epoch === epoch.name)
        .map((visit) => visit.day);
      if (days.length) {
        const from = Math.min(...days);
        const to = Math.max(...days);
        th.append(el('small', null, from === to ? `Day ${from}` : `Day ${from} to ${to}`));
      }
      head.append(th);
    }
    const top = el('thead');
    top.append(head);
    const body = el('tbody');
    for (const arm of said.arms) {
      const row = el('tr');
      row.dataset.arm = arm.name;
      const name = el('th');
      name.scope = 'row';
      name.append(el('span', null, arm.name));
      if (arm.type) name.append(el('small', null, arm.type));
      row.append(name);
      for (const epoch of said.epochs) {
        const cell = el('td');
        const found = said.cells.find((one) => one.arm === arm.name && one.epoch === epoch.name);
        for (const element of found ? found.elements : []) {
          const chip = el('span', 'sb-element', element.name);
          if (element.about) {
            chip.title = element.about;
            chip.append(el('small', null, element.about));
          }
          cell.append(chip);
        }
        row.append(cell);
      }
      body.append(row);
    }
    grid.append(top, body);
    wrap.append(grid);
    box.append(wrap);
  }

  if (said.population.about) {
    const people = [
      said.population.about,
      said.population.sex ? `Sex: ${said.population.sex}` : '',
      said.population.completes ? `${said.population.completes} planned to complete` : ''
    ].filter(Boolean);
    box.append(el('p', 'sb-soft sb-design-people', `Population: ${people.join('. ')}.`));
  }

  // Objectives, each with its endpoints; an estimand sits under the endpoint it is of.
  if (said.objectives.length) {
    box.append(el('h4', 'sb-design-head', 'Objectives, endpoints and estimands'));
    const tree = el('div', 'sb-objectives');
    const pill = (words, kind) => {
      const made = el('span', 'sb-pill', words);
      if (kind) made.dataset.kind = kind;
      return made;
    };
    for (const objective of said.objectives) {
      const card = el('div', 'sb-objective');
      const primary = /primary/i.test(objective.level);
      card.dataset.level = primary ? 'primary' : 'other';
      card.append(
        pill(objective.level || 'Objective', primary ? '' : 'none'),
        el('p', null, objective.text)
      );
      const ends = el('ul', 'sb-endpoints');
      for (const endpoint of objective.endpoints) {
        const line = el('li', 'sb-endpoint');
        line.dataset.endpoint = endpoint.id;
        line.append(
          pill(endpoint.level || 'Endpoint', /primary/i.test(endpoint.level) ? 'saved' : 'none'),
          el('span', null, endpoint.text)
        );
        const link = endpointLink(protocol, endpoint.text);
        if (link.visits || link.simulated) {
          const where = link.visits ? ` · ${link.visits} visit${link.visits === 1 ? '' : 's'}` : '';
          const at = pill(
            `${link.simulated ? 'Simulated' : 'Scheduled, not simulated'}${where}`,
            link.simulated ? 'ready' : 'none'
          );
          at.dataset.link = link.simulated ? 'simulated' : 'scheduled';
          if (link.activity) at.title = `The activity ${link.activity} is on the schedule.`;
          line.append(at);
        }
        ends.append(line);
        for (const estimand of said.estimands.filter((one) => one.endpoint === endpoint.id)) {
          const facts = el('dl', 'sb-estimand');
          facts.dataset.estimand = estimand.name;
          const fact = (label, value) => {
            if (value) facts.append(el('dt', null, label), el('dd', null, value));
          };
          fact('Estimand', estimand.summary || estimand.name);
          fact('Population', estimand.population);
          fact('Treatment', estimand.interventions.join(', '));
          for (const event of estimand.events) {
            fact(`If: ${event.text || 'an intercurrent event'}`, event.strategy);
          }
          const under = el('li', 'sb-estimand-line');
          under.append(facts);
          ends.append(under);
        }
      }
      if (objective.endpoints.length) card.append(ends);
      tree.append(card);
    }
    box.append(tree);
    box.append(
      el(
        'p',
        'sb-soft',
        'The pills that say Simulated or Scheduled are study.builder’s reading: the protocol file does not join an endpoint to an activity, so they go by name. Everything else is as the file says it.'
      )
    );
  }
}
