// A study's metadata: what the study is, and a spec for every table in every
// layer. A spec says what the table is, what made it, which columns are its
// key, and for each column its label, its type and what it joins to. A chart,
// a viewer or another package reads the spec and need not guess.
//
// Where each part comes from:
// - Types are R's, for every column of every table.
// - A table built by one of study.builder's workflows takes its labels and its
//   keys from the workflow file (`columns` and `meta.Keys`).
// - gsm's raw and mapped tables carry no labels of their own, so theirs are
//   read from RAW_LABELS below. That list is study.builder's reading of gsm's
//   column names, not gsm's dictionary: a column it does not list has no label.
// - Keys of gsm's tables are the short list in KEYS; `npm run test:r` holds
//   every key to the data, which must have one row for each value of it.
// - Joins follow from names: a column that is another table's key joins to it.

const list = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);

/** study.builder's reading of gsm's raw column names. */
export const RAW_LABELS = Object.freeze({
  studyid: 'Study id',
  subjid: 'Participant id',
  subject_nsv: 'Participant id, as the source system writes it',
  subjectid: 'Participant id, as the source system writes it',
  invid: 'Site id',
  country: 'Country',
  Country: 'Country',
  City: 'City',
  State: 'State or region',
  InvestigatorFirstName: 'Investigator’s first name',
  InvestigatorLastName: 'Investigator’s last name',
  site_status: 'Site status',
  site_active_dt: 'Date the site became active',
  nickname: 'Study nickname',
  protocol_title: 'Protocol title',
  status: 'Status',
  num_plan_site: 'Planned number of sites',
  num_plan_subj: 'Planned number of participants',
  act_fpfv: 'Actual first participant, first visit',
  est_fpfv: 'Estimated first participant, first visit',
  est_lpfv: 'Estimated last participant, first visit',
  est_lplv: 'Estimated last participant, last visit',
  db_lock_dt: 'Database lock date',
  therapeutic_area: 'Therapeutic area',
  protocol_indication: 'Indication',
  phase: 'Phase',
  product: 'Product',
  agerep: 'Age, as reported',
  sex: 'Sex',
  race: 'Race',
  enrollyn: 'Enrolled (Y or N)',
  enrolldt: 'Enrolment date',
  enroll_dt: 'Enrolment date',
  timeonstudy: 'Days on study',
  timeontreatment: 'Days on treatment',
  firstparticipantdate: 'Date of the participant’s first record',
  firstdosedate: 'Date of first dose',
  mincreated_dts: 'When the record was first created',
  visit_dt: 'Visit date',
  visit: 'Visit',
  visnam: 'Visit',
  instancename: 'Visit, as the source system names it',
  aeser: 'Serious (Y or N)',
  mdrpt_nsv: 'Preferred term',
  mdrsoc_nsv: 'System organ class',
  aetoxgr: 'Toxicity grade',
  aeongo: 'Ongoing (Y or N)',
  aerel: 'Related to study drug (Y or N)',
  aest_dt: 'Start date',
  aeen_dt: 'End date',
  toxgrg_nsv: 'Toxicity grade',
  lb_dt: 'Lab date',
  battrnam: 'Lab panel',
  lbtstnam: 'Lab test',
  vs_dt: 'Vital signs date',
  vsperf_std: 'Vital signs taken (Y or N)',
  weight: 'Weight',
  height: 'Height',
  bsa: 'Body surface area',
  sysbp: 'Systolic blood pressure',
  diabp: 'Diastolic blood pressure',
  pulse: 'Pulse',
  temp: 'Temperature',
  resp: 'Respiratory rate',
  deemedimportant: 'Important deviation (Y or N)',
  dvdecod: 'Deviation category',
  dvterm: 'Deviation description',
  dvdtm: 'Deviation date and time',
  compyn: 'Completed the study (Y or N)',
  compreas: 'Reason for leaving the study',
  sdrgyn: 'Completed study drug (Y or N)'
});

/** The labels of the columns gsm's analysis and reporting tables share. */
export const RESULT_LABELS = Object.freeze({
  SubjectID: 'Participant id',
  GroupID: 'Group id: a site, for a site-level metric',
  GroupLevel: 'What a group is: Site, Country or Study',
  Numerator: 'Numerator',
  Denominator: 'Denominator',
  Metric: 'The metric: numerator over denominator',
  Score: 'The model’s score for the group',
  Flag: 'Flag: 0 within limits; 1 or -1 amber; 2 or -2 red',
  MetricID: 'Metric id',
  SnapshotDate: 'Snapshot date',
  StudyID: 'Study id',
  Param: 'What is said of the group',
  Value: 'Its value',
  Threshold: 'The limit the line marks',
  LogDenominator: 'Log of the denominator'
});

