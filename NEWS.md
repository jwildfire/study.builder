# study.builder v0.5.2

Wording again: v0.5.1 left the simulator's plain name in every study's own notes. No table changes.

- **A study's notes name the simulator for what it is.** Five sentences that every built study carries in `notes`, and shows in the Overview under "What a study built here is, and is not", credited gsm.datasim with the study results, the study profile, the study design and the two things it is asked to do differently. Those are additions of the modified copy, not in Gilead's gsm.datasim 2.1.0, and the sentences now say so.
- **Who made a raw table.** A raw table's `made.workflow`, in a study file and in a downloaded study's manifest, is `gsm.datasim (modified copy)` where it was `gsm.datasim`.
- **CDISC's attribution where a protocol's schedule is shown.** The schedule grid, in the builder's form and in the study view's Schedule, ends with the attribution its protocol carries. The builder's list of ready-made protocols says whose they are. Both are in the widget itself, so a page that mounts it shows them with no footer of its own. A list of protocols a host passes in shows an attribution only where an entry has one (`attribution`).
- **The build form keeps your place.** Changing a field and moving to the next, by Tab or by a click, drew the form again under the reader: focus was thrown off, and what was typed next went nowhere (30 participants then 7 sites left Sites at 20). The form is now drawn again once focus has landed and focus is put back on the same field. Found by a reviewer, whom it cost two builds.
- **A changed file says it is changed.** `vendor/gsm.reporting/workflow/3_reporting/Results.yaml` differs from gsm.reporting v1.1.7 by one name; it now carries a notice of change at its top (Apache License 2.0, section 4(b)). `SOURCE.json` had the change already.

## For a page that copied v0.5.1

- Copy `dist/` again, `r/builder.R`, and `vendor/gsm.reporting/` (one file changed, a comment only) with `src/engine/files.js` or its built form.
- Copy the three ready-made study files with `presets/index.json` and `studies/index.json`: the files are new bytes with new checksums, since their notes changed. Each keeps the key it had in v0.5.0 and v0.5.1: no table changed.
- A page that reads a raw table's `made.workflow` will find `gsm.datasim (modified copy)`.
- Nothing changed in `protocols/` or `vendor/gsm.datasim/`.

## Not fixed here

- A study built from an example protocol takes the real trial's identifier as its name, and real arm names; nothing on a host's chart tabs says it is simulated. A default name that starts `SIM-` would change every such study's tables and key, so it waits for a version that is not wording only.
- The copy of gsm.datasim's `DESCRIPTION` carries its three authors' email addresses, as Gilead published them. Removing them would leave the copy with no maintainer address, which R requires of a package; it waits on Jeremy's answer about the author list.
- Two from v0.5.1's list: the pilot labelled "Inflammation", and the builder saying R must be downloaded after a host has started R.
- A snapshot of the pilot protocol study "as it stood" on a date holds some later dates; the study view says "1 countries"; lists say "40 participants" where 29 are enrolled.

# study.builder v0.5.1

Notices and wording. No change to what a study holds: the same settings give the same tables and the same key as v0.5.0.

