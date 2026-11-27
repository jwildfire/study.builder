// The study's pipeline, drawn: what the study was asked to be, then every
// workflow that built a table, in columns by layer. Pick a workflow and what
// it read and what reads it are marked, and it is shown as it is written: what
// it says of itself, its input spec and its steps. Everything here is read
// from the study; nothing is worked out but where things go.
//
// The layout follows workr's own workflow explorer (cards in columns by phase,
// a detail panel with the spec and the steps), which is now part of open.gismo.

import { PHASES, OUTLIERS } from '../engine/core.js';
import { configOf, settingsOfArgs } from '../engine/saved.js';

/**
 * A study's workflows, as cards: one for each raw table, and one for each
 * workflow that built tables off them, with what it read and what reads it.
 * @param {Object} study A built study, or one of its snapshots.
 * @returns {{layers: Array<{id: string, label: string, cards: Object[]}>, cards: Map<string, Object>}} The cards by layer, and by id. A card has `id`, `layer`, `name`, `about`, `tables`, `from` (table names), `reads` and `feeds` (card ids), and `definition` when the study carries one.
 */
export function pipelineOf(study) {
  const cards = new Map();
  const makes = new Map(); // a table's name → the card that makes it
  const layers = study.layers.map((layer) => {
    const mine = [];
    for (const table of layer.tables) {
      const workflow = layer.id === 'raw' ? table.table : table.made.workflow || table.table;
      const id = `${layer.id}:${workflow}`;
      let card = cards.get(id);
      if (!card) {
        card = {
          id,
          layer: layer.id,
          name: layer.id === 'raw' ? table.label || table.id : workflow.replace(/^[A-Za-z]+_/, ''),
          workflow: layer.id === 'raw' ? 'gsm.datasim (modified copy)' : workflow,
          about: '',
          tables: [],
          from: [],
          reads: [],
          feeds: [],
          definition: table.definition || null
        };
        cards.set(id, card);
        mine.push(card);
      }
      card.tables.push({
        key: `${layer.id}:${table.id}`,
        name: table.table || table.name,
        label: table.label || table.id,
        rows: table.rows
      });
      if (!card.about) card.about = table.about || table.grain || table.label || '';
      for (const name of table.made.from) if (!card.from.includes(name)) card.from.push(name);
      makes.set(table.table, id);
    }
    return { id: layer.id, label: layer.label, cards: mine };
  });
  for (const card of cards.values()) {
    for (const name of card.from) {
      const source = makes.get(name);
      if (!source || source === card.id) continue;
      if (!card.reads.includes(source)) card.reads.push(source);
      const other = cards.get(source);
      if (!other.feeds.includes(card.id)) other.feeds.push(card.id);
    }
  }
  return { layers, cards };
}

/** Every card a card is built from, or every card built from it, however far. */
function reach(cards, from, way) {
  const found = new Set();
  const walk = (id) => {
    for (const next of cards.get(id)[way]) {
      if (!found.has(next)) {
        found.add(next);
        walk(next);
      }
    }
  };
  walk(from);
  return found;
}

/**
 * The Pipeline view.
 * @param {{el: Function, button: Function}} dom The makers of elements.
 * @param {Object} study The study, or the snapshot of it, that is shown.
 * @param {Element} box Where to draw.
 * @param {{open?: (table: string) => void, save?: Function}} [can] What the page around it allows: opening a table in the Tables view, and saving a file.
 * @returns {void}
 */
