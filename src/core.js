// study.builder's rules, with no document and no R in them: what a study may be
// asked to hold, the domains gsm.datasim can make, and what R is asked for.
//
// What can be asked is what gsm.datasim can take. Participants, sites and
// months shape the data, and so does the outlier dial. Phase and therapeutic
// area do not: gsm.datasim draws both at random and neither changes a row, so
// here a phase fills in a typical size, which may be changed, and both are
// written into the study table as chosen.

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
      grain: 'One row per participant, visit and lab test: a toxicity grade, no result',
      on: true,
      large: true
    },
    {
      id: 'VS',
      label: 'Vital signs',
      grain: 'One row per participant visit, with eight vital signs',
      on: true,
      needs: 'VISIT',
      feeds: 'bds'
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
      'Raw under gsm’s names, by gsm.mapping’s own workflows. gsm calls these tables Mapped; its site metrics read them.',
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
  Object.freeze({ id: 'bds', name: 'advs.csv', label: 'Labs and vitals', from: 'VS' })
]);

/** The optional domains made unless the caller says otherwise. */
export const DEFAULT_DOMAINS = Object.freeze(
  DOMAINS.filter((domain) => !domain.core && domain.on).map((domain) => domain.id)
);

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
  domains: DEFAULT_DOMAINS,
  layers: DEFAULT_LAYERS
});

/** What every study built here is, and is not: one sentence each. */
export const CAVEATS = Object.freeze([
  'Every row is synthetic, made by gsm.datasim. No real participant or site is in it.',
  'Phase and therapeutic area are labels. gsm.datasim does not shape the data by either, so a phase only fills in a typical size.',
  'Only the study’s last monthly snapshot is returned.',
  'Every table that is not raw is built off raw by a workflow, and says which. The ADaM tables are a light form: enough for charts, not a submission.',
  'The site metrics are gsm’s own, run as gsm runs them. A simulated study’s flags say nothing about any real site.',
  'gsm.datasim makes no lab results (only toxicity grades), no treatment arms and no ECGs. Adverse event terms are its placeholders.'
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
 * @param {Object} [settings] `name`, `phase`, `area`, `participants`, `sites`, `months`, `outliers`, `seed`, `domains` and `layers`.
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
  const known = new Set(DOMAINS.map((domain) => domain.id));
  const chosen = Array.isArray(given.domains) ? given.domains : [];
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
      domains: optional,
      layers,
      // A seed left empty is not sent: R then draws as it will.
      ...(seed === null ? {} : { seed })
    }
  };
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