- **The simulator is named for what it is.** The app, the site and these notes said studies were made by gsm.datasim 2.1.0. What is copied in is a modified copy: Gilead's v2.1.0 with a study design, study options, a study profile and study results added, about 2,050 lines in 13 files, kept at jwildfire/gsm.datasim (branch `safety-results-2.1`). The additions have not been raised with, reviewed by or endorsed by gsm.datasim's maintainers. The study view, the builder, the pipeline, every page's footer and the README now say "a modified copy of gsm.datasim". Where the notes below say gsm.datasim made something new, they mean that copy.
- **The copy says so itself.** Its `DESCRIPTION` says it is modified and by whom, each changed file carries a notice of change and each added file a notice that it is not part of gsm.datasim 2.1.0 (Apache License 2.0, section 4(b)). Comments and package metadata only: no code changed. `vendor/gsm.datasim/SOURCE.json` records the new commit and says the copy is modified.
- **CDISC's attribution travels with the protocols.** Each of the five example protocols (`protocols/*.protocol.json`) now carries in its `source` the attribution CDISC's DDF-RA asks for, the licence (CC-BY-4.0) and its address, the repository, commit and path it was read from, and a statement that it is changed from CDISC's file. `protocols/index.json` and the studies feed carry the attribution for each protocol too (`license`, `attribution`), the study view's Protocol view shows it, and every page's footer has it. The record in `vendor/cdisc-ddf-ra/SOURCE.json` names the licence plainly.
- **What is sent.** The pages said "Nothing is sent anywhere." A build downloads R and its packages from webr.r-wasm.org and repo.r-wasm.org. They now say no study data is sent, and name the two hosts.
- **How long.** A first build is "about a minute", not "about half a minute": it was measured at 61 to 78 seconds.
- **Adverse event terms.** They are a short hand-written list, not coded with MedDRA or taken from its files; the notes now say the body-system names are the familiar ones MedDRA also uses.
- **Licence text.** The copies of gsm.kri, gsm.reporting and the gsm.mapping vital signs workflow have the Apache License's text beside them.
- **README.** Its status line named v0.4.0 as the latest release at the v0.5.0 tag. Fixed.

## For a page that copied v0.5.0

- Copy `dist/` again, and `vendor/gsm.datasim/` (eight files changed, comments only, so their checksums changed) with `src/engine/files.js` or its built form.
- Copy `protocols/` and `studies/index.json` again: every protocol file has a new checksum, and the feed names them.
- A ready-made study has the same key as in v0.5.0. The three study files were built again and are new bytes (their checksums in `presets/index.json` and the feed changed; the files now say "a modified copy" in their own description), so a page that checks a study file against a checksum should copy the file and the list together.
- New, optional: `license` and `attribution` on a feed entry and on what `listStudies` and `describeStudy` return. Show the attribution wherever a protocol's content is shown.

## Not fixed here

- The build form redraws when a field changes and can lose the reader's place.
- The ready-made CDISC pilot study says its therapeutic area is Inflammation; the protocol is Alzheimer's disease. The simulator names three areas and that is the nearest.
- After a host page has started R for its own use, the builder still says R must be downloaded.

# study.builder v0.5.0

Released 26 November 2026. The sizes by which phase and therapeutic area shape the data are guesses at what is believable, not fitted to data, and have not been reviewed by a clinician.

- **The study view is in five sections.** Overview; Design (Protocol and Schedule); Data (Pipeline, Tables, Columns); Operations (RBQM, Safety, One participant); Reporting (Efficacy, Adverse events). A section's views are a second row of tabs under it. Protocol takes the place of the Design tab and shows the protocol in full: what it is and where it was read from, arms by epochs, objectives with endpoints and estimands, every scheduled activity with whether it is simulated, and what the reader left out. RBQM is sites by metrics, a cell the flag and score {gsm} gave. Safety is adverse events with no arm named: totals, the commonest terms, and counts by body system. Adverse events, under Reporting, is participants with each term by arm. All four are drawn from tables the workflows made; no chart library is loaded. A page with charts of its own passes `operations: false` to `mountStudy` or `mount`, and RBQM and Safety are left out. study.viewer takes `sections`; with none it is one row of tabs as before. An address that names the view `design` opens Protocol.
- **Every row of the portfolio is a study's configuration.** The ready-made protocols are rows of the studies list, where they were a page of cards; the Protocols page points there. Every row has Open in builder. A row whose build is kept (it has data) also has Overview. Build, Edit and Use are gone from the list.
- **One studies feed.** `studies/index.json` lists every study a reader can have in one array: each entry a configuration (`kind`: `settings` or `protocol`) with the facts to draw a line, and a `build` on those whose data is kept, with a checksum for every file. Its format is written down in `studies/studies.schema.json`; an id is never used again. The presets and protocols lists stay as they are. `npm run studies`, `npm run studies:check`.
- **Four functions with no page**, plain JSON in and out: `listStudies(url, { kinds, built })`, `describeStudy(entry or study)`, `openListed(entry)`, which refuses a file that is not the one the feed names, and `readTable(study, layer, id)`. Building is `buildStudy`, as before.
- **A picker.** `StudyBuilder.mountPicker(target, { onPick })` draws the feed a line a study: name, facts, a mark for ready data or protocol. It picks and does nothing else; the page decides what a pick does.

