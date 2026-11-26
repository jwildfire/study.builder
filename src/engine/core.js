// study.builder's rules, with no document and no R in them: what a study may be
// asked to hold, the domains gsm.datasim can make, and what R is asked for.
//
// What can be asked is what gsm.datasim can take. Participants, sites and
// months shape the data, and so does the outlier dial. A phase fills in a
// typical size, which may be changed. Phase and therapeutic area are written
// into the study table as chosen, and shape the study results a little:
// gsm.datasim's study profile (`PROFILE_SAID` says what each changes).

import { planOf, readProtocol } from './protocol.js';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';

/** The limits of each number; r/builder.R holds the same. */
export const LIMITS = Object.freeze({
  participants: Object.freeze({ min: 20, max: 500 }),
  sites: Object.freeze({ min: 2, max: 100 }),
  months: Object.freeze({ min: 3, max: 12 })
});

/** The phases, each with the size it fills in. `id` is what gsm's study table says of a phase. */
export const PHASES = Object.freeze([
  Object.freeze({ id: 'P1', label: 'Phase 1', participants: 40, sites: 4, months: 6 }),
  Object.freeze({ id: 'P2', label: 'Phase 2', participants: 150, sites: 20, months: 9 }),
  Object.freeze({ id: 'P3', label: 'Phase 3', participants: 500, sites: 60, months: 12 }),
  Object.freeze({ id: 'P4', label: 'Phase 4', participants: 300, sites: 40, months: 12 })
]);

/** The therapeutic areas gsm.datasim names. */
export const AREAS = Object.freeze(['Oncology', 'Virology', 'Inflammation']);

/**
 * What a phase and a therapeutic area change in the study results, a sentence
 * each, as gsm.datasim's study profile says it (`study_profile()` holds the
 * numbers). Phase 2 is the plain one. A study's own notes say the same, from
 * R; a check with real R holds the two together.
 */
export const PROFILE_SAID = Object.freeze({
  phases: Object.freeze({
    P1: 'Phase 1: labs are out of range less often, fewer adverse events are serious and they are milder.',
    P2: '',
    P3: 'Phase 3: labs are out of range a little more often.',
    P4: 'Phase 4: labs are out of range a little more often.'
  }),
  areas: Object.freeze({
    Oncology:
      'Oncology: more gastrointestinal, general and nutrition events, more serious and severe ones, and more liver and kidney rises.',
    Virology:
      'Virology: more infections, and more participants with raised liver tests from the start.',
    Inflammation: 'Inflammation: more musculoskeletal, infection and skin events.'
  })
});

/**
 * What a study's phase and area change, in a line.
 * @param {string} phase A phase's id.
 * @param {string} area A therapeutic area.
 * @returns {string} The sentences, or a line saying nothing is changed.
 */
export function profileSaid(phase, area) {
  const said = [PROFILE_SAID.phases[phase], PROFILE_SAID.areas[area]].filter(Boolean);
  return said.length ? said.join(' ') : 'Phase 2 with no therapeutic area: nothing is changed.';
}

/** gsm.datasim's outlier dial, as three settings. */
export const OUTLIERS = Object.freeze([
  Object.freeze({ id: 'few', label: 'Few outliers', intensity: 0.5 }),
  Object.freeze({ id: 'typical', label: 'Typical', intensity: 1 }),
  Object.freeze({ id: 'many', label: 'Many outliers', intensity: 2.5 })
]);

/**
 * The domains gsm.datasim makes, by gsm's name for each, in the order they are
 * shown. `core` domains are in every study. `on` is whether a domain is made
 * unless the caller says otherwise. `needs` is a domain it is made from, which
 * is brought with it. `large` domains grow fast with the size of the study.
 * `feeds` names the standard file made from it.
 */
