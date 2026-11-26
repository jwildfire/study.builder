# gsm.datasim's study results on a study large enough to measure: 6,000
# enrolled participants, three arms, three events each. Run by
# scripts/real-r.mjs in the R it has started, after a study with an efficacy
# score has been built (so EfficacyModel() is there). It answers with one line
# of name=value pairs; the tolerances are in real-r.mjs.
local({
  n <- 6000
  ids <- sprintf("S%05d", seq_len(n))
  day_one <- as.Date("2025-01-10")
  snapshot <- list(
    Raw_SUBJ = data.frame(
      studyid = "BIG", subjid = ids, invid = "SITE1", enrollyn = "Y", firstdosedate = day_one,
      stringsAsFactors = FALSE
    ),
    Raw_VISIT = data.frame(
      studyid = "BIG", subjid = rep(ids, each = 3),
      instancename = rep(c("Baseline", "Week 12", "Week 24"), n),
      visit_dt = rep(day_one + c(0, 84, 168), n), stringsAsFactors = FALSE
    ),
    Raw_AE = data.frame(
      studyid = "BIG", subjid = rep(ids, each = 3), aeser = rep(c("Y", "N", "N"), n),
      mdrpt_nsv = "term1", mdrsoc_nsv = "soc1", aetoxgr = rep(c(1L, 5L, 2L), n), aeongo = "N",
      aerel = "N", mincreated_dts = day_one, aest_dt = rep(day_one + c(10, 60, 120), n),
      aeen_dt = rep(day_one + c(12, 62, 122), n), stringsAsFactors = FALSE
    ),
    Raw_STUDCOMP = data.frame(
      studyid = character(0), compyn = character(0), compreas = character(0),
      mincreated_dts = as.Date(character(0)), subjid = character(0), invid = character(0),
      stringsAsFactors = FALSE
    )
  )
  results <- list(
    arms = c("Placebo", "Low", "High"), ecg = FALSE,
    scores = list(list(
      name = "Score", visits = c("Baseline", "Week 24"), baseline = 24, sd = 6.5, change = 2.5,
      effects = c(Low = -1.5, High = -3), day = 169, min = -100, max = 200
    )),
    events = list(ratio = 2),
    dropout = list(rate = 0.3, arms = c(High = 0.5), day = 169)
  )
  late <- apply_study_results(snapshot, results, snapshot_date = day_one + 400)
  again <- apply_study_results(late, results, snapshot_date = day_one + 400)
  early <- apply_study_results(snapshot, results, snapshot_date = day_one + 60)
  plain <- apply_study_results(snapshot, list(arms = results$arms, ecg = FALSE))

  arm <- stats::setNames(late$Raw_SUBJ$arm, late$Raw_SUBJ$subjid)
  gone <- late$Raw_STUDCOMP[late$Raw_STUDCOMP$compyn %in% "N", , drop = FALSE]
  left_share <- function(which_arm) mean(names(arm)[arm == which_arm] %in% gone$subjid)
  last <- stats::setNames(as.Date(gone$mincreated_dts), gone$subjid)
  after <- function(table, column) {
    frame <- late[[table]]
    until <- last[as.character(frame$subjid)]
    sum(!is.na(until) & as.Date(frame[[column]]) > until)
  }

  terms <- .results_ae_terms()
  drug <- terms$term[terms$drug]
  ae <- plain$Raw_AE
  ae_arm <- arm[as.character(ae$subjid)]
  ratio <- mean(ae$mdrpt_nsv[ae_arm != "Placebo"] %in% drug) / mean(ae$mdrpt_nsv[ae_arm == "Placebo"] %in% drug)
  default_ratio <- ratio
  ae2 <- late$Raw_AE
  ae2_arm <- arm[as.character(ae2$subjid)]
  ratio <- mean(ae2$mdrpt_nsv[ae2_arm != "Placebo"] %in% drug) / mean(ae2$mdrpt_nsv[ae2_arm == "Placebo"] %in% drug)
  serious <- ae2$aeser == "Y"
  signal_terms <- c("Alanine aminotransferase increased", "Blood creatinine increased", "Electrocardiogram QT prolonged")

  qs <- late$Raw_QS
  base <- qs[qs$visnam == "Baseline", c("subjid", "qsresn")]
  end <- qs[qs$visnam == "Week 24", c("subjid", "qsresn")]
  both <- merge(base, end, by = "subjid", suffixes = c("_base", "_end"))
  both$CHG <- both$qsresn_end - both$qsresn_base
  both$ARM <- arm[as.character(both$subjid)]
  means <- tapply(both$CHG, both$ARM, mean)
  adqs <- data.frame(
    USUBJID = both$subjid, ARM = both$ARM, VISIT = "Week 24", VISITNUM = 2L, TEST = "Score",
    BASE = both$qsresn_base, CHG = both$CHG, ABLFL = "", DY = 169L, stringsAsFactors = FALSE
  )
  model <- if (exists("EfficacyModel")) EfficacyModel(adqs) else NULL
  fitted <- function(which_arm, statistic) {
    if (is.null(model)) return(NA_real_)
    model$VALUE[model$ARM == which_arm & model$STATISTIC == statistic]
  }

  answers <- c(
    left_placebo = left_share("Placebo"), left_low = left_share("Low"), left_high = left_share("High"),
    rows_after_leaving = after("Raw_VISIT", "visit_dt") + after("Raw_AE", "aest_dt") + after("Raw_QS", "qs_dt"),
    finished = sum(late$Raw_STUDCOMP$compyn %in% "Y"),
    enrolled = n,
    event_ratio = ratio, default_event_ratio = default_ratio,
    placeholder_terms = sum(grepl("^(term|soc)[0-9]", c(ae2$mdrpt_nsv, ae2$mdrsoc_nsv))),
    grades_disagree = sum((serious & ae2$aetoxgr < 3) | (!serious & ae2$aetoxgr > 3)),
    events_before = nrow(snapshot$Raw_AE), events_plain = nrow(plain$Raw_AE),
    signal_events = sum(plain$Raw_AE$mdrpt_nsv %in% signal_terms),
    signal_on_placebo = sum(plain$Raw_AE$mdrpt_nsv %in% signal_terms & ae_arm == "Placebo"),
    same_twice = as.numeric(identical(late, again)),
    early_events_same = as.numeric(identical(early$Raw_AE, late$Raw_AE)),
    early_left_within = as.numeric(all(early$Raw_STUDCOMP$subjid[early$Raw_STUDCOMP$compyn %in% "N"] %in% gone$subjid)),
    early_left = sum(early$Raw_STUDCOMP$compyn %in% "N"), late_left = nrow(gone),
    no_dropout_completion_rows = nrow(plain$Raw_STUDCOMP),
    diff_low = unname(means["Low"] - means["Placebo"]), diff_high = unname(means["High"] - means["Placebo"]),
    change_placebo = unname(means["Placebo"]), sd_change = stats::sd(both$CHG[both$ARM == "Placebo"]),
    model_high = fitted("High", "adjusted difference"), model_high_se = fitted("High", "standard error"),
    model_high_p = fitted("High", "p-value"), model_low = fitted("Low", "adjusted difference")
  )
  paste(names(answers), format(answers, digits = 8, scientific = FALSE, trim = TRUE), sep = "=", collapse = ";")
})
