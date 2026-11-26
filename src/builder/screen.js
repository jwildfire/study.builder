// The study builder: the form. The trial, its schedule when it follows a
// protocol, its layers as the pipeline they are, its raw domains, and what
// building it will give.

import {
  AREAS,
  DOMAINS,
  LAYERS,
  LIMITS,
  OUTLIERS,
  PHASES,
  ASSUMED,
  SNAPSHOTS,
  readAssumptions,
  readEfficacy,
  readSettings,
  referenceArm,
  withLayerNeeds,
  withNeeds,
  withPhase
} from '../engine/core.js';
import { DOWNLOADS } from '../engine/build.js';
import { configOf } from '../engine/saved.js';
import {
  efficacyOf,
  planOf,
  protocolSaid,
  protocolSettings,
  readProtocol
} from '../engine/protocol.js';
import { scheduleGrid } from '../study/schedule.js';
import { count, messageOf } from '../shared/dom.js';

/** The steps of a build, in order, each with its words. */
export const STAGES = Object.freeze([
  Object.freeze({ id: 'runtime', label: 'Start R in this browser' }),
  Object.freeze({ id: 'packages', label: 'Install R’s packages' }),
  Object.freeze({ id: 'files', label: 'Fetch gsm.datasim' }),
  Object.freeze({ id: 'simulate', label: 'Simulate the study and build its layers' })
]);

/** What pressing Build downloads the first time, in a sentence. */
export function downloadsSaid(downloads = DOWNLOADS) {
  const total = Math.round(downloads.reduce((sum, entry) => sum + entry.megabytes, 0));
  return `First build in this browser: about half a minute and ${total} MB, to start R. Later builds take seconds. Nothing is sent anywhere.`;
}

/** Take a protocol: the form is filled from it, and its schedule is the form's. */
export function takeProtocol(app, protocol, from) {
  const { s, say, go } = app;
  const filled = protocolSettings(protocol, LIMITS);
  const { domains, ...settings } = filled.settings;
  // The score the protocol points at, when it points at one: simulated with no
  // difference between the arms until the reader says one.
  s.form = { ...s.form, ...settings, protocol, efficacy: efficacyOf(protocol) };
  for (const id of domains) {
    if (DOMAINS.some((domain) => domain.id === id && !domain.core)) s.chosen.add(id);
  }
  say(
    [
      `The protocol ${protocol.name} is in the form, ${from}: ${protocolSaid(protocol)}.`,
      ...filled.notes,
      // What the reader left out of the file, as it says it.
      ...(protocol.notes || []),
      'Build makes a study on its schedule.'
    ].join(' ')
  );
  go('describe');
}

/**
 * Draw the builder's form.
 * @param {Object} app The page's state and what it can do; see `src/app/widget.js`.
 * @returns {Element} The screen.
 */