export const DOMAINS = Object.freeze(
  [
    { id: 'STUDY', label: 'Study', grain: 'One row for the study', core: true },
    { id: 'SITE', label: 'Sites', grain: 'One row per site', core: true },
    {
      id: 'SUBJ',
      label: 'Participants',
      grain: 'One row per participant, screened or enrolled',
      core: true,
      feeds: 'subject'
    },
    { id: 'ENROLL', label: 'Enrolment', grain: 'One row per participant screened', core: true },
    { id: 'VISIT', label: 'Visits', grain: 'One row per participant visit', on: true },
    {
      id: 'AE',
      label: 'Adverse events',
      grain: 'One row per adverse event; terms are placeholders',
      on: true,
      feeds: 'ae'
    },
    {
      id: 'LB',
      label: 'Labs',
      grain:
        'One row per participant, visit and lab test: a result, its normal range and a toxicity grade',
      on: true,
      large: true,
      feeds: 'bds'
    },
    {
      id: 'VS',
      label: 'Vital signs',
      grain: 'One row per participant visit, with eight vital signs',
      on: true,
      needs: 'VISIT',
      feeds: 'bds'
    },
    {
      id: 'EG',
      label: 'ECGs',
      grain: 'One row per participant, visit and ECG measure: QTcF, QTcB and heart rate',
      on: true,
      needs: 'VISIT',
      feeds: 'eg'
    },
    {
      // Made when the settings say an efficacy score to simulate, and only then.
      id: 'QS',
      label: 'Scores',
      grain: 'One row per participant, visit and score: a questionnaire or rating total',
      needs: 'VISIT',
      feeds: 'qs',
      asked: 'efficacy'
    },
    { id: 'PD', label: 'Protocol deviations', grain: 'One row per deviation', on: true },
    {
      id: 'STUDCOMP',
      label: 'Study completion',
      grain: 'One row per participant who left the study',
      on: true
    },
    {
      id: 'SDRGCOMP',
      label: 'Treatment completion',
      grain: 'One row per participant who stopped study drug',
      on: true
    },
    { id: 'IE', label: 'Eligibility', grain: 'One row per eligibility criterion recorded' },
    { id: 'PK', label: 'Pharmacokinetics', grain: 'One row per PK sample time point' },
    { id: 'Randomization', label: 'Randomisation', grain: 'One row per participant randomised' },
    {
      id: 'OverallResponse',
      label: 'Overall response',
      grain: 'One row per response assessment',
      needs: 'VISIT'
    },
    { id: 'Death', label: 'Deaths', grain: 'One row per death', needs: 'STUDCOMP' },
    { id: 'QUERY', label: 'Data queries', grain: 'One row per query', large: true },
    { id: 'DATAENT', label: 'Data entry', grain: 'One row per form entered', large: true },
    { id: 'DATACHG', label: 'Data changes', grain: 'One row per field changed', large: true }
  ].map((domain) =>
    Object.freeze({
      core: false,
      on: false,
      large: false,
      needs: null,
      feeds: null,
      asked: null,
      ...domain,
      table: `Raw_${domain.id}`
    })
  )
);

/**
 * The layers of a study. Raw is the root: every other layer is built off it by
 * workflows. `optional` layers are made unless the caller says otherwise.
 */
export const LAYERS = Object.freeze([
  Object.freeze({
    id: 'raw',
    label: 'Raw',
    about: 'What gsm.datasim simulates: one table per domain, as a study database gives them.',
    optional: false
  }),
  Object.freeze({
    id: 'raw.rbqm',
    label: 'Raw.RBQM',
    about:
      'What gsm.mapping’s own workflows change in raw, for gsm’s site metrics. A table they leave as it was is not repeated here: the metrics read the raw one.',
    optional: true
  }),
  Object.freeze({
    id: 'adam',
    label: 'ADaM',
    about:
      'Analysis-ready tables for charts of participants, by study.builder’s workflows. Each column says where it came from.',
    optional: true
  }),
  Object.freeze({
    id: 'analysis',
    label: 'Analysis',
    about:
      'Statistics worked out from a data layer: gsm’s site metrics from Raw.RBQM, and an adverse event summary from ADaM.',
    optional: true,
    needs: Object.freeze(['raw.rbqm', 'adam'])
  }),
  Object.freeze({
    id: 'reporting',
    label: 'Reporting',
    about:
      'Results in the shape a chart reads: gsm’s Results, Bounds, Groups and Metrics, over every site metric that ran.',
    optional: true,
    needs: Object.freeze(['analysis'])
  })
]);

