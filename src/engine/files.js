// Written by scripts/files.mjs from the records of the copies (vendor/*/SOURCE.json).
// Do not edit: run `npm run files`.

/** gsm.datasim’s own files that R reads, by their path under study.builder’s address. */
export const SIMULATOR_FILES = [
  "vendor/gsm.datasim/DESCRIPTION",
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
  "vendor/gsm.datasim/R/study_design.R",
  "vendor/gsm.datasim/R/study_options.R",
  "vendor/gsm.datasim/R/study_results.R",
  "vendor/gsm.datasim/R/util-pipe.R",
  "vendor/gsm.datasim/R/utils-longitudinal.R",
  "vendor/gsm.datasim/R/utils.R",
  "vendor/gsm.datasim/inst/small_template.csv",
  "vendor/gsm.datasim/inst/template.csv"
];

/** gsm.mapping’s vital signs mapping workflow. */
export const VITALS_FILE = "vendor/gsm.mapping-vitals/workflow/1_mappings/VS.yaml";

/** gsm.kri’s metric workflows and the one R file of it they need, and gsm.reporting’s workflows. */
export const GSM_FILES = [
  "vendor/gsm.kri/workflow/2_metrics/kri0001.yaml",
  "vendor/gsm.kri/workflow/2_metrics/kri0002.yaml",
  "vendor/gsm.kri/workflow/2_metrics/kri0003.yaml",
  "vendor/gsm.kri/workflow/2_metrics/kri0004.yaml",
  "vendor/gsm.kri/workflow/2_metrics/kri0005.yaml",
  "vendor/gsm.kri/workflow/2_metrics/kri0006.yaml",
  "vendor/gsm.kri/workflow/2_metrics/kri0007.yaml",
  "vendor/gsm.kri/workflow/2_metrics/kri0012.yaml",
  "vendor/gsm.kri/R/util-Report.R",
  "vendor/gsm.reporting/workflow/3_reporting/Results.yaml",
  "vendor/gsm.reporting/workflow/3_reporting/Bounds.yaml",
  "vendor/gsm.reporting/workflow/3_reporting/Groups.yaml",
  "vendor/gsm.reporting/workflow/3_reporting/Metrics.yaml"
];

/** study.builder’s own workflows, which build the layers off raw. */
export const WORKFLOW_FILES = [
  "workflows/adam/ADAE.yaml",
  "workflows/adam/ADEG.yaml",
  "workflows/adam/ADLB.yaml",
  "workflows/adam/ADQS.yaml",
  "workflows/adam/ADSL.yaml",
  "workflows/adam/ADVS.yaml",
  "workflows/analysis/AESummary.yaml",
  "workflows/analysis/AESummaryByArm.yaml",
  "workflows/analysis/EfficacySummary.yaml"
];

/** The R files beside them: a function a workflow’s step calls by name, where a query cannot do the step. */
export const WORKFLOW_HELPERS = [
  "workflows/analysis/EfficacyModel.R"
];

/** A stamp of every file R fetches: it changes when any of them does. */
export const FILES_STAMP = "1626e0a41c81";

/** What each copy was copied from. */
export const COPIED_FROM = {
  "vendor/gsm.datasim": {
    "repository": "https://github.com/jwildfire/gsm.datasim",
    "commit": "3896e9de745508d2674146c147542f4557c6f31c"
  },
  "vendor/gsm.mapping-vitals": {
    "repository": "https://github.com/Gilead-Public/gsm.mapping",
    "tag": "v1.3.0",
    "commit": "085a7e94e3ac58e951343c1070e68bb163c32a92"
  },
  "vendor/gsm.kri": {
    "repository": "https://github.com/Gilead-Public/gsm.kri",
    "tag": "v1.7.0",
    "commit": "470b1d8e79ffc9860f3d061204c7f05da7695c4e"
  },
  "vendor/gsm.reporting": {
    "repository": "https://github.com/Gilead-Public/gsm.reporting",
    "tag": "v1.1.7",
    "commit": "b3fa1339f900c5093a1e6553bdf4892d608fe389"
  }
};
