// A protocol, as study.builder reads one: the design of a trial that a build
// follows. For now it is the schedule of activities: the visits, when each is
// planned and with what window, the activities, which activity is at which
// visit, and what an activity collects.
//
//   const protocol = readUsdm(usdmJson);      // a CDISC USDM study definition
//   const study = await buildStudy({ ...protocolSettings(protocol), protocol });
//
// The model here is study.builder's own and is small on purpose. One reader
// fills it from CDISC's Unified Study Definitions Model (USDM), the data form
// of an ICH M11 protocol; nothing else in study.builder knows USDM. M11's own
// technical specification leaves the schedule of activities as a table or an
// image, so there is nothing of it to read there.
//
// What a build does with it: visits, vital signs and labs are made on the
// schedule, and its arms are the study's. Everything else a protocol says is
// kept and shown, and simulates nothing yet: activities of no domain the
// simulator makes, and its `design`: what each arm gets in each epoch, its
// objectives with their endpoints, its estimands and its population.

/** The protocol document's format, by name and version. */
export const PROTOCOL_FORMAT = 'study.builder/protocol/1';

/** The domains an activity can stand for, each with the words that name it. */
export const ACTIVITY_DOMAINS = Object.freeze([
  Object.freeze({
    id: 'VS',
    label: 'Vital signs',
    words: /vital|blood pressure|temperature|weight|height|pulse|heart rate|respirat/i
  }),
  Object.freeze({
    id: 'LB',
    label: 'Labs',
    words:
      /hematolog|haematolog|chemistry|urinalysis|uninalysis|laborator|\blab\b|\blabs\b|a1c|serolog|coagulation|specimen|blood sample|serum|plasma/i
  }),
  Object.freeze({ id: 'AE', label: 'Adverse events', words: /adverse/i })
]);

/**
 * The protocols that come ready-made: CDISC's five example study definitions,
 * each as the reader makes it (`protocols/<id>.protocol.json`, written by
 * `npm run protocols`).
 */
export const READY_PROTOCOLS = Object.freeze([
  Object.freeze({ id: 'cdisc-pilot', label: 'CDISC pilot protocol' }),
  Object.freeze({ id: 'cdisc-pilot-devices', label: 'CDISC pilot protocol with devices' }),
  Object.freeze({ id: 'alexion-wilsons', label: 'Alexion Wilson’s disease protocol' }),
  Object.freeze({ id: 'lilly-nasal-glucagon', label: 'Lilly nasal glucagon protocol' }),
  Object.freeze({ id: 'observational', label: 'observational study example' })
]);

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const list = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const whole = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
};

/** An error whose message is a sentence a page can show. */
export class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProtocolError';
  }
}

/** The domain an activity stands for, by its name and what it collects; null when the simulator makes none for it. */
export function domainOf(name, collects = []) {
  const said = [name, ...collects].join(' ');
  const found = ACTIVITY_DOMAINS.find((domain) => domain.words.test(said));
  return found ? found.id : null;
}

/**
 * An ISO 8601 duration in whole days: `P2W` is 14, `P3D` is 3, `PT4H` is 0.
 * @param {string} value The duration.
 * @returns {?number} The days, or null when it is not a duration this reads.
 */
export function daysOf(value) {
  const match =
    /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T.*)?$/.exec(
      text(value)
    );
  if (!match || !text(value)) return null;
  const [, years = 0, months = 0, weeks = 0, days = 0] = match;
  return Math.round(Number(years) * 365 + Number(months) * 30 + Number(weeks) * 7 + Number(days));
}

