# How study.builder is put together

study.builder is three modules and a small shared one. Each has one job, and a test (`tests/architecture.test.js`) fails when one reads another it may not.

| Module | Folder        | Its job                                                                                                                                        | May read               |
| ------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Engine | `src/engine/` | Make a study and keep it: settings, the build in R, layers, metadata, the manifest, saving and opening, presets. No page.                      | shared                 |
| Viewer | `src/viewer/` | Look through any study's tables: rows, column profiles, one participant, and a page's mapping of columns. Knows nothing of the engine or of R. | shared                 |
| Loader | `src/loader/` | The screens that pick, describe and open a study, and hand it on.                                                                              | shared, engine, viewer |
| Shared | `src/shared/` | Small things two modules need: reading CSV text.                                                                                               | nothing                |

```
            ┌──────────── loader ────────────┐
            │  library → describe → study    │
            └──────┬──────────────────┬──────┘
                   │ asks             │ shows with
                   ▼                  ▼
               engine              viewer
        (build, save, open)   (any study's tables)
                   └──── shared ──────┘
```

## Two bundles

- `study.builder.js` defines `StudyBuilder`: the engine and the loader, with the viewer inside it, since the loader's study screen is the viewer.
- `study.viewer.js` defines `StudyViewer`: the viewer alone, built from `src/viewer/index.js`. A page that only looks at data loads this one.

## The seams

- **A study, to the viewer**, is a name and tables: `{ name, tables: [{ id, label, group, text | records, columns, roles }] }`. `StudyViewer.fromBuilt(study)` (in `src/viewer/built.js`) is the one place that knows a built study's shape, and it reads only the study it is handed.
- **A page's own views.** `mount(..., { views: [{ id, label, render }] })` puts a page's views before the viewer's three. The loader uses it for the study overview.
- **Mapping.** A table may carry `roles`: what a page reads from it (`{ id, label, kind, value, options, needed }`). The viewer shows them in Columns and calls `onRole(table, role, value)`; the page changes its mapping and hands the study back with `setStudy(next, { keep: true })`. The viewer holds no mapping of its own.
- **A study, kept.** `savedOf(study)` is the settings and what R returned; `openStudy(document)` rebuilds the same study with no R and checks its key. Presets are a list of settings, some with the address of such a document.
- **A host page** (safety.viz) uses the engine to list and open studies, the loader's describe screen to make one, and the viewer to look through whatever is loaded, simulated or not.

## What moves where later

The viewer can be lifted into its own repository by moving `src/viewer/` and `src/shared/csv.js`; nothing else changes but the import in `src/loader/widget.js`.
