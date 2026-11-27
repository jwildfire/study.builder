# Copies

Everything here is copied from another repository, unedited here but for the one line noted below, with a `SOURCE.json` beside it that names the repository, the tag and the commit and gives each file's checksum. `npm run files:check` holds every copy to its record.

| Folder | What | From |
| --- | --- | --- |
| `gsm.datasim/` | The simulator's R source, evaluated as it is | A modified copy of gsm.datasim, kept at jwildfire/gsm.datasim (branch `safety-results-2.1`): Gilead-Public/gsm.datasim v2.1.0 with a study design, study options, a study profile and study results added (about 2,050 lines in 13 files). Changed and added files carry a notice at their top. Not raised with, reviewed by or endorsed by gsm.datasim's maintainers |
| `gsm.mapping-vitals/` | The vital signs mapping workflow, for its spec | Gilead-Public/gsm.mapping v1.3.0 |
| `gsm.kri/` | Eight site metric workflows, and one R file the reporting needs | Gilead-Public/gsm.kri v1.7.0, by way of safety.viz |
| `gsm.reporting/` | The four reporting workflows | Gilead-Public/gsm.reporting v1.1.7, by way of safety.viz |
| `r-wasm/` | WebAssembly builds of workr, gsm.core, gsm.mapping and gsm.reporting | Built by safety.viz's workflow; see its README |

`cdisc-ddf-ra/` holds CDISC's five example study definitions (USDM 4.0.0) from cdisc-org/DDF-RA at commit `aa303cb`, unchanged, under CC-BY-4.0; its record has the attribution CDISC asks for.

Each folder of Gilead's R source has the Apache License 2.0's text beside it (`LICENSE.md`). In `gsm.kri/`, `gsm.reporting/` and `gsm.mapping-vitals/` it was added here, the same text as gsm.datasim's own, and is not in those folders' records.

`gsm.kri/` and `gsm.reporting/` were copied from safety.viz's own copies (`site/vendor/`, at commit `3396b9f3`), records and all.

One line differs from its source, and the record of `gsm.reporting/` lists it: the Results workflow names `FilterByLatestSnapshotDate` without `gsm.kri::`, because gsm.kri has no WebAssembly build and is not installed in browser R. `gsm.kri/R/util-Report.R` defines that function and is evaluated in its place.
