# study.builder v0.1.0 (Upcoming)

The first version, moved out of a branch of safety.viz's demo app into a tool of its own.

- **Build a study on a page.** A form for the trial and a card for each of 19 domains. gsm.datasim v2.1.0 simulates the study with R in the browser.
- **See what each domain holds.** Rows, columns and their types, the first rows, and a download, for every domain; the whole study as one zip.
- **Standard files that say where they came from.** Subject-level, adverse events and vital signs files, each with a line per column: the raw column it was copied from, or how it was derived.
- **Load simulated data from another package.** `StudyBuilder.buildStudy(settings)` returns the study with no page; `mount(target, { onStudy })` hands it over from the widget.
- **Share an R.** A page that already runs R in the browser can hand over its own connection.