- **Phase and therapeutic area shape the data.** They were labels. gsm.datasim's staging copy now has a study profile, written in one place (`study_profile(phase, therapeutic_area)`), and the study results follow it. Phase 1: labs spread less (on sodium about 0.9% of results out of range where Phase 2 has about 2.5%), 30% of serious adverse events are not serious, and 20% of events are a grade lower. Phase 3 and 4: labs spread a little more (about 4.3% out of range at Phase 3). Oncology: gastrointestinal, general and nutrition events are 1.4 to 1.5 times as common, 8% more events are serious and 15% a grade higher, and liver and kidney rises are 1.5 times as common. Virology: infections 1.5 times as common, twice as many participants with raised liver tests from the start. Inflammation: musculoskeletal, infection and skin events 1.3 to 1.4 times as common. The study table says an indication that fits the area, or the protocol's own. Nothing else moves: the number of participants, visits and events, vital signs, ECGs, scores and who leaves early are as before. Every number is a guess at a believable size, not fitted to data. A study's notes say what its profile changed. `PROFILE_SAID`, `profileSaid`.
- **Every example protocol CDISC publishes reads and builds.** The reader was held to one protocol, the pilot. It now reads all five USDM 4 examples in CDISC's reference set: the pilot, the pilot with devices, a single-arm study with 51 visits and a decision point, a crossover with several visits on one day, and an observational study. Each builds a study in real R on its own schedule. A file of a USDM version before 4 is refused in a sentence. `protocol.notes` says what a protocol holds that is not simulated: other timelines, decision points, visits that share a day, activities timed within a visit. Two wrong readings are fixed: an endpoint is no longer tied to a lab by a loose word, and the efficacy score offered is an estimand's or a primary endpoint only. The form offers all five, and the site has a Protocols page. `READY_PROTOCOLS`, `npm run protocols:all`, `npm run test:r:protocols`.
- **The builder makes no data.** The last of the builder's own data-making R is gone: vital signs, site ids, the study table's phase and area, and gsm's column names are now gsm.datasim's to make (its staging copy: `specs`, `site_id_prefix`, `phase`, `therapeutic_area`, `column_names`). The fenced block in `r/builder.R` is empty and a test holds it empty. Every raw table but vital signs is the same as before, byte for byte. Vital signs are now the same in every snapshot that holds the visit. On a protocol, a lab's toxicity grade differs from v0.4.0, because the schedule is applied once and not twice.

<!-- goal 3: a trial that behaves like a trial -->

- **Adverse events follow the arm, and have terms.** Adverse events carry a preferred term and a system organ class from a short list of gsm.datasim's own (about 40 terms in 12 classes; it is not MedDRA). A term typical of a study drug is 1.5 times as common on an active arm, or as many times as the study says. A participant with a simulated rise in liver tests, in creatinine or in QTc usually has an event that says so. A serious event is grade 3 or more and one that is not is 3 or less. No event is added, removed or moved: who had an event, when, and whether it was serious are as before, so every site metric is unchanged.
- **Participants can leave early.** A study may say what share of enrolled participants leave by its last visit (`assumptions.dropout`, and `dropoutByArm` for an arm that differs). After a participant's last day they have no visits, labs, vital signs, ECGs, scores, deviations or new adverse events, and the study completion and treatment completion tables say who left, when and why, and who finished. The form has the field under Assumptions; none leave unless asked.
- **A model of the efficacy score.** The Efficacy summary workflow gains a model: at the last visit, change from baseline by arm with the baseline score as covariate. Each arm that is not the reference arm gets an adjusted difference, its standard error, a 95% interval and a p-value, as more rows of the same one-row-a-result table, and the Efficacy tab shows them under the chart. The model is fitted by `EfficacyModel()`, in an R file beside the workflow that calls it by name (`workflows/analysis/EfficacyModel.R`), since a query cannot fit it; the builder's own R derives nothing.
- **Adverse events by arm.** A new analysis table, by workflow: events, serious events and participants with an event, by arm, body system and term, with the arm's share.
- `readAssumptions`, `ASSUMED`, `DEFAULT_ARMS`; `builder_run(assumptions = )`; gsm.datasim's staging copy: `results$events`, `results$dropout`, and `apply_study_results(snapshot_date = )`.