/**
 * The layers a choice comes to: each chosen layer, and each layer one of them
 * is made from, in the order they are shown.
 * @param {string[]} chosen Layer ids.
 * @returns {string[]} The ids of every layer that will be built off raw.
 */
export function withLayerNeeds(chosen) {
  const wanted = new Set(Array.isArray(chosen) ? chosen : []);
  for (let added = true; added;) {
    added = false;
    for (const layer of LAYERS) {
      for (const needed of (wanted.has(layer.id) && layer.needs) || []) {
        if (!wanted.has(needed)) {
          wanted.add(needed);
          added = true;
        }
      }
    }
  }
  return LAYERS.filter((layer) => layer.optional && wanted.has(layer.id)).map((layer) => layer.id);
}

/** The layers built off raw unless the caller says otherwise. */
export const DEFAULT_LAYERS = Object.freeze(
  LAYERS.filter((layer) => layer.optional).map((layer) => layer.id)
);

/** The standard files that can be made, with the domain each is made from. */
export const STANDARD = Object.freeze([
  Object.freeze({ id: 'subject', name: 'adsl.csv', label: 'Subject-level', from: 'SUBJ' }),
  Object.freeze({ id: 'ae', name: 'adae.csv', label: 'Adverse events', from: 'AE' }),
  Object.freeze({ id: 'bds', name: 'adlb.csv', label: 'Labs', from: 'LB' }),
  Object.freeze({ id: 'bds', name: 'advs.csv', label: 'Vital signs', from: 'VS' }),
  Object.freeze({ id: 'eg', name: 'adeg.csv', label: 'ECGs', from: 'EG' }),
  Object.freeze({ id: 'qs', name: 'adqs.csv', label: 'Scores', from: 'QS' })
]);

/** The optional domains made unless the caller says otherwise. */
export const DEFAULT_DOMAINS = Object.freeze(
  DOMAINS.filter((domain) => !domain.core && domain.on).map((domain) => domain.id)
);

/**
 * Which of a study's monthly snapshots are kept. gsm.datasim makes a study as
 * a snapshot a month, each holding what was known by then.
 */
export const SNAPSHOTS = Object.freeze([
  Object.freeze({ id: 'last', label: 'Last only' }),
  Object.freeze({ id: 'all', label: 'Every month' })
]);

/** What a study is unless the caller says otherwise. */
export const DEFAULTS = Object.freeze({
  name: 'BUILT-001',
  phase: 'P2',
  area: 'Oncology',
  participants: 150,
  sites: 20,
  months: 9,
  outliers: 'typical',
  seed: null,
  snapshots: 'last',
  protocol: null,
  efficacy: null,
  assumptions: null,
  domains: DEFAULT_DOMAINS,
  layers: DEFAULT_LAYERS
});

/** What every study built here is, and is not: one sentence each. */
export const CAVEATS = Object.freeze([
  'Every row is synthetic, made by gsm.datasim. No real participant or site is in it.',
  'Phase and therapeutic area shape the study results a little, by gsm.datasim’s study profile: how often a lab is out of range, which adverse events are commoner, and how many are serious and severe. The sizes are guesses at what is believable, not fitted to data. They do not change how many participants, visits or events a study has.',
  'Only the study’s last monthly snapshot is kept, unless every month is asked for.',
  'Every table that is not raw is built off raw by a workflow, and says which. The ADaM tables are a light form: enough for charts, not a submission.',
  'The site metrics are gsm’s own, run as gsm runs them. A simulated study’s flags say nothing about any real site.',
  'Arms, lab results and ECGs are simulated: a few participants on an active arm have a rise in liver tests, creatinine or QTc. A lab’s toxicity grade is not worked out from its result.',
  'Adverse event terms are a short list of gsm.datasim’s own, not MedDRA. Terms typical of a study drug are more common on an active arm, and a simulated rise usually names one of the participant’s events; how many events a participant has does not follow the arm.',
  'Nobody leaves the study early unless a share is asked for. When one is, who leaves does not depend on how they are doing, and the participant table’s own days-on-study columns are not shortened.'
]);

