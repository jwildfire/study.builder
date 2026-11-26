# study.builder

Simulate a clinical trial in the browser, look at every domain, and hand the data to any page.

You describe a trial: its phase, therapeutic area, participants, sites, months and the domains you want. [gsm.datasim](https://github.com/Gilead-Public/gsm.datasim) simulates it with R running in your browser. Nothing is installed and nothing is sent anywhere.

Try it: https://jwildfire.github.io/study.builder/

Status: experimental. v0.4.0 is the latest release; v0.5.0 is in release candidates. Every row is synthetic.

## Three modules

study.builder is three things a reader uses, each with its parts. A page takes all three together, or one alone.

| Module        | What it is                       | Its parts                                                                                                                                                                                                                                                                                                       | On a page                                                                                                 |
| ------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Portfolio     | The list of studies you can have | Ready-made studies with their data; studies saved in this browser; settings only, which Build makes; opening a study or settings file                                                                                                                                                                           | The first screen of `StudyBuilder.mount`. A page with its own list reads `fetchPresets` and `createShelf` |
| Study view    | One study, looked through        | Its facts in a line, then five sections: Overview; Design (Protocol and Schedule, when it followed a protocol); Data (Pipeline, Tables, Columns); Operations (RBQM, Safety, One participant); Reporting (Efficacy and Adverse events, by arm). `operations: false` leaves RBQM and Safety to the page around it | `StudyBuilder.mountStudy(target, { study })`                                                              |
| Study builder | A study described, and built     | The trial (phase, area, size, seed); a protocol's schedule of activities, edited as a grid; the layers and raw domains; what building gives, and the build                                                                                                                                                      | The form of `StudyBuilder.mount`; `buildStudy` and `createBuilder` with no page                           |

- Planned, not built: a **program builder**, which describes and builds several studies together.
- **Snapshots.** gsm.datasim makes a study as a snapshot a month. Ask for every month (`snapshots: 'all'`, or Snapshots kept in the form) and the study view has a snapshot picker: the study as it stood at any month, through every layer, and a table of how it grew. `study.history` lists them and `study.at(date)` returns one. The last only is kept unless asked, since every month is several times the work and the size.
- Each has its own folder under `src/`: `portfolio`, `study` and `builder`.
- Each has a page of its own on the site: [portfolio](https://jwildfire.github.io/study.builder/portfolio.html), [study view](https://jwildfire.github.io/study.builder/study.html) and [study builder](https://jwildfire.github.io/study.builder/builder.html).
- Under all three is one engine (settings, the build in R, layers, metadata, saving and opening) that has no page. [ARCHITECTURE.md](ARCHITECTURE.md) has how the code is laid out.

## What it gives you

- **A study in layers.** Raw is the root: what gsm.datasim simulates. Every other layer is built off it by workflows, and every table says which workflow made it and what that workflow read.
- **A plain function.** Settings in, data out, with no page at all. This is how another package loads simulated data.
- **Assumptions you can set.** How many participants leave early, how adverse events follow the arm, and what an efficacy score does by arm. gsm.datasim makes the data; the settings travel with the study.
- **A manifest.** A checksum for every table and one key for the whole study. The same tables always give the same key.

## Layers

| Layer     | Id          | What it is                                                                                                              | Built by                                        |
| --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Raw       | `raw`       | One table per domain, as a study database gives them                                                                    | gsm.datasim                                     |
| Raw.RBQM  | `raw.rbqm`  | The mapped tables that differ from raw; a copy of a raw table is dropped and the metrics read raw                       | gsm.mapping's own workflows                     |
| ADaM      | `adam`      | Analysis-ready tables for charts of participants: ADSL, ADAE, ADVS                                                      | study.builder's workflows, in `workflows/adam/` |
| Analysis  | `analysis`  | Statistics worked out from a data layer: gsm's eight site metrics from Raw.RBQM, and an adverse event summary from ADaM | gsm.kri's workflows, and `workflows/analysis/`  |
| Reporting | `reporting` | Results in the shape a chart reads: gsm's Results, Bounds, Groups and Metrics                                           | gsm.reporting's workflows                       |

A layer made from another brings it: reporting brings analysis, and analysis brings Raw.RBQM and ADaM.

- Every step off raw is a [workr](https://github.com/Gilead-Public/workr) workflow: a YAML file with a spec (the tables and columns it reads) and steps. No table is derived by hand-written code.
- A workflow runs only when every table it reads is there, so a study with no adverse events has no ADAE and nothing fails.
- Each ADaM workflow has a `columns` block that says where every column it writes came from. That is the mapping the widget shows, and where custom column transformers will be edited.
- The ADaM tables are a light form: enough for charts, not a submission. There is no SDTM layer yet.
- Analysis and Reporting belong to no one domain. The analysis layer already reads two data layers: gsm's site metrics read Raw.RBQM, and the adverse event summary reads ADaM.

## Metadata

Every study carries a spec for every table, in `study.metadata`, and `study.spec(layer, id)` returns one.

- A spec has the table's label, what it is, what made it, its key, and for each column its label, its type and what it joins to.
- Types are R's. A table built by one of study.builder's workflows takes its labels and its key from the workflow file.
- gsm's raw and mapped tables carry no labels of their own. Theirs are study.builder's reading of gsm's column names (`StudyBuilder.RAW_LABELS`), not gsm's dictionary; a column it does not list has no label.
- A raw column that gsm.datasim named otherwise says what it was called (`was`).
- `npm run test:r` holds every key to the data: one row for each of its values.

## Use it on a page

```html
<script src="https://jwildfire.github.io/study.builder/study.builder.js"></script>
<div id="builder"></div>
<script>
  StudyBuilder.mount('#builder', {
    // Called when the reader presses "Use this study".
    onStudy(study) {
      const { raw, standard } = study.files(); // each a list of { name, text }
      myApp.loadRaw(raw);
      myApp.loadFiles(standard);
    }
  });
</script>
```

Options of `mount(target, options)`:

| Option       | What it does                                                                             |
| ------------ | ---------------------------------------------------------------------------------------- |
| `settings`   | What the form opens on (see Settings).                                                   |
| `onStudy`    | Called with the study when the reader hands it over. With none, there is no such button. |
| `onBuilt`    | Called with each study as it is built.                                                   |
| `useLabel`   | The hand-over button's words. Default: "Use this study".                                 |
| `base`       | Where study.builder's `r/` and `vendor/` folders are served. Default: beside the script. |
| `connection` | A connection to R your page already has, so R is started once (see Sharing R).           |
| `theme`      | `light` or `dark`. Default: it matches the page behind it, light or dark.                |

It returns a handle: `build()`, `study()`, `settings()`, `state()` and `destroy()`.

## Use it with no page

```js
const study = await StudyBuilder.buildStudy({
  participants: 200,
  sites: 15,
  months: 6,
  domains: ['AE', 'LB', 'VS']
});

study.layers; // raw first, then each layer built off it, each with its tables
study.table('adam', 'ADAE'); // one table: rows, columns, text (CSV), made, mapping
study.spec('adam', 'ADAE'); // its key, and each column's label, type and joins
study.metadata; // what the study is, and a spec for every table
study.manifest; // a checksum per table, the package versions, the settings, one key
StudyBuilder.overviewOf(study); // the trial, its counts, its countries, what each layer holds
StudyBuilder.columnsOf(study.table('raw', 'AE')); // each column: how full, how many values, its range
study.files(); // { raw, standard, layers }: each a list of { name, text }, layers by id

// The v0.1 names still work: the raw layer and the ADaM layer.
study.domains;
study.standard;
```

To build more than one study, keep a builder so R starts once:

```js
const builder = StudyBuilder.createBuilder();
const small = await builder.build({ phase: 'P1', participants: 40, sites: 4, months: 6 });
const large = await builder.build({ phase: 'P3', participants: 500, sites: 60, months: 12 });
```

A build that cannot be made rejects with a `StudyBuilderError` whose message is a sentence you can show, and whose `problems` lists each one.

## Saving, opening and presets

A study takes seconds to build after R has started, and half a minute the first time. A saved study opens with no R at all.

- **On the page.** It opens on the portfolio: the page's ready-made studies and what the reader saved in this browser, each a press from open, with the form behind New study. Save and Save settings keep the open study or the form's settings in the browser (IndexedDB; nothing is sent anywhere). Study file and Settings file download them, and Open a file reads either back.
- **With no page.**

```js
const document = StudyBuilder.savedOf(study); // settings, and what R returned
const again = await StudyBuilder.openStudy(document); // the same study, no R
again.manifest.key === study.manifest.key; // true: the key is checked on opening

const config = StudyBuilder.configOf({ participants: 80, sites: 8, seed: 5 });
const built = await StudyBuilder.buildStudy(config.settings);
```

- **Presets.** `presets/presets.json` lists them, by hand. One marked `hosted` has its study built by `npm run presets` and kept gzipped beside the list; a page opens it at once. The others are settings only. The widget reads `presets/index.json` under its base; pass `presets: 'https://…/index.json'`, a list of your own, or `false`.

| Format                    | What it is                                                                     |
| ------------------------- | ------------------------------------------------------------------------------ |
| `study.builder/config/1`  | Settings: building makes the study                                             |
| `study.builder/study/1`   | Settings, the key, and what R returned for them                                |
| `study.builder/presets/1` | A list of presets: each one settings, and for some the address of a study file |

## study.viewer

A second, separate module in this repository: a viewer for any study's tables. It knows nothing of the builder or of R.

```html
<script src="https://jwildfire.github.io/study.builder/study.viewer.js"></script>
<div id="viewer"></div>
<script>
  StudyViewer.mount('#viewer', {
    study: {
      name: 'My files',
      tables: [
        { id: 'dm.csv', text: dmCsvText },
        { id: 'ae.csv', records: aeRows, group: 'Clinical' }
      ]
    }
  });
  // A study.builder study, listed by layer, with what built each table:
  // StudyViewer.mount('#viewer', { study: StudyViewer.fromBuilt(study) });
</script>
```

- **Tables**: the open table's rows, filtered (`is`, `is not`, `contains`, `at least`, `at most`) and sorted by a header.
- **Columns**: each column's kind, how full it is, its range or commonest values and a spread. Pressing a bar filters the rows to it. A column may carry `used` (what a page uses it as) or `todo` (a button, for a page that maps columns; `onColumn` is told).
- **One participant**: one person's rows in every table that names them, found by a column called `USUBJID`, `SUBJID`, `SubjectID` or the like, or one given `role: 'participant'`.

With no page: `viewerStudy`, `rowsOf`, `filterRows`, `sortRows`, `profileOf`, `participantsOf`, `participantOf`.

## A protocol's schedule of activities

A study can be built on a protocol's schedule in place of the simulator's own eight visits.

```js
const protocol = StudyBuilder.readUsdm(usdmJson); // a CDISC USDM study definition
const { settings } = StudyBuilder.protocolSettings(protocol, StudyBuilder.LIMITS);
const study = await StudyBuilder.buildStudy({ ...settings, protocol });
study.protocol.visits; // the schedule the build followed
```

- **What is read.** The first design's main timeline: each visit's name, epoch, study day and window; the activities; which activity is at which visit; and what an activity collects, where the protocol lists it. Also the phase, planned participants, arms and indication.
- **What a build does with it.** Visits, vital signs and labs follow the schedule. An activity stands for a domain by its name (`ACTIVITY_DOMAINS`); a page may set `activity.domain` itself.
- **What it does not do yet.** Treatment arms, branching and sub-timelines, eligibility and endpoints are kept and shown, and simulate nothing. FHIR is not read, and a protocol is not written back as USDM.
- **Why USDM.** ICH M11's technical specification leaves the schedule of activities as a table, text or image. CDISC's USDM is the model that carries it as data.
- **The example.** `vendor/cdisc-ddf-ra/` holds CDISC's pilot study as a USDM file, from [DDF-RA](https://github.com/cdisc-org/DDF-RA) under CC-BY-4.0, with its record. `npm run protocols` reads it into `protocols/cdisc-pilot.protocol.json`.

## How it is put together

The portfolio, the study view and the study builder each have a folder, over two more with no screens of their own: the engine makes and keeps a study, and the viewer looks through any study. A test holds what each may read. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Settings

| Setting        | Values                                       | Default                                                 |
| -------------- | -------------------------------------------- | ------------------------------------------------------- |
| `name`         | Any text                                     | `BUILT-001`                                             |
| `phase`        | `P1`, `P2`, `P3`, `P4`                       | `P2`                                                    |
| `area`         | `Oncology`, `Virology`, `Inflammation`       | `Oncology`                                              |
| `participants` | 20 to 500                                    | 150                                                     |
| `sites`        | 2 to 100, no more than the participants      | 20                                                      |
| `months`       | 3 to 12                                      | 9                                                       |
| `outliers`     | `few`, `typical`, `many`                     | `typical`                                               |
| `seed`         | A whole number, or left out                  | None: each build differs                                |
| `domains`      | A list of domain ids (see below)             | Visits, AE, labs, vitals, PD, the two completion tables |
| `layers`       | The layers built off raw: `raw.rbqm`, `adam` | Both                                                    |

## Domains

Four are in every study: `STUDY`, `SITE`, `SUBJ` and `ENROLL`.

The rest are optional: `VISIT`, `AE`, `LB`, `VS`, `PD`, `STUDCOMP`, `SDRGCOMP`, `IE`, `PK`, `Randomization`, `OverallResponse`, `Death`, `QUERY`, `DATAENT` and `DATACHG`.

- A domain that is made from another brings it: vital signs and overall response bring visits, and deaths bring study completion.
- `LB`, `QUERY`, `DATAENT` and `DATACHG` grow fast. A 500-participant, 12-month study with the default domains and both layers is about 65 MB of text; leave a layer out with `layers` when you do not need it.

`StudyBuilder.DOMAINS` lists every domain with its label and what one row is.

## What a study built here is, and is not

- Every row is synthetic, made by gsm.datasim. No real participant or site is in it.
- Phase and therapeutic area shape the study results a little, by gsm.datasim's study profile (`?study_profile` in its staging copy lists every number): how often a lab is out of range, which adverse events are commoner, and how many are serious and severe. The sizes are guesses at what is believable, not fitted to data. They do not change how many participants, visits or events a study has.
- Only the study's last monthly snapshot is returned.
- gsm.datasim makes no lab results (only toxicity grades), no treatment arms and no ECGs. Adverse event terms are its placeholders (`term1`, `soc1`).

Nothing is changed in the raw tables after the simulation: the builder makes no data. gsm.datasim is asked for three things it would otherwise do differently, and every study says so in `study.notes`:

- Columns under gsm's names, as gsm.mapping's own specs say, where it would name them as the source system does.
- Site ids that begin `SITE`, where it would write `0X1234`, which R would read back from a file as a number.
- A study table whose phase and therapeutic area are what was asked for.

Vital signs are gsm.datasim's own too, made in every snapshot: a participant's vital signs at a visit are the same in every snapshot that holds them.

## Sharing R

Starting R downloads about 55 MB the first time. A page that already runs R in the browser can have study.builder use the same one, so the reader pays once. There are two ways.

Hand over the page's own way of making a connection. study.builder calls it on the first build, with what R is to be given, so nothing is fetched until the reader presses Build:

```js
StudyBuilder.mount('#builder', {
  createConnection: (options) => myPage.createRConnection(options),
  base: './study.builder/', // where the page serves study.builder's r/ and vendor/ folders
  repository: './r-wasm' // where the page already serves gsm's packages, if it does
});
```

Or hand over a connection that is already made:

```js
StudyBuilder.mount('#builder', { connection: myConnection });
```

A connection is anything with `run(name, { args })` that resolves to `{ status: 'ok', value }`, `{ status: 'unavailable', message }` or `{ status: 'error', message }`, where `value` is R's answer as plain values. A connection handed over ready-made must have been given what `StudyBuilder.rOptions(base)` lists: the packages, the files and the R source to evaluate. study.builder never closes an R it did not start.

## How it works

- `r/builder.R` is the whole of the R. It evaluates gsm.datasim's own source, asks it for the study, runs the workflows that build each layer, and writes every table out.
- `workflows/adam/` holds study.builder's own workflows. Raw.RBQM uses the mapping workflows installed with gsm.mapping.
- gsm.datasim has no WebAssembly build, and it is plain R, so its source is copied from its release tag into `vendor/gsm.datasim/` and evaluated as it is. Nothing in it is edited.
- Vital signs come from gsm.datasim's own generator, given the spec of gsm.mapping v1.3.0's `VS.yaml`, copied into `vendor/gsm.mapping-vitals/`.
- `vendor/r-wasm/` holds WebAssembly builds of workr, gsm.core, gsm.mapping and gsm.reporting, built by [safety.viz](https://github.com/jwildfire/safety.viz)'s workflow and copied from it with their record.
- Every copy has a `SOURCE.json` beside it naming the repository, tag and commit it came from and each file's checksum. `npm run files:check` holds the copies to their records.

## Develop

```sh
npm install
npm test          # unit tests, with a stand-in for R
npm run test:r    # builds studies with real R (webR under Node); downloads about 55 MB
npm run serve     # build _site/ and serve it at http://127.0.0.1:8650/
npm run format
```

`npm run build` writes `dist/` (the two bundles) and `_site/`: `study.builder.js` (defines the global `StudyBuilder`), `study.builder.mjs`, the files R fetches, and a page with the builder on its own.

The unit tests use a stand-in for R. `npm run test:r` builds studies with real R, and CI runs both. `dist/` is committed so a page or a package can take the bundle from a release tag; `npm run build:check` fails when it is not what `src/` builds to.

## Not done yet

- An SDTM layer between raw and ADaM, and more analysis and reporting workflows than the two sets here.
- Custom column transformers: letting a user edit how a column is made. The workflows' `columns` blocks and the mapping view are where they will live.
- Opening a ready-made study without starting R.
- An R wrapper (an htmlwidget).
- Tests of the widget in a real browser. Real R is tested without one.
- Lab results, treatment arms and ECGs, which need work in gsm.datasim itself.

## Licence

Apache-2.0. gsm.datasim, gsm.mapping, gsm.core, gsm.reporting and workr are Gilead Sciences' work under the Apache License; each copy carries its own record.