const words = (value) =>
  text(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * A protocol's design, read and written back whole: what the protocol says of
 * arms, epochs, objectives, endpoints, estimands and the population. Nothing
 * here is simulated; it is kept to be shown.
 * @param {*} given A design, as `readUsdm` makes one.
 * @returns {?Object} The design, or null when there is none to keep.
 */
function designOf(given) {
  if (!isRecord(given)) return null;
  const named = (entry) => ({
    name: words(entry && entry.name),
    ...(words(entry && entry.type) ? { type: words(entry.type) } : {}),
    ...(words(entry && entry.about) ? { about: words(entry.about) } : {})
  });
  const arms = list(given.arms)
    .map(named)
    .filter((arm) => arm.name);
  const epochs = list(given.epochs)
    .map(named)
    .filter((epoch) => epoch.name);
  const cells = list(given.cells)
    .map((cell) => ({
      arm: words(cell && cell.arm),
      epoch: words(cell && cell.epoch),
      elements: list(cell && cell.elements)
        .map(named)
        .filter((element) => element.name)
    }))
    .filter(
      (cell) =>
        arms.some((arm) => arm.name === cell.arm) &&
        epochs.some((epoch) => epoch.name === cell.epoch)
    );
  const endpoint = (entry) => ({
    id: words(entry && entry.id),
    level: words(entry && entry.level),
    text: words(entry && entry.text)
  });
  const objectives = list(given.objectives)
    .map((objective) => ({
      level: words(objective && objective.level),
      text: words(objective && objective.text),
      endpoints: list(objective && objective.endpoints)
        .map(endpoint)
        .filter((one) => one.text)
    }))
    .filter((objective) => objective.text);
  const estimands = list(given.estimands).map((estimand) => ({
    name: words(estimand && estimand.name),
    summary: words(estimand && estimand.summary),
    population: words(estimand && estimand.population),
    // The endpoint the estimand is of, by its id among the objectives' endpoints.
    endpoint: words(estimand && estimand.endpoint),
    interventions: list(estimand && estimand.interventions)
      .map(words)
      .filter(Boolean),
    events: list(estimand && estimand.events)
      .map((event) => ({
        text: words(event && event.text),
        strategy: words(event && event.strategy)
      }))
      .filter((event) => event.text || event.strategy)
  }));
  const population = isRecord(given.population) ? given.population : {};
  const design = {
    model: words(given.model),
    blinding: words(given.blinding),
    arms,
    epochs,
    cells,
    objectives,
    estimands,
    population: {
      about: words(population.about),
      completes: whole(population.completes),
      sex: words(population.sex),
      analysis: list(population.analysis).map(words).filter(Boolean)
    }
  };
  const holds =
    cells.length ||
    objectives.length ||
    estimands.length ||
    design.population.about ||
    design.model;
  return holds ? design : null;
}

/**
 * What a protocol's design comes to, counted.
 * @param {Object} protocol The protocol.
 * @returns {?{arms: number, epochs: number, objectives: number, endpoints: number, estimands: number}} The counts, or null when the protocol keeps no design.
 */
export function designSaid(protocol) {
  const design = protocol && protocol.design;
  if (!design) return null;
  return {
    arms: design.arms.length,
    epochs: design.epochs.length,
    objectives: design.objectives.length,
    endpoints: design.objectives.reduce((sum, objective) => sum + objective.endpoints.length, 0),
    estimands: design.estimands.length
  };
}

/** The words by which an endpoint names a domain outright. */
const ENDPOINT_DOMAINS = Object.freeze([
  Object.freeze({ id: 'AE', words: /adverse event|\bTEAEs?\b|\bSAEs?\b/i }),
  Object.freeze({ id: 'VS', words: /vital sign/i }),
  Object.freeze({
    id: 'LB',
    words: /laborator|\blabs?\b|hematolog|haematolog|clinical chemistry|urinalysis/i
  })
]);

/**
 * What the schedule and the simulator have for an endpoint. The protocol does
 * not join an endpoint to an activity, so this goes by words: an activity
 * whose name is in the endpoint's text, or a domain the text names.
 * @param {Object} protocol The protocol.
 * @param {string} said The endpoint's text.
 * @returns {{activity: ?string, visits: number, simulated: boolean}} The activity found, the visits it is scheduled at, and whether its data is simulated.
 */
export function endpointLink(protocol, said) {
  const lower = text(said).toLowerCase();
  // An endpoint is tied to a domain only when it names it outright. An
  // activity's looser words (plasma, serum, a sample) would tie a copper
  // balance or a PK parameter to the labs, which simulate neither.
  const named = ENDPOINT_DOMAINS.find((one) => one.words.test(said));
  const visitsOf = (id) => Object.values(protocol.schedule).filter((at) => at.includes(id)).length;
  const scheduledOnes = protocol.activities.filter((activity) => visitsOf(activity.id) > 0);
  // The longest name that is in the text is the nearest.
  const byName = scheduledOnes
    .filter((activity) => activity.name.length > 2 && lower.includes(activity.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
  const domain = named ? named.id : null;
  const byDomain =
    !byName && domain && domain !== 'AE'
      ? scheduledOnes.find((one) => one.domain === domain)
      : null;
  const found = byName || byDomain || null;
  // Adverse events are collected throughout: no visit schedules them.
  if (!found) return { activity: null, visits: 0, simulated: domain === 'AE' };
  const visits = byName
    ? visitsOf(found.id)
    : Object.values(protocol.schedule).filter((at) =>
        at.some((id) => scheduledOnes.some((one) => one.id === id && one.domain === domain))
      ).length;
  return { activity: byName ? found.name : null, visits, simulated: Boolean(found.domain) };
}

/**
 * The efficacy score a protocol points at, with plain numbers to start from:
 * the endpoint its first estimand is of, or else its first primary endpoint,
 * whose activity is on the schedule and is not simulated. The protocol says which
 * score and where it is measured; it holds no assumed effect, so every
 * difference starts at 0.
 * @param {Object} protocol The protocol.
 * @returns {?Object} Settings for `efficacy`, or null when the protocol points at no such score.
 */
export function efficacyOf(protocol) {
  const design = protocol && protocol.design;
  if (!design || protocol.arms.length < 2) return null;
  const endpoints = design.objectives.flatMap((objective) => objective.endpoints);
  const first = design.estimands
    .map((estimand) => endpoints.find((endpoint) => endpoint.id === estimand.endpoint))
    .filter(Boolean);
  // After the estimands' endpoints, only a primary endpoint counts: an
  // exploratory lab or PK endpoint is not the trial's efficacy score.
  const primary = endpoints.filter((endpoint) => /primary/i.test(endpoint.level));
  for (const endpoint of [...first, ...primary]) {
    const link = endpointLink(protocol, endpoint.text);
    if (!link.activity || link.simulated) continue;
    const activity = protocol.activities.find((one) => one.name === link.activity);
    const visits = protocol.visits
      .filter((visit) => (protocol.schedule[visit.id] || []).includes(activity.id))
      .map((visit) => visit.name);
    return {
      name: activity.name,
      endpoint: endpoint.text,
      visits,
      baseline: 50,
      sd: 10,
      change: 0,
      effects: {},
      min: 0,
      max: 100,
      better: 'lower'
    };
  }
  return null;
}

/**
 * Read a protocol and write it back whole, or say what is wrong with it.
 * @param {Object} given A protocol, as `readUsdm` makes one or as a page edited it.
 * @returns {Object} The protocol: every visit with a whole study day and windows, in day order; every activity with its domain; the schedule naming only visits and activities it has.
 */
export function readProtocol(given) {
  if (!isRecord(given)) throw new ProtocolError('This is not a protocol.');
  const visits = [];
  for (const visit of list(given.visits)) {
    const id = text(visit && visit.id);
    const day = whole(visit && visit.day);
    if (!id || visits.some((other) => other.id === id)) continue;
    if (day === null || day === 0) {
      throw new ProtocolError(
        `The visit ${text(visit.name) || id} needs a study day: a whole number that is not 0. Day 1 is the first dose; the day before it is -1.`
      );
    }
    visits.push({
      id,
      name: text(visit.name) || id,
      epoch: text(visit.epoch),
      day,
      before: Math.max(0, whole(visit.before) || 0),
      after: Math.max(0, whole(visit.after) || 0)
    });
  }
  if (!visits.length) throw new ProtocolError('The protocol has no visits.');
  visits.sort((a, b) => a.day - b.day);
  const names = new Set();
  for (const visit of visits) {
    if (names.has(visit.name)) {
      throw new ProtocolError(
        `Two visits are called ${visit.name}. Each visit needs a name of its own.`
      );
    }
    names.add(visit.name);
  }
  const activities = [];
  for (const activity of list(given.activities)) {
    const id = text(activity && activity.id);
    if (!id || activities.some((other) => other.id === id)) continue;
    const collects = list(activity.collects).map(text).filter(Boolean);
    const name = text(activity.name) || id;
    const told = ACTIVITY_DOMAINS.some((domain) => domain.id === activity.domain);
    activities.push({
      id,
      name,
      // A domain a page chose stands; `null` is a choice too.
      domain: told || activity.domain === null ? activity.domain : domainOf(name, collects),
      collects
    });
  }
  const known = new Set(activities.map((activity) => activity.id));
  const schedule = {};
  for (const visit of visits) {
    const at = isRecord(given.schedule) ? list(given.schedule[visit.id]) : [];
    schedule[visit.id] = [...new Set(at.filter((id) => known.has(id)))];
  }
  const design = designOf(given.design);
  const notes = list(given.notes).map(text).filter(Boolean);
  return {
    format: PROTOCOL_FORMAT,
    name: text(given.name) || 'Protocol',
    title: text(given.title),
    source: isRecord(given.source) ? { ...given.source } : { kind: 'edited' },
    phase: text(given.phase),
    indication: text(given.indication),
    participants: whole(given.participants),
    arms: list(given.arms).map(text).filter(Boolean),
    epochs: list(given.epochs).map(text).filter(Boolean),
    visits,
    activities,
    schedule,
    // What else the protocol says, kept to be shown. Left out when it says none.
    ...(design ? { design } : {}),
    // What the reader left out of the file it read, a sentence each.
    ...(notes.length ? { notes } : {})
  };
}

/** A phase as study.builder names one, from USDM's words for it. */
function phaseOf(decode) {
  const said = text(decode).toUpperCase();
  const match = /PHASE\s+(IV|III|II|I|[1-4])\b/.exec(said);
  if (!match) return '';
  return { I: 'P1', II: 'P2', III: 'P3', IV: 'P4', 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' }[match[1]];
}

/**
 * Read a CDISC USDM study definition: its first version's first design, and
 * that design's main timeline.
 * @param {Object|string} given The USDM JSON, as text or parsed.
 * @returns {Object} The protocol.
 */
export function readUsdm(given) {
  let document = given;
  if (typeof given === 'string') {
    try {
      document = JSON.parse(given);
    } catch {
      throw new ProtocolError('This file is not JSON, so it is not a USDM study definition.');
    }
  }
  const study = isRecord(document) && isRecord(document.study) ? document.study : null;
  const version = study && list(study.versions)[0];
  // study.builder reads version 4 of the model. An earlier one keeps its
  // timings and its designs elsewhere, so it is refused and not half read.
  const said = text(isRecord(document) ? document.usdmVersion : '');
  const major = Number.parseInt(said, 10);
  if (said && Number.isFinite(major) && major < 4) {
    throw new ProtocolError(
      `This study definition is USDM version ${said}. study.builder reads version 4: export it again as USDM 4.`
    );
  }
  const left = [];
  if (said && Number.isFinite(major) && major > 4) {
    left.push(
      `The file is USDM version ${said}; it was read as version 4, so anything new in it is left out.`
    );
  }
  const designs = version ? list(version.studyDesigns) : [];
  if (designs.length > 1) {
    left.push(`The file holds ${designs.length} study designs; the first was read.`);
  }
  const design = designs[0];
  if (!design) {
    throw new ProtocolError(
      'This is not a USDM study definition study.builder can read: it has no study design.'
    );
  }
  const timelines = list(design.scheduleTimelines);
  // The main timeline is flagged; where none is, it is the one with the most visits.
  const main =
    timelines.find((timeline) => timeline.mainTimeline) ||
    [...timelines].sort((a, b) => list(b.instances).length - list(a.instances).length)[0];
  if (!main) throw new ProtocolError('The study design has no schedule timeline.');
  const others = timelines.filter((timeline) => timeline !== main);
  if (others.length) {
    left.push(
      `${others.length} other timeline${others.length === 1 ? '' : 's'} in the file ${others.length === 1 ? 'is' : 'are'} not simulated (${others.map((timeline) => text(timeline.label) || text(timeline.name)).join(', ')}): the times within a visit, and what happens off the schedule.`
    );
  }
  const decisions = list(main.instances).filter(
    (instance) => instance.instanceType === 'ScheduledDecisionInstance'
  ).length;
  if (decisions) {
    left.push(
      `The schedule has ${decisions} decision point${decisions === 1 ? '' : 's'}; every visit is read as if each participant has it, whichever way a decision goes.`
    );
  }

  const instances = list(main.instances).filter(
    (instance) => instance.instanceType === 'ScheduledActivityInstance'
  );
  const timingOf = new Map(
    list(main.timings).map((timing) => [timing.relativeFromScheduledInstanceId, timing])
  );
  // Each visit's study day: the fixed reference is day 1, and every other is
  // so long before or after the visit its timing is counted from.
  const days = new Map();
  const dayOf = (id, seen = new Set()) => {
    if (days.has(id)) return days.get(id);
    const timing = timingOf.get(id);
    if (!timing || seen.has(id)) return null;
    seen.add(id);
    const kind = text(timing.type && timing.type.decode).toLowerCase();
    let day = null;
    if (kind.startsWith('fixed')) day = 1;
    else {
      const from = dayOf(timing.relativeToScheduledInstanceId, seen);
      const span = daysOf(timing.value);
      if (from !== null && span !== null) {
        day = kind === 'before' ? from - span : from + span;
        // There is no day 0: the day before day 1 is -1.
        if (from >= 1 && day < 1) day -= 1;
        if (from < 1 && day >= 0) day += 1;
      }
    }
    days.set(id, day);
    return day;
  };

  const epochs = new Map(list(design.epochs).map((epoch) => [epoch.id, epoch]));
  const encounters = new Map(list(design.encounters).map((encounter) => [encounter.id, encounter]));
  const perEncounter = new Map();
  for (const instance of instances) {
    perEncounter.set(instance.encounterId, (perEncounter.get(instance.encounterId) || 0) + 1);
  }
  const visits = [];
  const schedule = {};
  const used = new Set();
  const unplaced = [];
  for (const instance of instances) {
    const day = dayOf(instance.id);
    if (day === null) {
      unplaced.push(text(instance.label) || text(instance.name) || instance.id);
      continue; // a visit with no planned day cannot be scheduled
    }
    const encounter = encounters.get(instance.encounterId) || {};
    const timing = timingOf.get(instance.id) || {};
    // Two instances of one encounter are told apart by their timing's name.
    let name =
      perEncounter.get(instance.encounterId) > 1 && text(timing.label)
        ? text(timing.label)
        : text(encounter.label) || text(encounter.name) || text(timing.label) || instance.name;
    while (used.has(name)) name = `${name} (${instance.name})`;
    used.add(name);
    const epoch = epochs.get(instance.epochId) || {};
    visits.push({
      id: instance.id,
      name,
      epoch: text(epoch.label) || text(epoch.name),
      day,
      before: daysOf(timing.windowLower) || 0,
      after: daysOf(timing.windowUpper) || 0
    });
    schedule[instance.id] = list(instance.activityIds);
  }
  if (!visits.length) {
    throw new ProtocolError('The main timeline has no visit with a planned time.');
  }
  if (unplaced.length) {
    left.push(
      `${unplaced.length} visit${unplaced.length === 1 ? ' has' : 's have'} no planned time in the file and ${unplaced.length === 1 ? 'is' : 'are'} left out: ${unplaced.join(', ')}.`
    );
  }
  // Visits the file times in hours or minutes land on the same study day.
  const perDay = new Map();
  for (const visit of visits) perDay.set(visit.day, (perDay.get(visit.day) || 0) + 1);
  const shared = [...perDay.values()].filter((count) => count > 1).length;
  if (shared) {
    left.push(
      `${shared} study day${shared === 1 ? ' has' : 's have'} more than one visit; they are kept apart by name, and simulated on the same day.`
    );
  }

  // What an activity collects: its biomedical concepts, and the surrogates a
  // file names where it has no concept for something (a lab test by its name).
  const concepts = new Map(
    [
      ...list(version.biomedicalConcepts),
      ...list(design.biomedicalConcepts),
      ...list(version.bcSurrogates),
      ...list(design.bcSurrogates)
    ].map((concept) => [concept.id, text(concept.label) || text(concept.name)])
  );
  const activities = list(design.activities).map((activity) => ({
    id: activity.id,
    name: text(activity.label) || text(activity.name),
    collects: [
      ...new Set(
        [...list(activity.biomedicalConceptIds), ...list(activity.bcSurrogateIds)]
          .map((id) => concepts.get(id))
          .filter(Boolean)
      )
    ]
  }));
  const timed = list(design.activities).filter((activity) => activity.timelineId).length;
  if (timed) {
    left.push(
      `${timed} activit${timed === 1 ? 'y has' : 'ies have'} a timeline of ${timed === 1 ? 'its' : 'their'} own within a visit (sampling at set hours, say); ${timed === 1 ? 'it is' : 'they are'} simulated once a visit.`
    );
  }

  const population = isRecord(design.population) ? design.population : {};
  // A planned number is a quantity, or a range whose upper end is taken.
  const numberOf = (given) => {
    if (!isRecord(given)) return given;
    if (given.value !== undefined && given.value !== null) return given.value;
    const top = isRecord(given.maxValue) ? given.maxValue.value : given.maxValue;
    return top === undefined ? null : top;
  };
  const planned = numberOf(population.plannedEnrollmentNumber);
  const phase = isRecord(design.studyPhase) ? design.studyPhase.standardCode : null;
  // The design: what each arm gets in each epoch, the objectives with their
  // endpoints, the estimands and the population, as the file says them.
  const decode = (code) => text(isRecord(code) ? code.decode : '');
  const called = (entry) => text(entry && entry.label) || text(entry && entry.name);
  const armNames = new Map(list(design.arms).map((arm) => [arm.id, called(arm)]));
  const elements = new Map(list(design.elements).map((element) => [element.id, element]));
  const interventions = new Map(
    list(version.studyInterventions).map((one) => [one.id, called(one)])
  );
  const analysisSets = new Map(
    list(design.analysisPopulations).map((one) => [one.id, text(one.text) || called(one)])
  );
  const count = numberOf;
  const described = {
    model: decode(design.model),
    blinding: decode(isRecord(design.blindingSchema) ? design.blindingSchema.standardCode : null),
    arms: list(design.arms).map((arm) => ({
      name: called(arm),
      type: decode(arm.type),
      about: text(arm.description)
    })),
    epochs: list(design.epochs).map((epoch) => ({
      name: called(epoch),
      type: decode(epoch.type),
      about: text(epoch.description)
    })),
    cells: list(design.studyCells).map((cell) => ({
      arm: armNames.get(cell.armId),
      epoch: called(epochs.get(cell.epochId)),
      elements: list(cell.elementIds)
        .map((id) => elements.get(id))
        .filter(Boolean)
        .map((element) => ({ name: called(element), about: text(element.description) }))
    })),
    objectives: list(design.objectives).map((objective) => ({
      level: decode(objective.level),
      text: objective.text,
      endpoints: list(objective.endpoints).map((endpoint) => ({
        id: endpoint.id,
        level: decode(endpoint.level),
        text: endpoint.text
      }))
    })),
    estimands: list(design.estimands).map((estimand) => ({
      name: called(estimand),
      summary: estimand.populationSummary,
      population: analysisSets.get(estimand.analysisPopulationId),
      endpoint: estimand.variableOfInterestId,
      interventions: list(estimand.interventionIds).map((id) => interventions.get(id)),
      events: list(estimand.intercurrentEvents).map((event) => ({
        text: event.text,
        strategy: event.strategy
      }))
    })),
    population: {
      about: text(population.description),
      completes: count(population.plannedCompletionNumber),
      sex: list(population.plannedSex).map(decode).filter(Boolean).join(', '),
      analysis: [...analysisSets.values()]
    }
  };
  const indication = list(design.indications)[0] || {};
  const titles = list(version.titles);
  return readProtocol({
    name: text(study.name) || 'Protocol',
    title: text((titles[0] || {}).text),
    source: {
      kind: 'usdm',
      version: text(document.usdmVersion),
      timeline: text(main.label) || text(main.name)
    },
    phase: phaseOf(phase && phase.decode),
    indication: text(indication.label) || text(indication.name),
    participants: whole(planned),
    arms: list(design.arms).map((arm) => text(arm.label) || text(arm.name)),
    epochs: list(design.epochs).map((epoch) => text(epoch.label) || text(epoch.name)),
    visits,
    activities,
    schedule,
    design: described,
    notes: left
  });
}

/**
 * Whether a document is a USDM study definition, by its shape.
 * @param {*} document What a file parsed to.
 * @returns {boolean} True when it has a study with versions.
 */
export function isUsdm(document) {
  return isRecord(document) && isRecord(document.study) && Array.isArray(document.study.versions);
}

/**
 * The settings a protocol fills in: its name, its phase, its planned
 * participants and how long its schedule runs, each within what the simulator
 * takes. A setting the protocol does not say is left out.
 * @param {Object} protocol The protocol.
 * @param {{participants: {min: number, max: number}, months: {min: number, max: number}}} limits The simulator's limits.
 * @returns {{settings: Object, notes: string[]}} The settings, and a sentence for each the limits changed.
 */
export function protocolSettings(protocol, limits) {
  const settings = {};
  const notes = [];
  const name = protocol.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (name) settings.name = name.toUpperCase().slice(0, 24);
  if (protocol.phase) settings.phase = protocol.phase;
  if (protocol.participants) {
    const { min, max } = limits.participants;
    settings.participants = Math.min(max, Math.max(min, protocol.participants));
    if (settings.participants !== protocol.participants) {
      notes.push(
        `The protocol plans ${protocol.participants} participants; the simulator takes ${min} to ${max}, so this study has ${settings.participants}.`
      );
    }
  }
  const last = Math.max(...protocol.visits.map((visit) => visit.day));
  const months = Math.ceil(last / 30);
  const { min, max } = limits.months;
  settings.months = Math.min(max, Math.max(min, months));
  if (months > max) {
    notes.push(
      `The schedule runs to day ${last}; the simulator follows a study for ${max} months at most, so later visits are not reached.`
    );
  }
  // The schedule needs visits, and the domains its activities stand for.
  const domains = new Set(['VISIT']);
  for (const activity of scheduled(protocol)) if (activity.domain) domains.add(activity.domain);
  settings.domains = [...domains];
  return { settings, notes };
}

/** The activities that are at one visit or more. */
function scheduled(protocol) {
  const at = new Set(Object.values(protocol.schedule).flat());
  return protocol.activities.filter((activity) => at.has(activity.id));
}

/**
 * What R is told of a protocol: each visit with its day and window, whether
 * vital signs are taken at it, and the lab panels drawn at it, each with the
 * tests the protocol lists or none when it lists none.
 * @param {Object} protocol The protocol.
 * @returns {Array<{name: string, day: number, before: number, after: number, vs: boolean, lb: Array<{panel: string, tests: string[]}>}>} The plan, in day order.
 */
export function planOf(protocol) {
  const byId = new Map(protocol.activities.map((activity) => [activity.id, activity]));
  return protocol.visits.map((visit) => {
    const here = (protocol.schedule[visit.id] || []).map((id) => byId.get(id)).filter(Boolean);
    return {
      name: visit.name,
      day: visit.day,
      before: visit.before,
      after: visit.after,
      vs: here.some((activity) => activity.domain === 'VS'),
      lb: here
        .filter((activity) => activity.domain === 'LB')
        .map((activity) => ({ panel: activity.name, tests: activity.collects }))
    };
  });
}

/** A protocol's schedule in a line: `16 visits from day -13 to day 183, 36 activities, 9 simulated`. */
export function protocolSaid(protocol) {
  const days = protocol.visits.map((visit) => visit.day);
  const at = scheduled(protocol);
  const simulated = at.filter((activity) => activity.domain).length;
  const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  return `${plural(protocol.visits.length, 'visit')} from day ${Math.min(...days)} to day ${Math.max(...days)}, ${plural(at.length, 'activity').replace('activitys', 'activities')}, ${simulated} simulated`;
}
