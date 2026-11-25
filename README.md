# study.builder

Simulate a clinical trial in the browser, look at every domain, and hand the data to any page.

You describe a trial: its phase, therapeutic area, participants, sites, months and the domains you want. [gsm.datasim](https://github.com/Gilead-Public/gsm.datasim) simulates it with R running in your browser. Nothing is installed and nothing is sent anywhere.

Try it: https://jwildfire.github.io/study.builder/

Status: experimental, v0.1.0. Every row is synthetic.

## What it gives you

- **A widget.** A form for the trial and a card for each of 19 domains. Once a study is built, each domain shows its rows, its columns and their types, its first rows, and a download.
- **A plain function.** Settings in, data out, with no page at all. This is how another package loads simulated data.
- **Standard files.** Three files made from the raw domains for charts of participants (subject-level, adverse events, labs and vitals). Each says, column by column, where it came from and what was derived.

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

study.domains; // every raw domain: id, name, rows, columns, text (CSV)
study.standard; // the standard files, each with its mapping
study.files(); // { raw: [{ name, text }], standard: [{ name, text }] }
```

To build more than one study, keep a builder so R starts once:

```js
const builder = StudyBuilder.createBuilder();
const small = await builder.build({ phase: 'P1', participants: 40, sites: 4, months: 6 });
const large = await builder.build({ phase: 'P3', participants: 500, sites: 60, months: 12 });
```

A build that cannot be made rejects with a `StudyBuilderError` whose message is a sentence you can show, and whose `problems` lists each one.

## Settings

| Setting        | Values                                  | Default                                                 |
| -------------- | --------------------------------------- | ------------------------------------------------------- |
| `name`         | Any text                                | `BUILT-001`                                             |
| `phase`        | `P1`, `P2`, `P3`, `P4`                  | `P2`                                                    |
| `area`         | `Oncology`, `Virology`, `Inflammation`  | `Oncology`                                              |
| `participants` | 20 to 500                               | 150                                                     |
| `sites`        | 2 to 100, no more than the participants | 20                                                      |
| `months`       | 3 to 12                                 | 9                                                       |
| `outliers`     | `few`, `typical`, `many`                | `typical`                                               |
| `seed`         | A whole number, or left out             | None: each build differs                                |
| `domains`      | A list of domain ids (see below)        | Visits, AE, labs, vitals, PD, the two completion tables |

## Domains

Four are in every study: `STUDY`, `SITE`, `SUBJ` and `ENROLL`.

The rest are optional: `VISIT`, `AE`, `LB`, `VS`, `PD`, `STUDCOMP`, `SDRGCOMP`, `IE`, `PK`, `Randomization`, `OverallResponse`, `Death`, `QUERY`, `DATAENT` and `DATACHG`.

- A domain that is made from another brings it: vital signs and overall response bring visits, and deaths bring study completion.
- `LB`, `QUERY`, `DATAENT` and `DATACHG` grow fast. A 500-participant, 12-month study with the default domains is about 34 MB of text.

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

Starting R downloads about 55 MB the first time. A page that already runs R in the browser can hand study.builder its own connection, so the reader pays once:

```js
StudyBuilder.mount('#builder', { connection: myConnection });
```

A connection is anything with `run(name, { args })` that resolves to `{ status: 'ok', value }`, `{ status: 'unavailable', message }` or `{ status: 'error', message }`. Its R must have been given what `StudyBuilder.rOptions(base)` lists: the packages, the files and the R source to evaluate.

## How it works

- `r/builder.R` is the whole of the R. It evaluates gsm.datasim's own source, asks it for the study, and writes each domain out.
- gsm.datasim has no WebAssembly build, and it is plain R, so its source is copied from its release tag into `vendor/gsm.datasim/` and evaluated as it is. Nothing in it is edited.
- Vital signs come from gsm.datasim's own generator, given the spec of gsm.mapping v1.3.0's `VS.yaml`, copied into `vendor/gsm.mapping-vitals/`.
- `vendor/r-wasm/` holds WebAssembly builds of workr, gsm.core, gsm.mapping and gsm.reporting, built by [safety.viz](https://github.com/jwildfire/safety.viz)'s workflow and copied from it with their record.
- Every copy has a `SOURCE.json` beside it naming the repository, tag and commit it came from and each file's checksum. `npm run files:check` holds the copies to their records.

## Develop

```sh
npm install
npm test          # unit tests, with a stand-in for R
npm run serve     # build _site/ and serve it at http://127.0.0.1:8650/
npm run format
```

`npm run build` writes `_site/`: `study.builder.js` (defines the global `StudyBuilder`), `study.builder.mjs`, the files R fetches, and a page with the builder on its own.

The tests do not start R. Real R was checked by hand in a browser and with webR under Node.

## Not done yet

- Custom column transformers: letting a user say how a raw column becomes a standard one. The mapping view is where they will live.
- An R wrapper (an htmlwidget).
- Browser tests that start real R.
- Lab results, treatment arms and ECGs, which need work in gsm.datasim itself.

## Licence

Apache-2.0. gsm.datasim, gsm.mapping, gsm.core, gsm.reporting and workr are Gilead Sciences' work under the Apache License; each copy carries its own record.
