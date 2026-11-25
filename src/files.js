// Written by scripts/files.mjs from the records of the copies (vendor/*/SOURCE.json).
// Do not edit: run `npm run files`.

/** gsm.datasim’s own files that R reads, by their path under study.builder’s address. */
export const SIMULATOR_FILES = [
  "vendor/gsm.datasim/R/Raw_AE.R",
  "vendor/gsm.datasim/R/Raw_AntiCancer.R",
  "vendor/gsm.datasim/R/Raw_Baseline.R",
  "vendor/gsm.datasim/R/Raw_Consents.R",
  "vendor/gsm.datasim/R/Raw_DATACHG.R",
  "vendor/gsm.datasim/R/Raw_DATAENT.R",
  "vendor/gsm.datasim/R/Raw_Death.R",
  "vendor/gsm.datasim/R/Raw_ENROLL.R",
  "vendor/gsm.datasim/R/Raw_GENERAL.R",
  "vendor/gsm.datasim/R/Raw_IE.R",
  "vendor/gsm.datasim/R/Raw_LB.R",
  "vendor/gsm.datasim/R/Raw_OverallResponse.R",
  "vendor/gsm.datasim/R/Raw_PD.R",
  "vendor/gsm.datasim/R/Raw_PK.R",
  "vendor/gsm.datasim/R/Raw_QUERY.R",
  "vendor/gsm.datasim/R/Raw_Randomization.R",
  "vendor/gsm.datasim/R/Raw_SDRGCOMP.R",
  "vendor/gsm.datasim/R/Raw_SITE.R",
  "vendor/gsm.datasim/R/Raw_STUDCOMP.R",
  "vendor/gsm.datasim/R/Raw_STUDY.R",
  "vendor/gsm.datasim/R/Raw_SUBJ.R",
  "vendor/gsm.datasim/R/Raw_VISIT.R",
  "vendor/gsm.datasim/R/Raw_VS.R",
  "vendor/gsm.datasim/R/Raw_gilda_STUDY.R",
  "vendor/gsm.datasim/R/column_type_generator.R",
  "vendor/gsm.datasim/R/create_longitudinal_study.R",
  "vendor/gsm.datasim/R/create_snapshot_reports.R",
  "vendor/gsm.datasim/R/domain_registry.R",
  "vendor/gsm.datasim/R/endpoints_domains_helper.R",
  "vendor/gsm.datasim/R/export_study_data.R",
  "vendor/gsm.datasim/R/generate_data_from_workflows.R",
  "vendor/gsm.datasim/R/generate_rawdata_for_single_study.R",
  "vendor/gsm.datasim/R/generate_risk_signals.R",
  "vendor/gsm.datasim/R/gsm.datasim-package.R",
  "vendor/gsm.datasim/R/gsm_utils.R",
  "vendor/gsm.datasim/R/import-gsm.mapping-CombineSpecs.R",
  "vendor/gsm.datasim/R/raw_data_generator.R",
  "vendor/gsm.datasim/R/study_builder.R",
  "vendor/gsm.datasim/R/util-pipe.R",
  "vendor/gsm.datasim/R/utils-longitudinal.R",
  "vendor/gsm.datasim/R/utils.R",
  "vendor/gsm.datasim/inst/template.csv",
  "vendor/gsm.datasim/inst/small_template.csv",
  "vendor/gsm.datasim/DESCRIPTION"
];

/** gsm.mapping’s vital signs mapping workflow. */
export const VITALS_FILE = "vendor/gsm.mapping-vitals/workflow/1_mappings/VS.yaml";

/** study.builder’s own workflows, which build the layers off raw. */
export const WORKFLOW_FILES = [
  "workflows/adam/ADAE.yaml",
  "workflows/adam/ADSL.yaml",
  "workflows/adam/ADVS.yaml"
];

/** What each copy was copied from. */
export const COPIED_FROM = {
  "vendor/gsm.datasim": {
    "repository": "https://github.com/Gilead-Public/gsm.datasim",
    "tag": "v2.1.0",
    "commit": "29fc61c1ca83ceaf38c4c2ba54613872aa5a1d66"
  },
  "vendor/gsm.mapping-vitals": {
    "repository": "https://github.com/Gilead-Public/gsm.mapping",
    "tag": "v1.3.0",
    "commit": "085a7e94e3ac58e951343c1070e68bb163c32a92"
  }
};
