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
// schedule. Everything else a protocol says is kept and shown, and simulates
// nothing yet: arms, epochs, and activities of no domain the simulator makes.

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
    schedule
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
  const design = version && list(version.studyDesigns)[0];
  if (!design) {
    throw new ProtocolError(
      'This is not a USDM study definition study.builder can read: it has no study design.'
    );
  }
  const timelines = list(design.scheduleTimelines);
  const main = timelines.find((timeline) => timeline.mainTimeline) || timelines[0];
  if (!main) throw new ProtocolError('The study design has no schedule timeline.');

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
  for (const instance of instances) {
    const day = dayOf(instance.id);
    if (day === null) continue; // a visit with no planned day cannot be scheduled
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

  const concepts = new Map(
    [...list(version.biomedicalConcepts), ...list(design.biomedicalConcepts)].map((concept) => [
      concept.id,
      text(concept.label) || text(concept.name)
    ])
  );
  const activities = list(design.activities).map((activity) => ({
    id: activity.id,
    name: text(activity.label) || text(activity.name),
    collects: [
      ...new Set(
        list(activity.biomedicalConceptIds)
          .map((id) => concepts.get(id))
          .filter(Boolean)
      )
    ]
  }));

  const population = isRecord(design.population) ? design.population : {};
  const planned = isRecord(population.plannedEnrollmentNumber)
    ? population.plannedEnrollmentNumber.value
    : population.plannedEnrollmentNumber;
  const phase = isRecord(design.studyPhase) ? design.studyPhase.standardCode : null;
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
    schedule
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
