# gsm.datasim's study profile on a study large enough to measure: 12,000
# enrolled participants, two arms, four lab rows and three events each. Run by
# scripts/real-r.mjs in the R it has started. It answers with one line of
# name=value pairs; the tolerances are in real-r.mjs.
local({
  n <- 12000
  ids <- sprintf("S%05d", seq_len(n))
  day_one <- as.Date("2025-01-10")
  snapshot <- list(
    Raw_SUBJ = data.frame(
      studyid = "BIG", subjid = ids, invid = "SITE1", enrollyn = "Y", firstdosedate = day_one,
      stringsAsFactors = FALSE
    ),
    Raw_VISIT = data.frame(
      studyid = "BIG", subjid = rep(ids, each = 2),
      instancename = rep(c("Screening", "Week 8"), n),
      visit_dt = rep(day_one + c(-7, 56), n), stringsAsFactors = FALSE
    ),
    Raw_LB = data.frame(
      subjid = rep(ids, each = 4), visnam = rep(rep(c("Screening", "Week 8"), each = 2), n),
      lbtstnam = rep(c("ALT (SGPT)", "Sodium"), 2 * n), toxgrg_nsv = "0", stringsAsFactors = FALSE
    ),
    Raw_AE = data.frame(
      studyid = "BIG", subjid = rep(ids, each = 3), aeser = rep(c("Y", "N", "N"), n),
      mdrpt_nsv = "term1", mdrsoc_nsv = "soc1", aetoxgr = rep(c(4L, 1L, 2L), n), aeongo = "N",
      aerel = "N", mincreated_dts = day_one, aest_dt = rep(day_one + c(10, 60, 120), n),
      aeen_dt = rep(day_one + c(12, 62, 122), n), stringsAsFactors = FALSE
    )
  )
  made <- function(profile) {
    apply_study_results(snapshot, list(ecg = FALSE, profile = profile), snapshot_date = day_one + 400)
  }
  plain <- apply_study_results(snapshot, list(ecg = FALSE), snapshot_date = day_one + 400)
  neutral <- made(study_profile("P2"))
  off <- made(FALSE)
  p1 <- made(study_profile("P1"))
  p3 <- made(study_profile("P3"))
  onc <- made(study_profile("P2", "Oncology"))
  vir <- made(study_profile("P2", "Virology"))
  inf <- made(study_profile("P2", "Inflammation"))

  out_of_range <- function(study) {
    lb <- study$Raw_LB
    sodium <- lb[lb$lbtstnam == "Sodium", ]
    mean(sodium$lbresn < sodium$lbnrlo | sodium$lbresn > sodium$lbnrhi)
  }
  serious <- function(study) mean(study$Raw_AE$aeser == "Y")
  grade <- function(study) mean(as.integer(study$Raw_AE$aetoxgr))
  class_share <- function(study, class) mean(study$Raw_AE$mdrsoc_nsv == class)
  arm <- stats::setNames(plain$Raw_SUBJ$arm, plain$Raw_SUBJ$subjid)
  # A liver rise on a drug: ALT above three times the upper limit at Week 8,
  # having been within twice the limit at Screening, on the active arm.
  liver_rise <- function(study) {
    lb <- study$Raw_LB
    alt <- lb[lb$lbtstnam == "ALT (SGPT)", ]
    at <- function(visit) stats::setNames(alt$lbresn[alt$visnam == visit] / alt$lbnrhi[alt$visnam == visit], alt$subjid[alt$visnam == visit])
    before <- at("Screening")
    after <- at("Week 8")[names(before)]
    on_drug <- arm[names(before)] != "Placebo"
    mean(after[on_drug] > 3 & before[on_drug] <= 2)
  }
  raised_at_start <- function(study) {
    lb <- study$Raw_LB
    alt <- lb[lb$lbtstnam == "ALT (SGPT)" & lb$visnam == "Screening", ]
    mean(alt$lbresn > 2 * alt$lbnrhi)
  }
  disagree <- function(study) {
    ae <- study$Raw_AE
    sum((ae$aeser == "Y" & ae$aetoxgr < 3) | (ae$aeser != "Y" & ae$aetoxgr > 3))
  }
  same_events <- function(study) {
    as.integer(identical(study$Raw_AE$subjid, plain$Raw_AE$subjid) &&
      identical(as.character(study$Raw_AE$aest_dt), as.character(plain$Raw_AE$aest_dt)))
  }
  gi <- "Gastrointestinal disorders"
  msk <- "Musculoskeletal and connective tissue disorders"
  infections <- "Infections and infestations"
  answer <- c(
    neutral_same = as.integer(identical(neutral, plain) && identical(off, plain)),
    out_p1 = out_of_range(p1), out_p2 = out_of_range(neutral), out_p3 = out_of_range(p3),
    out_onc = out_of_range(onc),
    serious_p1 = serious(p1), serious_p2 = serious(neutral), serious_onc = serious(onc),
    grade_p1 = grade(p1), grade_p2 = grade(neutral), grade_onc = grade(onc),
    gi_p2 = class_share(neutral, gi), gi_onc = class_share(onc, gi),
    msk_p2 = class_share(neutral, msk), msk_inf = class_share(inf, msk),
    inf_p2 = class_share(neutral, infections), inf_vir = class_share(vir, infections),
    liver_p2 = liver_rise(neutral), liver_onc = liver_rise(onc),
    start_p2 = raised_at_start(neutral), start_vir = raised_at_start(vir),
    disagree = disagree(p1) + disagree(onc) + disagree(p3),
    same_events = same_events(p1) * same_events(onc) * same_events(vir) * same_events(inf),
    labs_same_inf = as.integer(identical(inf$Raw_LB, neutral$Raw_LB)),
    serious_same_p3 = as.integer(identical(p3$Raw_AE, neutral$Raw_AE))
  )
  paste(paste0(names(answer), "=", signif(answer, 5)), collapse = ";")
})
