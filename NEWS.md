# study.builder v0.3.0 (Upcoming)

Release candidate: v0.3.0-rc.2. A study comes in layers, opens without waiting once it is saved or ready-made, and is looked through with study.viewer. v0.2.0 was never released: everything under it is here.

- **Three modules.** The engine (make and keep a study), the viewer (look through any study) and the loader (the screens) are separate folders with boundaries a test holds. `ARCHITECTURE.md` has the picture.
- **A library first.** The loader opens on the studies you can have at once, ready-made or saved, with the form behind New study. With nothing to list it opens on the form.
- **Describe a study.** Phase, area and outliers are pressed, not chosen from a menu; the layers are drawn as the pipeline they are; the raw domains are chips; and a summary says what building will give, then each step as R takes it.
- **The study that is open.** Its name, how it was made, its key and its settings in a line, with Save, Study file, Download all and the page's own button; and study.viewer under it, opening on the overview.
- **Mapping in the viewer.** A table may carry roles, what a page reads from it; the viewer's Columns view shows them and tells the page when one is set.

## What's new

- **Layers.** Raw is the root. Raw.RBQM is raw under gsm's names, by gsm.mapping's own workflows (the tables gsm calls Mapped). ADaM is the tables charts of participants read. `study.layers` lists them, `study.table(layer, id)` returns one, and the widget has a tab for each.
- **Every table says what made it.** `table.made` names the workflow and the tables it read. The widget says it on each card.
- **ADaM by workflow.** ADSL, ADAE and ADVS are written by three workr workflows in `workflows/adam/`, in place of the R code that wrote v0.1.0's three standard files. Each workflow says, column by column, where its table came from.
- **A manifest.** `study.manifest` has a checksum for every table, the versions of the packages that built the study, its settings, and one key. The same seed and settings give the same key. It is in the zip as `manifest.json`.
- **Analysis and Reporting layers.** Analysis has gsm's eight site metrics, run by gsm.kri's own workflows on Raw.RBQM, each as a summary by site and the participant-level input it counted from, and an adverse event summary by body system and term, run by a study.builder workflow on ADaM. Reporting has gsm.reporting's Results, Bounds, Groups and Metrics over every metric that ran. Neither layer belongs to one domain.
- **A metadata layer.** `study.metadata` has a spec for every table: what it is, what made it, its key, and each column's label, type and what it joins to. `study.spec(layer, id)` returns one. The viewer's Columns tab shows it, and it is in the zip as `metadata.json`.
- **Choose the layers.** The `layers` setting, and ticks in the widget, leave a layer out.
- **A study overview.** A built study opens on an overview: what the trial is, its headline counts, sites and participants by country, and what each layer holds. `StudyBuilder.overviewOf(study)` returns the same for another page to draw.
- **A table viewer.** Each layer is a short list of its tables beside the open one. The viewer shows its first rows with each column's type, a summary of every column (how full, how many different values, its range or commonest values), and where an ADaM table's columns came from. `StudyBuilder.columnsOf(table)` returns the column summary.
- **Save a study and open it again with no wait.** A built study can be saved in the browser (Save study) or as a file (Study file). Opening either shows the same study at once: the same tables, metadata, manifest and key, with no R started. `StudyBuilder.savedOf(study)` makes the document and `StudyBuilder.openStudy(document)` opens it; the key it was saved with is checked.
- **Save settings.** The form's settings can be saved in the browser or as a file, and opened to fill the form; Build then makes the study. `StudyBuilder.configOf(settings)`.
- **Presets, with and without data.** A page offers ready-made starts from `presets/index.json`: some are settings only, and some host the study itself, which opens at once. Two hosted studies and two settings-only presets come with study.builder; `npm run presets` builds the hosted ones with real R and `npm run presets:check` holds them. A page passes `presets` to offer its own, or `false` for none.
- **study.viewer, a module of its own.** `study.viewer.js` defines `StudyViewer`: give it any study's tables, simulated or not, and it shows a rail of the tables and three views. Tables has the rows, with filters and sorting. Columns profiles every column (kind, how full, range or commonest values, a spread) and a bar filters the rows to it. One participant follows a person across every table that names them. `StudyViewer.fromBuilt(study)` hands it a study.builder study, listed by layer with what built each table. It lives in `src/viewer/` and reads nothing of the builder, so it can be lifted out later. The study.builder page shows it under the builder.
- **The trial and the layers come first.** The raw domains are one folded line with a compact tick list.

## Changed

- ADSL gains `TRTSDT`, each participant's day one, which the other ADaM tables count study days from.
- The zip has a folder for each layer: `raw/`, `raw.rbqm/`, `adam/`.
- `study.domains`, `study.standard` and `study.files()`'s `raw` and `standard` still work as in v0.1.0. `study.standard[].from` now names the tables read, such as `AE` and `ADSL`.

## Fixed

- Asking for a study with no layer but raw no longer fails on the way to R.

# study.builder v0.1.0

**Try it:** https://jwildfire.github.io/study.builder/

The first release. study.builder began as a tab on a branch of safety.viz's demo app and is now a tool of its own that any page can use.

## What's new

- **Build a study on a page.** A form for the trial and a card for each of 19 domains. gsm.datasim v2.1.0 simulates the study with R in the browser, in a few seconds once R has started.
- **See what each domain holds.** Rows, columns and their types, the first rows, and a download, for every domain; the whole study as one zip.
- **Standard files that say where they came from.** Subject-level, adverse events and vital signs files, each with a line per column: the raw column it was copied from, or how it was derived.
- **Load simulated data from another package.** `StudyBuilder.buildStudy(settings)` returns the study with no page; `mount(target, { onStudy })` hands it over from the widget.
- **Share an R.** A page that already runs R in the browser hands over its own way of making a connection, so R starts once. study.builder never closes an R it did not start.

## What a study built here is not

- Real: every row is synthetic.
- Shaped by phase or therapeutic area: both are labels.
- Complete: gsm.datasim makes no lab results, treatment arms or ECGs, and its adverse event terms are placeholders.

## Checks

- 41 unit tests with a stand-in for R, and 13 checks that build studies with real R (webR under Node). Both run on every push.
- The widget has not been tested in a real browser by a test; it was run by hand.