/** The keys of gsm's tables, by layer and table id. */
export const KEYS = Object.freeze({
  raw: Object.freeze({ STUDY: ['studyid'], SITE: ['invid'], SUBJ: ['subjid'] }),
  'raw.rbqm': Object.freeze({ SUBJ: ['subjid'] }),
  reporting: Object.freeze({
    Results: ['GroupLevel', 'GroupID', 'MetricID'],
    Metrics: ['MetricID']
  })
});

/** The key of a table, when it has one that is known. */
function keysOf(table) {
  if (table.keys && table.keys.length) return [...table.keys];
  if (table.layer === 'analysis' && /^kri\d+/.test(table.id)) {
    return table.id.endsWith('_input') ? ['SubjectID'] : ['GroupID'];
  }
  return [...((KEYS[table.layer] || {})[table.id] || [])];
}

/**
 * A study's metadata.
 * @param {Object} study What `studyOf` made, with its layers.
 * @returns {{study: Object, layers: Object[], tables: Object[]}} What the study is, what each layer is, and a spec for every table.
 */
export function metadataOf(study) {
  const specs = [];
  for (const layer of study.layers) {
    for (const table of layer.tables) {
      specs.push({
        layer: layer.id,
        id: table.id,
        table: table.table,
        file: table.name,
        label: table.label,
        about: table.about || table.grain || table.description || '',
        rows: table.rows,
        keys: keysOf(table),
        made: { workflow: table.made.workflow, from: [...table.made.from] },
        columns: []
      });
    }
  }
  // A column that is another table's whole key joins to that table: within
  // its own layer first, then in the layer it was built from.
  // A metric's own tables are not what another table joins to: a group id
  // is a site, and many tables are keyed by it.
  const single = specs.filter((spec) => spec.keys.length === 1 && spec.layer !== 'analysis');
  const joinOf = (spec, name) => {
    const aliases = {
      USUBJID: ['USUBJID', 'subjid'],
      SubjectID: ['SubjectID', 'subjid'],
      SITEID: ['SITEID', 'invid']
    }[name] || [name];
    const found =
      single.find(
        (other) => other !== spec && other.layer === spec.layer && aliases.includes(other.keys[0])
      ) ||
      single.find(
        (other) => other !== spec && other.layer === 'raw' && aliases.includes(other.keys[0])
      ) ||
      single.find((other) => other !== spec && aliases.includes(other.keys[0]));
    return found ? { layer: found.layer, id: found.id, column: found.keys[0] } : null;
  };
  for (const layer of study.layers) {
    for (const table of layer.tables) {
      const spec = specs.find((one) => one.layer === layer.id && one.id === table.id);
      const lines = new Map(list(table.mapping).map((line) => [line.column, line]));
      const was = new Map(list(table.renamed).map((line) => [line.column, line.was]));
      const labels = ['analysis', 'reporting'].includes(layer.id) ? RESULT_LABELS : RAW_LABELS;
      spec.columns = table.columns.map((column) => {
        const line = lines.get(column.name);
        const join =
          spec.keys.includes(column.name) && spec.keys.length === 1
            ? null
            : joinOf(spec, column.name);
        return {
          name: column.name,
          type: column.type,
          label: (line && line.label) || labels[column.name] || '',
          key: spec.keys.includes(column.name),
          ...(join ? { joins: join } : {}),
          ...(was.has(column.name) ? { was: was.get(column.name) } : {}),
          ...(line ? { from: line.from, how: line.how } : {})
        };
      });
    }
  }
  return {
    study: {
      id: study.id,
      snapshot_date: study.snapshotDate,
      snapshots: study.snapshots,
      phase: study.args.phase,
      therapeutic_area: study.args.therapeutic_area,
      participants: study.args.participants,
      sites: study.args.sites,
      months: study.args.months
    },
    layers: study.layers.map((layer) => ({
      id: layer.id,
      label: layer.label,
      about: layer.about,
      tables: layer.tables.map((table) => table.id)
    })),
    tables: specs
  };
}