<!-- end goal 3 -->

# study.builder v0.4.0

Released 26 November 2026.

- **A Pipeline view.** The study view has a Pipeline tab. On top is the study's config: what it was asked to be (size, seed, snapshots kept, domains, layers, protocol, efficacy score), what built it and its key, with a Settings file button. Under it is every table in columns by layer, a card for each raw table and for each workflow. Pick a card and what it was built from and what is built from it are marked, however far, and the workflow is shown as it is written: what it says of itself, the columns it needs, and its steps in order with what each is told, queries included. Open the table goes to it in Tables. The layout follows workr's own workflow explorer. R hands each workflow back with the table it made (`table.definition`); nothing is run or changed for it. `pipelineOf`.
- **A home page with pictures.** The site's home page shows how a study is made as six stages in a row, from what you describe to the page it is handed to, each marked with one hue of the spectrum, and each of the three parts has a small picture of itself.
- **The look is rainbow-hex's.** The site's pages load Instrument Serif, Instrument Sans and IBM Plex Mono and carry the seven-hue hex strip under the header (rainbow-hex 1.0). The widgets name the serif and the mono first and load nothing: a page without them gets the faces after them, as before.

# study.builder v0.3.1

Released 25 November 2026.

- **The viewer no longer restyles the page it is in.** Four of study.viewer's style rules were for class names safety.viz also uses (`.sv-rail`, `.sv-main`, `.sv-link`, `.sv-soft`) and were not held under the viewer's own element. Once a study view had been shown in safety.viz, its participant panel was capped at 16rem wide, expanded or not. Each of those rules is now under `.sv`, and a test holds it.

# study.builder v0.3.0

Released 25 November 2026. A study comes in layers, opens without waiting once it is saved or ready-made, and is looked through with study.viewer. v0.2.0 was never released: everything under it is here.

