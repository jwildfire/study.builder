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
