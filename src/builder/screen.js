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
  readSettings,
  withLayerNeeds,
  withNeeds,
  withPhase
} from '../engine/core.js';
import { DOWNLOADS } from '../engine/build.js';
import { configOf } from '../engine/saved.js';
import { planOf, protocolSaid, protocolSettings, readProtocol } from '../engine/protocol.js';
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
  s.form = { ...s.form, ...settings, protocol };
  for (const id of domains) {
    if (DOMAINS.some((domain) => domain.id === id && !domain.core)) s.chosen.add(id);
  }
  say(
    [
      `The protocol ${protocol.name} is in the form, ${from}: ${protocolSaid(protocol)}.`,
      ...filled.notes,
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
          s.form = { ...s.form, protocol: null };
          say('The protocol is removed. The study will have the simulator’s own eight visits.');
          draw();
        },
        'remove-protocol'
      )
    );
    section.append(acts);
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
      field('Seed · optional', input('seed', { type: 'number', min: 0 }))
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
    main.append(el('h3', null, `Raw domains: ${inStudy.size} of ${DOMAINS.length}`));
    const chips = el('div', 'sb-chips');
    for (const domain of DOMAINS) {
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
        fact('Monthly snapshots', String(read.args.months));
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