- **A study can follow a protocol's schedule of activities.** Open a CDISC USDM study definition, the data form of an ICH M11 protocol, and the form shows its schedule as a grid: a column a visit, a row an activity. Change a visit's day, add or remove a visit, tick an activity on or off, then build. Visits, vital signs and labs are made on that schedule: each visit on its planned day within its window, vitals only where they are taken, and each lab panel with the tests the protocol lists. A study built this way keeps its protocol and shows it as a Schedule view. The CDISC pilot study's protocol comes ready-made. Arms, branching timelines and activities of no domain the simulator makes are read and shown, and simulate nothing yet. M11's own specification leaves the schedule as a table or an image, so it is USDM that is read. `StudyBuilder.readUsdm`, `readProtocol`, `planOf`, `protocolSettings`.
- **Arms, lab results and ECGs.** A study has treatment arms (a protocol's own, or Placebo and Active), a result, unit and normal range for every lab, and ECGs (QTcF, QTcB and heart rate), all made by gsm.datasim's staging copy (`results`). A few participants on an active arm have a rise in ALT and AST, in bilirubin or in creatinine, and QTc is a little longer. ADaM gains ADLB and ADEG, by workflow, and ADSL, ADAE and ADVS carry the arm. ADaM now holds enrolled participants only. `study.files().standard` hands labs and vital signs over as one file (adlb-advs.csv), since a page that reads standard files takes one per domain. With these, every chart of safety.viz has the data it needs.
- **A widget matches the page it is in.** The loader and the viewer are light on a light page and dark on a dark one, read from what is painted behind them, and follow the page if it changes. Before, they followed the reader's computer, so a page that is always light got dark panels on a computer set to dark. `theme` still names one outright.
- **The protocol study comes ready-made.** PILOT-PROTOCOL, the study on the CDISC pilot protocol's schedule of activities, is hosted with its data, ECGs included, so it opens at once and a page that lists ready-made studies lists it.
- **Lab names a chart can find.** ADLB drops the ending 'in Serum/Plasma' or 'Concentration in Serum/Plasma' that a protocol's lab list writes, so ALT is 'Alanine Aminotransferase'. The ready-made protocol study adds bilirubin to its chemistry panel, which the protocol file's list leaves out. With both, the hepatic charts of safety.viz have what they need.
- **Raw.RBQM no longer repeats raw.** A mapped table that comes out the same as its raw table, row for row and column for column, is dropped: the site metrics are fed the raw table and say so in what they were built from. Raw.RBQM keeps only what gsm.mapping changes: the enrolled participants, and the site, study and country tables shaped for reporting, with visits and vital signs where they differ. gsm's workflows are run as they are.
- **Three modules, and the study view alone.** study.builder is a portfolio (the list of studies), a study view and a study builder; the README and ARCHITECTURE.md say what each holds. `StudyBuilder.mountStudy(target, { study })` draws the study view alone, its facts, Overview, Schedule and tables, for a page with its own list of studies.
- **A site with a page for each part.** study.builder's site opens on what it is, and has a page for each of its three parts: the portfolio, the study view and the study builder, linked by one menu. Open on the portfolio page goes to the study view page; Build, Edit and New study go to the builder page. A page that shows a study or the form elsewhere tells `mount` so with `links`.
- **An efficacy score, simulated by arm.** A study that follows a protocol can simulate the score the protocol's estimand points at. The form gains a section, Efficacy: what the simulator assumes: for each arm its mean difference from the reference arm at the last visit, with the baseline mean, the standard deviation of the change and the change on the reference arm, and a line of arithmetic saying about how likely each difference is to be seen. The protocol says which score and where it is measured; the numbers are the builder's settings (`efficacy`), sent to the simulator beside the protocol, and every difference starts at 0. gsm.datasim's staging copy makes the scores (`results$scores`, the raw QS table); ADQS is built from it by workflow, and the analysis layer gains an Efficacy summary, one row a result (n, mean, standard deviation, difference from the reference arm) in the manner of CDISC's Analysis Results Standard. The study view shows it in an Efficacy tab: the mean change by arm over the visits, the numbers, and what the simulator was told. It is a summary: no model is fitted. `readEfficacy`, `efficacyOf`, `referenceArm`. The ready-made CDISC pilot protocol study simulates ADAS-Cog (11).
- **A Design view, from the protocol.** A study that followed a protocol has a Design tab after Schedule. It shows what the protocol file says and adds nothing: what each arm gets in each epoch, as a grid; the population; and the objectives, each with its endpoints, with an estimand under the endpoint it is of. A pill on an endpoint says whether its activity is on the schedule and whether its data is simulated; that reading goes by name, since the file does not join the two. The reader keeps arm types, elements, study cells, objectives, endpoints, estimands and the population, which it dropped before (`protocol.design`, `designSaid`, `endpointLink`). None of it is simulated yet: this is step 1 of the efficacy and statistics section.
- **Snapshots.** A study can keep every monthly snapshot gsm.datasim makes, and not only the last. Choose Every month under Snapshots kept (`snapshots: 'all'`), and the study view gains a snapshot picker beside the study's facts: pick a month and the overview, every layer's tables, the columns and the participants are the study as it stood then. The overview shows how the study grew, snapshot by snapshot. Each earlier snapshot is put through the same workflows as the last; one whose workflows cannot run is listed and says why. A saved study and the download keep them (`snapshots/<date>/` in the zip), and the study's key covers them. `study.history`, `study.at(date)`, `StudyBuilder.SNAPSHOTS`, `growthOf`. The last only is still the default. Vital signs are drawn afresh for each snapshot until gsm.datasim makes them as a domain, so they differ between snapshots. The ready-made Phase 1 study and the CDISC pilot protocol study keep every month.
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