export function pipeline({ el, button }, study, box, { open = null, save = null } = {}) {
  const { layers, cards } = pipelineOf(study);
  const args = study.args || {};
  let picked = null;

  // What the study was asked to be.
  const config = el('details', 'sb-config');
  config.open = true;
  config.append(el('summary', null, 'Study config: what this study was asked to be'));
  const facts = el('dl', 'sb-config-facts');
  const fact = (label, value) => {
    if (value === undefined || value === null || value === '') return;
    facts.append(el('dt', null, label), el('dd', null, String(value)));
  };
  const phase = PHASES.find((entry) => entry.id === args.phase);
  const outliers = OUTLIERS.find((entry) => entry.intensity === args.outlier_intensity);
  fact('Name', args.study_name);
  fact('Phase', phase ? phase.label : args.phase);
  fact('Therapeutic area', args.therapeutic_area);
  fact('Participants', args.participants);
  fact('Sites', args.sites);
  fact('Months', args.months);
  fact('Outliers', outliers ? outliers.label : args.outlier_intensity);
  fact('Seed', args.seed === undefined ? 'None: a different study each build' : args.seed);
  fact(
    'Snapshots kept',
    args.history ? `Every month (${study.snapshots})` : `The last of ${study.snapshots}`
  );
  fact('Raw domains', (args.domains || []).join(', '));
  fact('Layers', ['raw', ...(args.layers || [])].join(' → '));
  if (study.protocol) {
    const source = study.protocol.source || {};
    fact(
      'Protocol',
      `${study.protocol.name}${source.kind === 'usdm' ? `, read from CDISC USDM ${source.version || ''}` : ''}${source.edited ? ', changed in the form' : ''}`
    );
  }
  if (args.assumptions) {
    try {
      const assumed = JSON.parse(args.assumptions);
      if (assumed.dropout) {
        const byArm = Object.entries(assumed.dropout.arms || {})
          .map(([arm, rate]) => `${arm} ${rate}`)
          .join(', ');
        fact(
          'Leave early',
          `${assumed.dropout.rate} of enrolled participants by day ${assumed.dropout.day}${byArm ? `; by arm: ${byArm}` : ''}`
        );
      }
      if (assumed.events) {
        fact('Drug-type adverse events', `${assumed.events.ratio} times placebo on an active arm`);
      }
    } catch {
      // Assumptions that cannot be read back are left out.
    }
  }
  if (args.efficacy) {
    try {
      const [score] = JSON.parse(args.efficacy).scores;
      const effects = Object.entries(score.effects || {})
        .map(([arm, effect]) => `${arm} ${effect}`)
        .join(', ');
      fact(
        'Efficacy score',
        `${score.name}: baseline ${score.baseline}, standard deviation ${score.sd}, change on the reference arm ${score.change}${effects ? `; differences: ${effects}` : ''}`
      );
    } catch {
      // A score that cannot be read back is left out.
    }
  }
  const versions = Object.entries(study.packages || {})
    .map(
      ([name, version]) => `${name} ${version}${name === 'gsm.datasim' ? ' (a modified copy)' : ''}`
    )
    .join(', ');
  fact('Built with', versions);
  if (study.manifest) fact('Key', study.manifest.key);
  config.append(facts);
  if (typeof save === 'function') {
    const row = el('div', 'sb-row');
    row.append(
      button(
        '',
        'Settings file',
        () => {
          const settings = configOf(settingsOfArgs(args));
          save(
            `${settings.name}.settings.json`,
            `${JSON.stringify(settings, null, 2)}\n`,
            'application/json'
          );
        },
        'pipeline-settings'
      )
    );
    config.append(row);
  }
  box.append(config);

  const count = [...cards.values()].filter((card) => card.layer !== 'raw').length;
  box.append(
    el('h4', 'sb-design-head', 'Pipeline: every table, and the workflow that built it'),
    el(
      'p',
      'sb-soft',
      `Raw is simulated by a modified copy of gsm.datasim. ${count} workflow${count === 1 ? '' : 's'} built the rest, each from the tables before it. Pick one to see what it read, what reads it, and its steps.`
    )
  );

  const lanes = el('div', 'sb-pipeline');
  const detail = el('div', 'sb-workflow');
  detail.setAttribute('aria-live', 'polite');

  const drawDetail = () => {
    detail.replaceChildren();
    const card = picked ? cards.get(picked) : null;
    if (!card) return;
    const head = el('div', 'sb-workflow-head');
    const words = el('div');
    words.append(
      el('span', 'sb-workflow-layer', layers.find((layer) => layer.id === card.layer).label),
      el('h4', null, card.layer === 'raw' ? card.name : card.workflow)
    );
    if (card.about) words.append(el('p', 'sb-soft', card.about));
    head.append(
      words,
      button('sb-link', 'Close', () => pick(null), 'pipeline-close')
    );
    detail.append(head);

    const section = (title) => {
      const wrap = el('div', 'sb-workflow-section');
      wrap.append(el('h5', null, title));
      detail.append(wrap);
      return wrap;
    };
    const makes = section(
      card.tables.length === 1 ? 'Makes' : `Makes ${card.tables.length} tables`
    );
    const made = el('ul', 'sb-workflow-tables');
    for (const table of card.tables) {
      const line = el('li');
      line.append(
        el('code', null, table.name),
        el('span', 'sb-soft', `${Number(table.rows).toLocaleString('en-US')} rows`)
      );
      if (typeof open === 'function') {
        const go = button('sb-link', 'Open the table', () => open(table.key), 'pipeline-open');
        go.dataset.table = table.key;
        line.append(go);
      }
      made.append(line);
    }
    makes.append(made);

    if (card.layer === 'raw') {
      section('Made by').append(
        el(
          'p',
          'sb-soft',
          'Simulated by a modified copy of gsm.datasim (Gilead’s 2.1.0 with study designs and study results added for study.builder) from the study config above. No workflow: raw is the root every other layer is built from.'
        )
      );
    } else {
      const reads = section('Reads');
      const list = el('ul', 'sb-workflow-reads');
      for (const name of card.from) list.append(el('li', null, name));
      reads.append(list);
    }
    const definition = card.definition;
    if (definition) {
      if (definition.meta.length) {
        const meta = section('What the workflow says of itself');
        const grid = el('dl', 'sb-config-facts');
        for (const pair of definition.meta) {
          grid.append(el('dt', null, pair.key), el('dd', null, pair.value));
        }
        meta.append(grid);
      }
      if (definition.spec.length) {
        const spec = section('Input spec: the columns it needs');
        for (const one of definition.spec) {
          const line = el('p', 'sb-workflow-spec');
          line.append(el('code', null, one.table));
          for (const column of one.columns) {
            const chip = el(
              'span',
              'sb-fact',
              column.type ? `${column.name} · ${column.type}` : column.name
            );
            if (column.required) chip.title = 'Required';
            line.append(chip);
          }
          spec.append(line);
        }
      }
      if (definition.steps.length) {
        const steps = section(`Steps: ${definition.steps.length}, in order`);
        const ordered = el('ol', 'sb-workflow-steps');
        for (const step of definition.steps) {
          const item = el('li');
          const top = el('div', 'sb-workflow-step');
          top.append(
            el('code', null, step.output),
            el('span', 'sb-soft', '←'),
            el('code', null, step.name)
          );
          item.append(top);
          for (const pair of step.params) {
            const long = pair.value.length > 60 || pair.value.includes('\n');
            const param = el(long ? 'div' : 'p', 'sb-workflow-param');
            param.append(el('span', 'sb-soft', `${pair.key}:`));
            param.append(long ? el('pre', null, pair.value) : el('code', null, pair.value));
            item.append(param);
          }
          ordered.append(item);
        }
        steps.append(ordered);
      }
    } else if (card.layer !== 'raw') {
      section('Steps').append(
        el(
          'p',
          'sb-soft',
          'This study was built before workflows were kept with their tables. Build it again to see the steps.'
        )
      );
    }
  };

  const mark = () => {
    const up = picked ? reach(cards, picked, 'reads') : new Set();
    const down = picked ? reach(cards, picked, 'feeds') : new Set();
    for (const node of lanes.querySelectorAll('.sb-node')) {
      const id = node.dataset.card;
      const role = !picked
        ? ''
        : id === picked
          ? 'picked'
          : up.has(id)
            ? 'reads'
            : down.has(id)
              ? 'feeds'
              : 'other';
      if (role) node.dataset.role = role;
      else delete node.dataset.role;
      node.setAttribute('aria-pressed', String(id === picked));
    }
  };

  function pick(id) {
    picked = id === picked ? null : id;
    mark();
    drawDetail();
    if (picked && typeof detail.scrollIntoView === 'function') {
      detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  layers.forEach((layer, index) => {
    const lane = el('div', 'sb-lane');
    lane.dataset.layer = layer.id;
    const rows = layer.cards.reduce(
      (sum, card) => sum + card.tables.reduce((inner, table) => inner + table.rows, 0),
      0
    );
    const head = el('div', 'sb-lane-head');
    head.append(
      el('strong', null, `${index + 1} · ${layer.label}`),
      el(
        'span',
        'sb-soft',
        `${layer.cards.length} ${layer.id === 'raw' ? 'table' : 'workflow'}${layer.cards.length === 1 ? '' : 's'} · ${rows.toLocaleString('en-US')} rows`
      )
    );
    lane.append(head);
    for (const card of layer.cards) {
      const node = el('button', 'sb-node');
      node.type = 'button';
      node.dataset.card = card.id;
      node.setAttribute('aria-pressed', 'false');
      const total = card.tables.reduce((sum, table) => sum + table.rows, 0);
      node.append(
        el('strong', null, card.name),
        el(
          'span',
          'sb-soft',
          card.tables.length > 1
            ? `${card.tables.length} tables · ${total.toLocaleString('en-US')} rows`
            : `${total.toLocaleString('en-US')} rows`
        )
      );
      node.onclick = () => pick(card.id);
      lane.append(node);
    }
    lanes.append(lane);
  });
  const scroll = el('div', 'sb-pipeline-scroll');
  scroll.append(lanes);
  const legend = el('p', 'sb-soft sb-pipeline-legend');
  for (const [role, words] of [
    ['picked', 'Picked'],
    ['reads', 'It is built from'],
    ['feeds', 'Built from it']
  ]) {
    const key = el('span', 'sb-node-key', words);
    key.dataset.role = role;
    legend.append(key);
  }
  box.append(scroll, legend, detail);
}