/**
 * Settings with a phase chosen: the phase, and the size it fills in.
 * @param {Object} settings The settings.
 * @param {string} phase A phase's id.
 * @returns {Object} The settings after the choice; a copy as they were when the id names no phase.
 */
export function withPhase(settings, phase) {
  const preset = PHASES.find((entry) => entry.id === phase);
  if (!preset) return { ...settings };
  const { participants, sites, months } = preset;
  return { ...settings, phase: preset.id, participants, sites, months };
}

/**
 * The domains a choice comes to: every core domain, each chosen domain
 * gsm.datasim makes, and each domain one of them needs, in the order shown.
 * @param {string[]} chosen Domain ids.
 * @returns {string[]} The ids of every domain the study will hold.
 */
export function withNeeds(chosen) {
  const wanted = new Set(Array.isArray(chosen) ? chosen : []);
  for (const domain of DOMAINS) if (wanted.has(domain.id) && domain.needs) wanted.add(domain.needs);
  return DOMAINS.filter((domain) => domain.core || wanted.has(domain.id)).map(
    (domain) => domain.id
  );
}

/** A whole number a value holds, or null when it holds anything else. */
function whole(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 ? value : null;
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

/**
 * Read settings: every problem with them, each a sentence, and, when there is
 * none, what R is asked for. A setting left out is the default's; numbers may
 * be numbers or the text a form field holds.
 * @param {Object} [settings] `name`, `phase`, `area`, `participants`, `sites`, `months`, `outliers`, `seed`, `snapshots` (`last`, or `all` to keep every monthly snapshot), `domains`, `layers`, `protocol` (a protocol whose schedule the build follows; protocol.js) `efficacy` (a score to simulate by arm, for a study with a protocol; `readEfficacy`) and `assumptions` (what the simulator assumes of any study: who leaves early, and how adverse events follow the arm; `readAssumptions`).
 * @returns {{problems: string[], args: ?Object, domains: string[]}} The problems; the arguments of `builder_run` less the folders R is told; and every domain the study will hold.
 */
export function readSettings(settings = {}) {
  const given = { ...DEFAULTS, ...(isRecord(settings) ? settings : {}) };
  const problems = [];
  const numbers = {};
  for (const [field, label] of [
    ['participants', 'Participants'],
    ['sites', 'Sites'],
    ['months', 'Months']
  ]) {
    const { min, max } = LIMITS[field];
    const number = whole(given[field]);
    if (number === null || number < min || number > max) {
      problems.push(`${label} must be a whole number from ${min} to ${max}.`);
    } else numbers[field] = number;
  }
  if (
    numbers.participants !== undefined &&
    numbers.sites !== undefined &&
    numbers.sites > numbers.participants
  ) {
    problems.push('Sites must be no more than participants.');
  }
  if (!isText(given.name)) problems.push('The study needs a name.');
  const phase = PHASES.find((entry) => entry.id === given.phase);
  if (!phase) problems.push('Choose a phase.');
  if (!AREAS.includes(given.area)) problems.push('Choose a therapeutic area.');
  const outliers = OUTLIERS.find((entry) => entry.id === given.outliers);
  if (!outliers) problems.push('Choose how many outliers.');
  const seedGiven =
    given.seed === null || given.seed === undefined ? '' : String(given.seed).trim();
  const seed = seedGiven === '' ? null : whole(seedGiven);
  if (seedGiven !== '' && (seed === null || seed > 2147483647)) {
    problems.push('The seed must be a whole number, or left empty.');
  }
  if (!SNAPSHOTS.some((entry) => entry.id === given.snapshots)) {
    problems.push('Choose which snapshots to keep: the last only, or every month.');
  }
  const known = new Set(DOMAINS.map((domain) => domain.id));
  // The scores domain is not chosen: it is made when an efficacy score is asked for.
  const asked = new Set(DOMAINS.filter((domain) => domain.asked).map((domain) => domain.id));
  const chosenGiven = Array.isArray(given.domains) ? given.domains : [];
  const chosen = chosenGiven.filter((id) => !asked.has(id));
  const unknown = chosen.filter((id) => !known.has(id));
  if (unknown.length) problems.push(`Not a domain study.builder makes: ${unknown.join(', ')}.`);
  const optional = withNeeds(chosen.filter((id) => known.has(id))).filter(
    (id) => !DOMAINS.find((domain) => domain.id === id).core
  );
  if (!unknown.length && !optional.length) {
    problems.push('Choose at least one domain besides the four every study has.');
  }
  const domains = withNeeds(optional);
  const layerIds = LAYERS.filter((layer) => layer.optional).map((layer) => layer.id);
  const askedLayers = Array.isArray(given.layers) ? given.layers.filter((id) => id !== 'raw') : [];
  const unknownLayers = askedLayers.filter((id) => !layerIds.includes(id));
  if (unknownLayers.length) {
    problems.push(`Not a layer study.builder makes: ${unknownLayers.join(', ')}.`);
  }
  // In the order the layers are shown, whatever order they were asked for
  // in, with each layer one of them is made from.
  const layers = withLayerNeeds(askedLayers.filter((id) => layerIds.includes(id)));
  // A protocol, when there is one: the build follows its schedule, so the
  // study has visits and whatever its activities collect.
  let protocol = null;
  if (given.protocol !== null && given.protocol !== undefined) {
    try {
      protocol = readProtocol(given.protocol);
    } catch (error) {
      problems.push(error.message);
    }
  }
  const withProtocol = protocol
    ? withNeeds([
        ...new Set([
          ...optional,
          'VISIT',
          ...planOf(protocol).flatMap((visit) => [
            ...(visit.vs ? ['VS'] : []),
            ...(visit.lb.length ? ['LB'] : [])
          ])
        ])
      ]).filter((id) => !DOMAINS.find((domain) => domain.id === id).core)
    : optional;
  // An efficacy score, when one is asked for: it needs a protocol, whose arms
  // and visits it is said in.
  let efficacy = null;
  if (given.efficacy !== null && given.efficacy !== undefined) {
    if (!protocol) {
      if (given.protocol === null || given.protocol === undefined) {
        problems.push(
          'An efficacy score needs a protocol: its arms and the visits it is measured at.'
        );
      }
    } else {
      const read = readEfficacy(given.efficacy, protocol);
      problems.push(...read.problems);
      efficacy = read.efficacy;
    }
  }
  const withEfficacy = efficacy ? withNeeds([...withProtocol, 'QS']) : withProtocol;
  // What the simulator assumes of the study: who leaves early, and how adverse
  // events follow the arm. Sent only when it says something of its own.
  let assumed = null;
  if (given.assumptions !== null && given.assumptions !== undefined) {
    const read = readAssumptions(given.assumptions, {
      arms: protocol ? protocol.arms : DEFAULT_ARMS,
      // The share that leaves has left by the last planned visit, or the study's end.
      day: protocol
        ? Math.max(2, ...protocol.visits.map((visit) => visit.day))
        : (numbers.months || DEFAULTS.months) * 30
    });
    problems.push(...read.problems);
    assumed = read.sent;
  }
  if (problems.length) return { problems, args: null, domains };
  return {
    problems,
    domains,
    args: {
      study_name: given.name.trim(),
      participants: numbers.participants,
      sites: numbers.sites,
      months: numbers.months,
      outlier_intensity: outliers.intensity,
      phase: phase.id,
      therapeutic_area: given.area,
      domains: withEfficacy.filter((id) => !DOMAINS.find((domain) => domain.id === id).core),
      layers,
      // A seed left empty is not sent: R then draws as it will.
      ...(seed === null ? {} : { seed }),
      // Every monthly snapshot is kept only when asked: it is several times the work.
      ...(given.snapshots === 'all' ? { history: true } : {}),
      // The protocol goes to R as text, with the plan R follows worked out here.
      ...(protocol ? { protocol: JSON.stringify({ ...protocol, plan: planOf(protocol) }) } : {}),
      // The score goes to R as text too, as gsm.datasim's study results take one.
      ...(efficacy ? { efficacy: JSON.stringify({ scores: [scoreOf(efficacy)] }) } : {}),
      // So do the assumptions, as gsm.datasim's study results take them.
      ...(assumed ? { assumptions: JSON.stringify(assumed) } : {})
    }
  };
}

/** The arms a study has when no protocol names any: gsm.datasim's own. */
export const DEFAULT_ARMS = Object.freeze(['Placebo', 'Active']);

/** What the simulator assumes unless told: nobody leaves early, and an adverse event typical of a study drug is 1.5 times as common on an active arm. */
export const ASSUMED = Object.freeze({ dropout: 0, eventRatio: 1.5 });

/**
 * Read what the simulator is to assume and write it back whole, or say what is wrong with it.
 * @param {Object} given `dropout` (the share of enrolled participants who leave early, 0 to 0.9), `dropoutByArm` (a share for any arm that differs, by arm name) and `eventRatio` (how many times as common an adverse event typical of a study drug is on an active arm as on placebo, above 0 to 5).
 * @param {{arms: string[], day: number}} study The study's arms, and the study day by which the share has left.
 * @returns {{problems: string[], assumptions: ?Object, sent: ?Object}} The problems; the assumptions with every field filled in; and what R is sent, null when they are the simulator's own.
 */
export function readAssumptions(given, { arms = DEFAULT_ARMS, day = 180 } = {}) {
  const problems = [];
  if (!isRecord(given)) {
    return { problems: ['The assumptions cannot be read.'], assumptions: null, sent: null };
  }
  const share = (value, what) => {
    const number = value === undefined || value === '' ? 0 : finite(value);
    if (number === null || number < 0 || number > 0.9) {
      problems.push(`${what} must be a number from 0 to 0.9.`);
      return 0;
    }
    return number;
  };
  const dropout = share(given.dropout, 'The share who leave early');
  const dropoutByArm = {};
  const byArm = isRecord(given.dropoutByArm) ? given.dropoutByArm : {};
  for (const [arm, value] of Object.entries(byArm)) {
    if (!arms.includes(arm)) problems.push(`${arm} is not an arm of this study.`);
    else if (value !== '' && value !== null && value !== undefined) {
      dropoutByArm[arm] = share(value, `The share of ${arm} who leave early`);
    }
  }
  const ratioGiven =
    given.eventRatio === undefined || given.eventRatio === '' || given.eventRatio === null
      ? ASSUMED.eventRatio
      : finite(given.eventRatio);
  let eventRatio = ASSUMED.eventRatio;
  if (ratioGiven === null || ratioGiven <= 0 || ratioGiven > 5) {
    problems.push(
      'How many times as common drug events are on an active arm must be above 0, to 5.'
    );
  } else eventRatio = ratioGiven;
  if (problems.length) return { problems, assumptions: null, sent: null };
  const leaves = dropout > 0 || Object.values(dropoutByArm).some((rate) => rate > 0);
  const sent = {
    ...(leaves
      ? {
          dropout: {
            rate: dropout,
            ...(Object.keys(dropoutByArm).length ? { arms: dropoutByArm } : {}),
            day
          }
        }
      : {}),
    ...(eventRatio !== ASSUMED.eventRatio ? { events: { ratio: eventRatio } } : {})
  };
  return {
    problems,
    assumptions: { dropout, dropoutByArm, eventRatio },
    sent: Object.keys(sent).length ? sent : null
  };
}

const finite = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/** The arm the others are compared with: the first named placebo or control, or the first. */
export function referenceArm(arms) {
  return arms.find((arm) => /placebo|control/i.test(arm)) || arms[0] || '';
}

/**
 * Read an efficacy score and write it back whole, or say what is wrong with it.
 * @param {Object} given `name`; `visits` (names of the protocol's visits it is measured at); `baseline` (mean at baseline); `sd` (standard deviation of the change from baseline); `change` (mean change on the reference arm by the last visit); `effects` (for each other arm, its mean difference from the reference arm by the last visit); `min` and `max` (the score's range); `better` (`lower` or `higher`).
 * @param {Object} protocol The protocol, read.
 * @returns {{problems: string[], efficacy: ?Object}} The problems, and the score when there are none.
 */
export function readEfficacy(given, protocol) {
  const problems = [];
  if (!isRecord(given)) return { problems: ['The efficacy score cannot be read.'], efficacy: null };
  const name = isText(given.name) ? given.name.trim() : '';
  if (!name) problems.push('The efficacy score needs a name.');
  const known = new Set(protocol.visits.map((visit) => visit.name));
  const visits = (Array.isArray(given.visits) ? given.visits : []).filter((visit) =>
    known.has(visit)
  );
  if (!visits.length)
    problems.push('The efficacy score needs at least one of the protocol’s visits.');
  const numbers = {};
  for (const [field, label, fallback] of [
    ['baseline', 'The baseline mean', 50],
    ['sd', 'The standard deviation', 10],
    ['change', 'The change on the reference arm', 0],
    ['min', 'The lowest score', 0],
    ['max', 'The highest score', 100]
  ]) {
    const value = given[field] === undefined ? fallback : finite(given[field]);
    if (value === null) problems.push(`${label} of the efficacy score must be a number.`);
    else numbers[field] = value;
  }
  if (numbers.sd !== undefined && numbers.sd <= 0) {
    problems.push('The standard deviation of the efficacy score must be above 0.');
  }
  if (numbers.min !== undefined && numbers.max !== undefined && numbers.min >= numbers.max) {
    problems.push('The lowest score must be below the highest.');
  }
  const reference = referenceArm(protocol.arms);
  const effects = {};
  for (const arm of protocol.arms.filter((one) => one !== reference)) {
    const said = isRecord(given.effects) ? given.effects[arm] : undefined;
    const value = said === undefined ? 0 : finite(said);
    if (value === null) problems.push(`The difference for ${arm} must be a number.`);
    else effects[arm] = value;
  }
  if (problems.length) return { problems, efficacy: null };
  // The full change is reached at the last visit the score is measured at.
  const day = Math.max(
    1,
    ...protocol.visits.filter((visit) => visits.includes(visit.name)).map((visit) => visit.day)
  );
  return {
    problems,
    efficacy: {
      name,
      visits: protocol.visits.map((visit) => visit.name).filter((visit) => visits.includes(visit)),
      ...numbers,
      effects,
      reference,
      day,
      better: given.better === 'higher' ? 'higher' : 'lower'
    }
  };
}

/** An efficacy score as gsm.datasim's study results take one. */
function scoreOf(efficacy) {
  const { name, visits, baseline, sd, change, effects, day, min, max } = efficacy;
  return { name, visits, baseline, sd, change, effects, day, min, max };
}

/**
 * One sentence for a study that was built.
 * @param {Object} study What `buildStudy` resolved to.
 * @returns {string} The sentence.
 */
export function studySaid(study) {
  const count = (number, noun) =>
    `${Number(number).toLocaleString('en-US')} ${noun}${Number(number) === 1 ? '' : 's'}`;
  const { args } = study;
  const phase = PHASES.find((entry) => entry.id === args.phase);
  const version = isText(study.simulator) ? ` ${study.simulator}` : '';
  const seconds = Number.isFinite(Number(study.seconds))
    ? ` in ${count(study.seconds, 'second')}`
    : '';
  return (
    `${study.id} is a simulated ${phase ? phase.label : 'study'} ${args.therapeutic_area} study: ` +
    `${count(args.participants, 'participant')} at ${count(args.sites, 'site')} over ` +
    `${count(args.months, 'month')}, in ${count(study.domains.length, 'domain')} and ` +
    `${count(study.layers.length, 'layer')}, made by ` +
    `gsm.datasim${version} in this browser${seconds}. Every row is synthetic.`
  );
}
