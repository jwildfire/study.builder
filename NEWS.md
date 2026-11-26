# study.builder v0.3.0 (Upcoming)

Release candidate: v0.3.0-rc.11. A study comes in layers, opens without waiting once it is saved or ready-made, and is looked through with study.viewer. v0.2.0 was never released: everything under it is here.

- **A study can follow a protocol's schedule of activities.** Open a CDISC USDM study definition, the data form of an ICH M11 protocol, and the form shows its schedule as a grid: a column a visit, a row an activity. Change a visit's day, add or remove a visit, tick an activity on or off, then build. Visits, vital signs and labs are made on that schedule: each visit on its planned day within its window, vitals only where they are taken, and each lab panel with the tests the protocol lists. A study built this way keeps its protocol and shows it as a Schedule view. The CDISC pilot study's protocol comes ready-made. Arms, branching timelines and activities of no domain the simulator makes are read and shown, and simulate nothing yet. M11's own specification leaves the schedule as a table or an image, so it is USDM that is read. `StudyBuilder.readUsdm`, `readProtocol`, `planOf`, `protocolSettings`.
- **Arms, lab results and ECGs.** A study has treatment arms (a protocol's own, or Placebo and Active), a result, unit and normal range for every lab, and ECGs (QTcF, QTcB and heart rate), all made by gsm.datasim's staging copy (`results`). A few participants on an active arm have a rise in ALT and AST, in bilirubin or in creatinine, and QTc is a little longer. ADaM gains ADLB and ADEG, by workflow, and ADSL, ADAE and ADVS carry the arm. ADaM now holds enrolled participants only. `study.files().standard` hands labs and vital signs over as one file (adlb-advs.csv), since a page that reads standard files takes one per domain. With these, every chart of safety.viz has the data it needs.
- **A widget matches the page it is in.** The loader and the viewer are light on a light page and dark on a dark one, read from what is painted behind them, and follow the page if it changes. Before, they followed the reader's computer, so a page that is always light got dark panels on a computer set to dark. `theme` still names one outright.
- **The protocol study comes ready-made.** PILOT-PROTOCOL, the study on the CDISC pilot protocol's schedule of activities, is hosted with its data, ECGs included, so it opens at once and a page that lists ready-made studies lists it.
- **Lab names a chart can find.** ADLB drops the ending 'in Serum/Plasma' or 'Concentration in Serum/Plasma' that a protocol's lab list writes, so ALT is 'Alanine Aminotransferase'. The ready-made protocol study adds bilirubin to its chemistry panel, which the protocol file's list leaves out. With both, the hepatic charts of safety.viz have what they need.
- **Raw.RBQM no longer repeats raw.** A mapped table that comes out the same as its raw table, row for row and column for column, is dropped: the site metrics are fed the raw table and say so in what they were built from. Raw.RBQM keeps only what gsm.mapping changes: the enrolled participants, and the site, study and country tables shaped for reporting, with visits and vital signs where they differ. gsm's workflows are run as they are.
- **Three modules, and the study view alone.** study.builder is a portfolio (the list of studies), a study view and a study builder; the README and ARCHITECTURE.md say what each holds. `StudyBuilder.mountStudy(target, { study })` draws the study view alone, its facts, Overview, Schedule and tables, for a page with its own list of studies.
- **A folder for each module.** The portfolio, the study view and the study builder are `src/portfolio/`, `src/study/` and `src/builder/`, with `src/app/` joining them on a page; before, they were three screens in one file. A test holds what each may read. The study view alone (`mountStudy`) no longer makes a builder it never uses, so it cannot start R. Nothing a reader sees has changed.
- **One table of studies.** The library lists every study in one table, and a Data column says which have their data ready (Open) and which are settings only (Build).
- **The schedule is gsm.datasim's.** study.builder is to make no data. Its own code that remade visits, vital signs and labs on a protocol's schedule is gone: a staging copy of gsm.datasim takes a study design and does it, in every snapshot. What else the builder's R still changes is fenced and listed in `r/builder.R`, and a test holds the fence.
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
