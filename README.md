# study.builder

Simulate a clinical trial in the browser, look at every domain, and hand the data to any page.

You describe a trial: its phase, therapeutic area, participants, sites, months and the domains you want. [gsm.datasim](https://github.com/Gilead-Public/gsm.datasim) simulates it with R running in your browser. Nothing is installed and nothing is sent anywhere.

Try it: https://jwildfire.github.io/study.builder/

Status: experimental, v0.2.0 in development (v0.1.0 is the latest release). Every row is synthetic.

## What it gives you

- **A study in layers.** Raw is the root: what gsm.datasim simulates. Every other layer is built off it by workflows, and every table says which workflow made it and what that workflow read.
- **A widget.** A form for the trial and the layers to build, with the 19 raw domains folded into one line. A built study opens on an overview, with a tab for each layer: a short list of its tables beside a viewer that shows the open table's first rows, a summary of every column, and a download.
- **A plain function.** Settings in, data out, with no page at all. This is how another package loads simulated data.
- **A manifest.** A checksum for every table and one key for the whole study. The same tables always give the same key.

## Layers

| Layer    | Id         | What it is                                                                      | Built by                                        |
| -------- | ---------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| Raw      | `raw`      | One table per domain, as a study database gives them                            | gsm.datasim                                     |
| Raw.RBQM | `raw.rbqm` | Raw under gsm's names: the tables gsm calls Mapped, which its site metrics read | gsm.mapping's own workflows                     |
| ADaM     | `adam`     | Analysis-ready tables for charts of participants: ADSL, ADAE, ADVS              | study.builder's workflows, in `workflows/adam/` |

- Every step off raw is a [workr](https://github.com/Gilead-Public/workr) workflow: a YAML file with a spec (the tables and columns it reads) and steps. No table is derived by hand-written code.
- A workflow runs only when every table it reads is there, so a study with no adverse events has no ADAE and nothing fails.
- Each ADaM workflow has a `columns` block that says where every column it writes came from. That is the mapping the widget shows, and where custom column transformers will be edited.
- The ADaM tables are a light form: enough for charts, not a submission. There is no SDTM layer yet.
- Analysis and reporting layers, which work out statistics from any data layer, are planned and not in this version.

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
| `theme`      | `light` or `dark`. Default: the reader's own setting.                                    |

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
- Phase and therapeutic area are labels. gsm.datasim does not shape the data by either, so a phase only fills in a typical size.
- Only the study's last monthly snapshot is returned.
- gsm.datasim makes no lab results (only toxicity grades), no treatment arms and no ECGs. Adverse event terms are its placeholders (`term1`, `soc1`).

Three things are changed in the raw tables after the simulation, and every study says so in `study.notes`:

- Columns gsm.datasim names as the source system does are given gsm's names, as gsm.mapping's own specs say.
- Site ids are written `SITE1234` where gsm.datasim writes `0X1234`, which R would read back from a file as a number.
- The study table's phase and therapeutic area are what was asked for.

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

- An SDTM layer between raw and ADaM, and analysis and reporting layers that work on any data layer.
- Custom column transformers: letting a user edit how a column is made. The workflows' `columns` blocks and the mapping view are where they will live.
- Opening a ready-made study without starting R.
- An R wrapper (an htmlwidget).
- Tests of the widget in a real browser. Real R is tested without one.
- Lab results, treatment arms and ECGs, which need work in gsm.datasim itself.

## Licence

Apache-2.0. gsm.datasim, gsm.mapping, gsm.core, gsm.reporting and workr are Gilead Sciences' work under the Apache License; each copy carries its own record.
