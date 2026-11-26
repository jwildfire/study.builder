# How study.builder is put together

## What a reader uses: three modules

| Module        | Its job                                  | Parts                                                                           | Folder           |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| Portfolio     | List the studies there are, and open one | Ready-made, saved, settings only, open a file                                   | `src/portfolio/` |
| Study view    | Show one study                           | Facts, Overview, Schedule, and the viewer's Tables, Columns and One participant | `src/study/`     |
| Study builder | Describe a study and build it            | The trial, the schedule grid, layers and domains, the build                     | `src/builder/`   |

- `StudyBuilder.mount` is the three together: portfolio, then builder, then study view. It is `src/app/`, which holds what the three share and moves a reader between them.
- `StudyBuilder.mountStudy` is the study view alone, for a page with its own list of studies (safety.viz's Data tab). It starts no R and reads no saved studies.
- A program builder (several studies built together) is planned, and is not built.

## How the code is laid out

Seven folders under `src/`. Each has one job, and a test (`tests/architecture.test.js`) fails when one reads another it may not, or when a folder appears that is not in this table.

| Folder           | Its job                                                                                                                                        | May read                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `src/portfolio/` | The portfolio's screen: one table of every study a reader can have.                                                                            | shared, engine                            |
| `src/study/`     | The study view: its screen, the overview, the schedule grid, and `mountStudy`. Never reads the engine's build, so it starts no R.              | shared, engine, viewer                    |
| `src/builder/`   | The builder's form. It takes the schedule grid from the study view and lets it be changed.                                                     | shared, engine, study                     |
| `src/app/`       | The three on one page: the form's settings, the open study, what was last said, and when the engine is asked.                                  | shared, engine, portfolio, study, builder |
| `src/engine/`    | Make a study and keep it: settings, the build in R, layers, metadata, the manifest, saving and opening, presets. No page.                      | shared                                    |
| `src/viewer/`    | Look through any study's tables: rows, column profiles, one participant, and a page's mapping of columns. Knows nothing of the engine or of R. | shared                                    |
| `src/shared/`    | Small things two folders need: reading CSV text, light or dark, the makers of elements, the style sheet.                                       | nothing                                   |

```
            ┌───────────────── app ─────────────────┐
            │   portfolio  →  builder  →  study     │
            └──────┬────────────┬───────────┬───────┘
                   │ asks       │ asks      │ shows with
                   ▼            ▼           ▼
                       engine             viewer
               (build, save, open)   (any study's tables)
                   └────────── shared ──────────┘
```

## Two bundles

- `study.builder.js` defines `StudyBuilder`: the engine, the portfolio, the builder and the study view, with the viewer inside it, since the study view is the viewer with two views of its own.
- `study.viewer.js` defines `StudyViewer`: the viewer alone, built from `src/viewer/index.js`. A page that only looks at data loads this one.

## The seams

- **A study, to the viewer**, is a name and tables: `{ name, tables: [{ id, label, group, text | records, columns, roles }] }`. `StudyViewer.fromBuilt(study)` (in `src/viewer/built.js`) is the one place that knows a built study's shape, and it reads only the study it is handed.
- **A page's own views.** `mount(..., { views: [{ id, label, render }] })` puts a page's views before the viewer's three. The study view uses it for the overview and the schedule.
- **Mapping.** A table may carry `roles`: what a page reads from it (`{ id, label, kind, value, options, needed }`). The viewer shows them in Columns and calls `onRole(table, role, value)`; the page changes its mapping and hands the study back with `setStudy(next, { keep: true })`. The viewer holds no mapping of its own.
- **A study, kept.** `savedOf(study)` is the settings and what R returned; `openStudy(document)` rebuilds the same study with no R and checks its key. Presets are a list of settings, some with the address of such a document.
- **Snapshots.** R returns the last snapshot as the study, and the earlier ones under `history` when asked, each put through the same workflows. `studyOf` reads an earlier one only when it is asked for (`study.at(date)`); the manifest gives each a key and folds them into the study's. The study view swaps the viewer's study and keeps the reader's place.
- **A protocol.** `src/engine/protocol.js` holds study.builder's own small model of a design (visits with day and window, activities, which is at which) and the one reader that fills it from CDISC USDM. Settings carry a `protocol`; R is sent it as text with the plan worked out; nothing else knows USDM.
- **A host page** (safety.viz) uses the engine to list and open studies, the builder to make one, the study view to show one it made, and the viewer to look through whatever is loaded, simulated or not.

## What moves where later

The viewer can be lifted into its own repository by moving `src/viewer/` and `src/shared/csv.js`; nothing else changes but the imports in `src/study/`.