export function builderScreen(app) {
  const {
    s,
    el,
    button,
    shelf,
    builder,
    readyProtocols,
    save,
    go,
    draw,
    say,
    build,
    current,
    listed,
    keep,
    attempt,
    saidLine,
    fileButton,
    openDocument
  } = app;

  /** Change the form's protocol, and draw. A change that leaves it no protocol is said, not made. */
  function editProtocol(change) {
    const next = JSON.parse(JSON.stringify(s.form.protocol));
    change(next);
    try {
      s.form = {
        ...s.form,
        protocol: readProtocol({ ...next, source: { ...next.source, edited: true } })
      };
      s.problems = [];
    } catch (error) {
      s.problems = [messageOf(error)];
    }
    draw();
  }

  /** The form's schedule: what the protocol is, its grid, and what can be done to it. */
  function scheduleSection() {
    const protocol = s.form.protocol;
    const section = el('div', 'sb-protocol');
    section.dataset.protocol = protocol.name;
    const from =
      protocol.source.kind === 'usdm'
        ? `CDISC USDM ${protocol.source.version || ''}`.trim()
        : 'study.builder protocol';
    section.append(
      el(
        'p',
        'sb-soft',
        [
          `${protocol.title || protocol.name}. Read from ${from}${protocol.source.edited ? ', and changed here' : ''}.`,
          protocol.arms.length ? `Arms: ${protocol.arms.join(', ')}.` : '',
          'Visits, vital signs and labs are made on this schedule.'
        ]
          .filter(Boolean)
          .join(' ')
      )
    );
    section.append(
      scheduleGrid({ el }, protocol, { change: editProtocol, disabled: s.phase === 'building' })
    );
    const acts = el('div', 'sb-row');
    acts.append(
      button(
        '',
        'Add a visit',
        () =>
          editProtocol((next) => {
            const last = Math.max(...next.visits.map((visit) => visit.day));
            let number = next.visits.length + 1;
            while (next.visits.some((visit) => visit.name === `Visit ${number}`)) number += 1;
            const id = `added-${Date.now().toString(36)}-${number}`;
            next.visits.push({ id, name: `Visit ${number}`, day: last + 7, before: 0, after: 0 });
            next.schedule[id] = [];
          }),
        'add-visit'
      ),
      button(
        '',
        'Protocol file',
        () =>
          save(
            `${s.form.name}.protocol.json`,
            `${JSON.stringify(s.form.protocol, null, 2)}\n`,
            'application/json'
          ),
        'download-protocol'
      ),
      button(
        'sb-link',
        'Remove the protocol',
        () => {
          s.form = { ...s.form, protocol: null, efficacy: null };
          say('The protocol is removed. The study will have the simulator’s own eight visits.');
          draw();
        },
        'remove-protocol'
      )
    );
    section.append(acts);
    return section;
  }

  /** About how likely a difference is to be seen, two-sided at 0.05, with `n` in each arm. */
  const power = (difference, sd, n) => {
    if (!difference || !(sd > 0) || !(n > 1)) return null;
    const z = Math.abs(difference) / (sd * Math.sqrt(2 / n)) - 1.96;
    // The normal distribution's share below z (Abramowitz and Stegun 26.2.17).
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const tail =
      Math.exp((-z * z) / 2) *
      0.3989423 *
      t *
      (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z >= 0 ? 1 - tail : tail;
  };

  /**
   * The efficacy score: which one, where it is measured, and what the
   * simulator assumes of it for each arm. Null when the protocol points at no
   * score that could be simulated.
   */
  function efficacySection() {
    const protocol = s.form.protocol;
    const pointed = efficacyOf(protocol);
    const on = s.form.efficacy;
    if (!pointed && !on) return null;
    const section = el('div', 'sb-efficacy-form');
    const busy = s.phase === 'building';
    const set = (change) => {
      s.form = { ...s.form, efficacy: { ...s.form.efficacy, ...change } };
    };
    const toggle = el('div', 'sb-seg');
    toggle.setAttribute('role', 'group');
    for (const [value, label] of [
      ['on', 'Simulate it'],
      ['off', 'Leave it out']
    ]) {
      const one = el('button', null, label);
      one.type = 'button';
      one.dataset.efficacy = value;
      one.setAttribute('aria-pressed', String((value === 'on') === Boolean(on)));
      one.disabled = busy;
      one.onclick = () => {
        s.form = { ...s.form, efficacy: value === 'on' ? on || pointed : null };
        draw();
      };
      toggle.append(one);
    }
    const shown = on || pointed;
    section.append(
      el(
        'p',
        'sb-soft',
        `${shown.endpoint || shown.name}. Measured at ${shown.visits.join(', ')}. The protocol says which score and where; the numbers below are yours, and are sent to the simulator beside it.`
      ),
      toggle
    );
    if (!on) return section;

    const number = (name, value, onInput, label) => {
      const control = el('input', 'sb-input');
      control.type = 'number';
      control.step = 'any';
      control.name = name;
      control.value = value === null || value === undefined ? '' : String(value);
      control.disabled = busy;
      if (label) control.setAttribute('aria-label', label);
      control.oninput = () => onInput(control.value);
      control.onchange = () => draw();
      return control;
    };
    const title = el('input', 'sb-input');
    title.name = 'efficacy-name';
    title.value = on.name || '';
    title.disabled = busy;
    title.oninput = () => set({ name: title.value });
    const better = el('div', 'sb-seg');
    better.setAttribute('role', 'group');
    for (const [value, label] of [
      ['lower', 'Lower'],
      ['higher', 'Higher']
    ]) {
      const one = el('button', null, label);
      one.type = 'button';
      one.dataset.better = value;
      one.setAttribute('aria-pressed', String((on.better || 'lower') === value));
      one.disabled = busy;
      one.onclick = () => {
        set({ better: value });
        draw();
      };
      better.append(one);
    }
    const first = el('div', 'sb-fields');
    first.append(field('Score', title, 2), field('Better is', better, 1.4));
    section.append(first);

    const reference = referenceArm(protocol.arms);
    const last = on.visits.at(-1);
    const each = Math.floor((Number(s.form.participants) || 0) / (protocol.arms.length || 1));
    const arms = el('table', 'sb-table sb-efficacy-arms');
    const head = el('tr');
    for (const said of ['Arm', `Difference from ${reference} at ${last}`, 'Chance of seeing it']) {
      head.append(el('th', null, said));
    }
    const thead = el('thead');
    thead.append(head);
    const body = el('tbody');
    for (const arm of protocol.arms) {
      const row = el('tr');
      row.dataset.arm = arm;
      const name = el('td', null, arm);
      const cell = el('td');
      const chance = el('td', 'sb-soft');
      if (arm === reference) {
        const pill = el('span', 'sb-pill', 'Reference');
        pill.dataset.kind = 'none';
        name.append(' ', pill);
        cell.textContent = '0';
      } else {
        const effect = (on.effects || {})[arm];
        cell.append(
          number(
            `efficacy-effect-${arm}`,
            effect === undefined ? 0 : effect,
            (value) => set({ effects: { ...(s.form.efficacy.effects || {}), [arm]: value } }),
            `Difference from ${reference} for ${arm}`
          )
        );
        const likely = power(Number(effect), Number(on.sd), each);
        chance.textContent =
          likely === null ? 'No difference to see' : `About ${Math.round(likely * 100)}%`;
      }
      row.append(name, cell, chance);
      body.append(row);
    }
    arms.append(thead, body);
    section.append(arms);

    const second = el('div', 'sb-fields');
    second.append(
      field(
        'Baseline mean',
        number('efficacy-baseline', on.baseline, (value) => set({ baseline: value }))
      ),
      field(
        'Standard deviation of change',
        number('efficacy-sd', on.sd, (value) => set({ sd: value }))
      ),
      field(
        `Change on ${reference} by ${last}`,
        number('efficacy-change', on.change, (value) => set({ change: value })),
        1.4
      ),
      field(
        'Lowest score',
        number('efficacy-min', on.min, (value) => set({ min: value }))
      ),
      field(
        'Highest score',
        number('efficacy-max', on.max, (value) => set({ max: value }))
      )
    );
    section.append(second);
    const read = readEfficacy(on, protocol);
    section.append(
      el(
        'p',
        'sb-soft',
        read.problems.length
          ? read.problems.join(' ')
          : `The chance is arithmetic on these numbers for ${each} participants in each arm, two-sided at 0.05, were all of them to reach ${last}. It writes no data. Participants who have not reached ${last} when the study is looked at, or who left, make the real chance lower.`
      )
    );
    return section;
  }

  /**
   * What the simulator assumes of any study, with or without a protocol: the
   * share who leave early, and how adverse events follow the arm.
   */
  function assumptionsSection() {
    const section = el('div', 'sb-efficacy-form');
    const held = s.form.assumptions || {};
    const set = (change) => {
      s.form = { ...s.form, assumptions: { ...(s.form.assumptions || {}), ...change } };
    };
    const number = (name, value, onInput, { min, max } = {}) => {
      const control = el('input', 'sb-input');
      control.type = 'number';
      control.step = 'any';
      control.name = name;
      if (min !== undefined) control.min = String(min);
      if (max !== undefined) control.max = String(max);
      control.value = value === null || value === undefined ? '' : String(value);
      control.disabled = s.phase === 'building';
      control.oninput = () => onInput(control.value);
      control.onchange = () => draw();
      return control;
    };
    const fields = el('div', 'sb-fields');
    fields.append(
      field(
        'Share who leave early · 0 to 0.9',
        number(
          'assumptions-dropout',
          held.dropout === undefined ? ASSUMED.dropout : held.dropout,
          (value) => set({ dropout: value }),
          { min: 0, max: 0.9 }
        ),
        1.6
      ),
      field(
        'Drug-type adverse events on an active arm · times placebo',
        number(
          'assumptions-events',
          held.eventRatio === undefined ? ASSUMED.eventRatio : held.eventRatio,
          (value) => set({ eventRatio: value }),
          { min: 0.1, max: 5 }
        ),
        2.4
      )
    );
    section.append(fields);
    const arms = s.form.protocol ? s.form.protocol.arms : undefined;
    const read = readAssumptions(s.form.assumptions || {}, arms ? { arms } : {});
    const share = read.assumptions ? read.assumptions.dropout : 0;
    section.append(
      el(
        'p',
        'sb-soft',
        read.problems.length
          ? read.problems.join(' ')
          : `${
              share
                ? `About ${Math.round(share * 100)} in 100 enrolled participants leave by the ${s.form.protocol ? 'last planned visit' : 'end of the study'}, spread evenly over it: nothing of theirs is dated after they go, and the completion tables say why.`
                : 'Nobody leaves early.'
            } Adverse event terms are a short list of gsm.datasim’s own, not MedDRA.`
      )
    );
    return section;
  }

  function segmented(name, options, onPick) {
    const group = el('div', 'sb-seg');
    group.setAttribute('role', 'group');
    for (const [value, label] of options) {
      const one = el('button', null, label);
      one.type = 'button';
      one.dataset[name] = value;
      one.setAttribute('aria-pressed', String(String(s.form[name]) === String(value)));
      one.disabled = s.phase === 'building';
      one.onclick = () => {
        onPick(value);
        draw();
      };
      group.append(one);
    }
    return group;
  }

  function field(labelText, control, grow = 1) {
    const wrap = el(control.tagName === 'INPUT' ? 'label' : 'div', 'sb-field');
    wrap.style.flexGrow = String(grow);
    // A wider control asks for more room before the row wraps.
    wrap.style.flexBasis = `${Math.round(grow * 6)}rem`;
    wrap.append(el('span', 'sb-soft', labelText), control);
    return wrap;
  }

  function input(name, { type = 'text', min, max } = {}) {
    const control = el('input', 'sb-input');
    control.name = name;
    control.type = type;
    if (type === 'number') {
      control.inputMode = 'numeric';
      control.step = '1';
      if (min !== undefined) control.min = String(min);
      if (max !== undefined) control.max = String(max);
    }
    control.value = s.form[name] === null || s.form[name] === undefined ? '' : String(s.form[name]);
    control.disabled = s.phase === 'building';
    control.oninput = () => {
      s.form = { ...s.form, [name]: control.value };
    };
    control.onchange = () => draw();
    return control;
  }

  function describe() {
    const page = el('div', 'sb-screen sb-describe');
    page.dataset.screen = 'describe';
    const main = el('div', 'sb-describe-main');
    const top = el('div');
    if (listed()) top.append(button('sb-link', '← Studies', () => go('library'), 'back'));
    top.append(el('h2', null, 'New study'));
    main.append(top);
    const line = saidLine();
    if (line) main.append(line);

    const { participants, sites, months } = LIMITS;
    const trial = el('form', 'sb-trial');
    trial.noValidate = true;
    trial.onsubmit = (event) => {
      event.preventDefault();
      build();
    };
    const first = el('div', 'sb-fields');
    first.append(
      field('Name', input('name'), 1.2),
      field(
        'Phase: fills in a typical size',
        segmented(
          'phase',
          PHASES.map((entry) => [entry.id, entry.label.replace('Phase ', '')]),
          (value) => {
            s.form = withPhase(s.form, value);
          }
        ),
        2
      ),
      field(
        'Therapeutic area',
        segmented(
          'area',
          AREAS.map((area) => [area, area]),
          (value) => {
            s.form = { ...s.form, area: value };
          }
        ),
        3
      )
    );
    const second = el('div', 'sb-fields');
    second.append(
      field(
        `Participants · ${participants.min} to ${participants.max}`,
        input('participants', { type: 'number', ...participants })
      ),
      field(`Sites · ${sites.min} to ${sites.max}`, input('sites', { type: 'number', ...sites })),
      field(
        `Months · ${months.min} to ${months.max}`,
        input('months', { type: 'number', ...months })
      ),
      field(
        'Outliers',
        segmented(
          'outliers',
          OUTLIERS.map((entry) => [entry.id, entry.label.replace(' outliers', '')]),
          (value) => {
            s.form = { ...s.form, outliers: value };
          }
        ),
        2.2
      ),
      field('Seed · optional', input('seed', { type: 'number', min: 0 })),
      field(
        'Snapshots kept',
        segmented(
          'snapshots',
          SNAPSHOTS.map((entry) => [entry.id, entry.label]),
          (value) => {
            s.form = { ...s.form, snapshots: value };
          }
        ),
        2
      )
    );
    trial.append(first, second);
    main.append(el('h3', null, 'The trial'), trial);
    if (s.form.protocol) {
      const planned = planOf(s.form.protocol);
      main.append(
        el('h3', null, `Schedule of activities: ${planned.length} visits, from the protocol`),
        scheduleSection()
      );
    } else {
      const ask = el('p', 'sb-soft sb-protocol-ask');
      ask.append(
        'Have a protocol? Open a CDISC USDM study definition (the data form of an ICH M11 protocol) and the study is built on its schedule of activities. ',
        fileButton()
      );
      // A ready-made protocol, to try with no file at hand.
      for (const ready of readyProtocols) {
        const tryIt = button(
          '',
          `Try the ${ready.label}`,
          () =>
            attempt(async () => {
              const response = await globalThis.fetch(ready.url);
              if (!response || !response.ok) {
                throw new Error(`The ${ready.label} could not be fetched from this page.`);
              }
              await openDocument(await response.json(), 'a ready-made protocol');
            }),
          'try-protocol'
        );
        ask.append(tryIt);
      }
      main.append(ask);
    }
    if (s.form.protocol) {
      const section = efficacySection();
      if (section) main.append(el('h3', null, 'Efficacy: what the simulator assumes'), section);
    }

    // The layers, as the pipeline they are: each is built from the one before.
    const included = new Set(withLayerNeeds([...s.layersChosen]));
    const layer = (id) => {
      const one = LAYERS.find((each) => each.id === id);
      const neededBy = LAYERS.filter(
        (other) => s.layersChosen.has(other.id) && (other.needs || []).includes(id)
      ).map((other) => other.label);
      const on = !one.optional || included.has(id);
      const press = el('button', 'sb-layer');
      press.type = 'button';
      press.dataset.layer = id;
      press.setAttribute('aria-pressed', String(on));
      press.disabled = !one.optional || neededBy.length > 0 || s.phase === 'building';
      press.title = one.about;
      const under = !one.optional
        ? 'Always'
        : neededBy.length
          ? `Needed by ${neededBy.join(', ')}`
          : on
            ? 'In the study'
            : 'Left out';
      press.append(el('strong', null, one.label), el('span', 'sb-soft', under));
      press.onclick = () => {
        if (s.layersChosen.has(id)) s.layersChosen.delete(id);
        else s.layersChosen.add(id);
        draw();
      };
      return press;
    };
    const arrow = () => {
      const made = el('span', 'sb-arrow', '→');
      made.setAttribute('aria-hidden', 'true');
      return made;
    };
    const pipe = el('div', 'sb-pipe');
    const pair = el('div', 'sb-pipe-pair');
    pair.append(layer('raw.rbqm'), layer('adam'));
    pipe.append(
      layer('raw'),
      arrow(),
      pair,
      arrow(),
      layer('analysis'),
      arrow(),
      layer('reporting')
    );
    main.append(
      el('h3', null, 'Layers: each is built from the one before it'),
      pipe,
      el('p', 'sb-soft', 'Press a layer to leave it out. A layer another is built from stays in.')
    );

    // The raw domains, as chips.
    const inStudy = new Set(withNeeds([...s.chosen]));
    // A domain that is asked for another way (scores, by an efficacy score) has no chip.
    const pressed = DOMAINS.filter((domain) => !domain.asked);
    main.append(el('h3', null, `Raw domains: ${inStudy.size} of ${pressed.length}`));
    const chips = el('div', 'sb-chips');
    for (const domain of pressed) {
      const neededBy = DOMAINS.filter(
        (other) => other.needs === domain.id && s.chosen.has(other.id)
      ).map((other) => other.label);
      const chip = el('button', 'sb-chip', domain.label);
      chip.type = 'button';
      chip.dataset.domain = domain.id;
      chip.setAttribute('aria-pressed', String(inStudy.has(domain.id)));
      chip.disabled = domain.core || neededBy.length > 0 || s.phase === 'building';
      chip.title = [
        `${domain.grain}.`,
        domain.core ? 'In every study.' : '',
        neededBy.length ? `Needed by ${neededBy.join(', ')}.` : '',
        domain.large ? 'Grows fast with the size of the study.' : ''
      ]
        .filter(Boolean)
        .join(' ');
      chip.onclick = () => {
        if (s.chosen.has(domain.id)) s.chosen.delete(domain.id);
        else s.chosen.add(domain.id);
        draw();
      };
      chips.append(chip);
    }
    main.append(chips);
    main.append(
      el('h3', null, 'Assumptions: who leaves early, and adverse events by arm'),
      assumptionsSection()
    );

    // What building it will give, and the button.
    const side = el('aside', 'sb-summary');
    const read = readSettings(current());
    side.append(
      el('h3', null, s.phase === 'building' ? `Building ${s.form.name}` : 'What you will get')
    );
    if (s.phase === 'building') {
      const steps = el('ol', 'sb-steps');
      steps.setAttribute('role', 'status');
      const at = STAGES.findIndex((one) => one.id === s.stage);
      STAGES.forEach((one, index) => {
        const step = el('li', null, one.label);
        step.dataset.step = index < at ? 'done' : index === at ? 'now' : 'next';
        steps.append(step);
      });
      side.append(steps);
    } else {
      const facts = el('dl', 'sb-facts');
      const fact = (label, value) => facts.append(el('dt', null, label), el('dd', null, value));
      if (read.args) {
        fact('Participants', `${read.args.participants} at ${count(read.args.sites, 'site')}`);
        fact(
          'Monthly snapshots',
          read.args.history
            ? `${read.args.months}, every one kept`
            : `${read.args.months}, the last kept`
        );
      }
      if (s.form.protocol) fact('Planned visits', String(s.form.protocol.visits.length));
      fact('Raw domains', String(inStudy.size));
      fact('Layers', String(1 + included.size));
      side.append(facts);
      if (!builder.started()) side.append(el('p', 'sb-warn', downloadsSaid()));
    }
    if (s.problems.length) {
      const box = el('ul', 'sb-problems');
      box.setAttribute('role', 'alert');
      for (const problem of s.problems) box.append(el('li', null, problem));
      side.append(box);
    }
    if (s.phase === 'failed') {
      const box = el('p', 'sb-problems', s.failure);
      box.setAttribute('role', 'alert');
      side.append(box);
    }
    const run = button(
      'sb-primary',
      s.phase === 'building' ? 'Building…' : 'Build the study',
      () => build(),
      'build'
    );
    run.disabled = s.phase === 'building';
    side.append(run);
    const keepers = el('div', 'sb-row');
    const withConfig = (then) => () => {
      try {
        then(configOf(current()));
      } catch (error) {
        s.problems = error.problems || [messageOf(error)];
        draw();
      }
    };
    if (shelf && shelf.available) {
      keepers.append(
        button(
          '',
          'Save settings',
          withConfig((config) => keep(config, 'These settings')),
          'save-settings'
        )
      );
    }
    keepers.append(
      button(
        '',
        'Settings file',
        withConfig((config) =>
          save(
            `${config.name}.settings.json`,
            `${JSON.stringify(config, null, 2)}\n`,
            'application/json'
          )
        ),
        'download-settings'
      )
    );
    side.append(keepers);
    if (s.study) {
      side.append(button('sb-link', `Back to ${s.study.id}`, () => go('study'), 'to-study'));
    }
    side.append(
      el(
        'p',
        'sb-soft',
        'Every row is synthetic. Phase and area are labels: they do not shape the data yet.'
      )
    );
    page.append(main, side);
    return page;
  }

  return describe();
}
