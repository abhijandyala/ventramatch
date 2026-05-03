# Synthetic Matching — Experimental ML Pipeline

> ## ⚠️ SYNTHETIC EXPERIMENTAL DATA — READ BEFORE USING
>
> - All data is **entirely synthetic**. No real user data is involved.
> - This pipeline is **NOT investment advice**.
> - It does **NOT** predict startup success or investment returns.
> - It trains on **rule-generated labels** from `scripts/generate-synthetic-match-pairs.ts`,
>   not on real investor behaviour.
> - Artifacts produced here must **never** be deployed to production without separate
>   validation on real post-launch interaction data.
> - `scoreMatch` in `lib/matching/score.ts` remains the safe production baseline.

---

## What this is

An offline Python pipeline that trains two baseline classifiers on the 595 synthetic
startup–investor pairs and produces a full evaluation report. The purpose is:

1. **Pipeline validation** — confirm that feature extraction, labeling, and model wiring
   are all correct before real data is available.
2. **Feature-importance baseline** — verify that model-learned importances approximately
   recover the weights defined in `scripts/generate-synthetic-match-pairs.ts`.
3. **Future scaffold** — the same script can be re-run on real post-launch pair data with
   minimal changes once explicit user interactions are collected.

The model learns the **synthetic labeling rules** (a deterministic formula). Test accuracy
is expected to be ~95–99%, which reflects pipeline correctness, not real-world insight.

---

## Prerequisites

- Python 3.9 or later (3.10+ recommended; the script uses `from __future__ import annotations` for compatibility)
- `data/synthetic-matching/pairs.json` must exist (run `npm run generate:synthetic-matches` first)

Check your Python version:

```bash
python3 --version
```

---

## Setup

From the repo root:

```bash
cd scripts/ml
python3 -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows

pip install -r requirements.txt
```

> **kluster dependency check:** Per `.cursor/rules/kluster-code-verify.mdc`, `requirements.txt`
> must be checked with `kluster_dependency_check` before running `pip install`. If the kluster
> MCP is not available in your agent session, run the check manually before merging to `main`.

---

## Usage

### Full pipeline (recommended)

Run from the **repo root** in three steps or as a single chained command:

```bash
# Step 1: compute text embeddings (sentence-transformers/all-MiniLM-L6-v2)
npm run embeddings:synthetic-matches

# Step 2: regenerate pairs.json (includes Phase 10 eligibility fields)
npm run generate:synthetic-matches

# Step 3: train models and produce artifacts
# Default since Phase 10: eligible-only mode (trains on 260 eligible pairs only)
npm run train:synthetic-matches

# — OR — all three in one command
npm run prepare:synthetic-matches
```

### Phase 10 training modes

`train_synthetic_matching.py` supports three training modes via `--training-mode`:

| Mode | Description |
|---|---|
| `eligible-only` **(default since Phase 10)** | Train and evaluate on the 260 eligible pairs. Also applies models to all 335 ineligible pairs as a safety diagnostic. |
| `full` | Legacy behavior — train and evaluate on all 595 pairs. Use to reproduce pre-Phase-10 (Phase 7/8) numbers. |
| `eligible-train-full-eval` | Train on eligible pairs; export predictions across all 595 pairs for comparison. |

```bash
# Default (eligible-only)
python3 scripts/ml/train_synthetic_matching.py

# Legacy full-dataset mode
python3 scripts/ml/train_synthetic_matching.py --training-mode full

# Eligible training + full-dataset export
python3 scripts/ml/train_synthetic_matching.py --training-mode eligible-train-full-eval
```

### Other individual script flags

```bash
# Compute embeddings only
python3 scripts/ml/compute_embeddings.py

# Validate data only — skip training
python3 scripts/ml/train_synthetic_matching.py --validate-only

# Custom artifacts output directory
python3 scripts/ml/train_synthetic_matching.py --output-dir /tmp/my-artifacts
```

### Runtimes (approximate, CPU-only)

| Step | Time |
|------|------|
| `compute_embeddings.py` | ~5–10 s (model already cached) |
| `generate:synthetic-matches` | < 1 s |
| `train:synthetic-matches` | < 15 s |
| **Total** (`prepare:synthetic-matches`) | **~20–30 s** |

First-run model download: ~80 MB to `~/.cache/huggingface/`. Subsequent runs use cache.

---

## Generated artifacts

All artifacts are written to `data/synthetic-matching/artifacts/` (gitignored).

| File | Description |
|------|-------------|
| `eval_report.md` | Full human-readable report with all metrics, feature importance interpretation, hard eligibility summary, and caveats |
| `confusion_matrix_gbm.png` | 5×5 heatmap (count + row-%) for GBM |
| `confusion_matrix_gbm.csv` | Same as PNG, machine-readable |
| `confusion_matrix_logreg.png` | Confusion matrix for Logistic Regression |
| `confusion_matrix_logreg.csv` | CSV version |
| `confusion_matrix_decisiontree.png` | Confusion matrix for Decision Tree |
| `confusion_matrix_decisiontree.csv` | CSV version |
| `feature_importance_gbm.png` | GBM native feature importances vs labeling formula weights |
| `feature_importance_logreg.png` | LogReg mean \|coefficient\| vs labeling formula weights |
| `feature_importance_decisiontree.png` | Decision tree importances |
| `predictions.csv` | Per-pair predictions from all 3 models + class probabilities + `eligible_for_model_ranking` + `hard_filter_reasons` |
| `predictions_ineligible.csv` | **(Phase 10)** Model predictions on all 335 ineligible pairs — safety diagnostic only; includes `false_promotion_risk` flag per row |
| `predictions_all.csv` | **(eligible-train-full-eval mode only)** Predictions from eligible-trained models on all 595 pairs |
| `eligibility_summary.json` | **(Phase 10)** Machine-readable eligibility counts, reason breakdown, and false-promotion risk per model |
| `decision_tree.txt` | Human-readable if-then rule set from the shallow decision tree |

---

## Models

| Model | Purpose |
|-------|---------|
| **GradientBoostingClassifier** (primary) | Handles non-linear cap interactions; provides native feature importances |
| **LogisticRegression** (linear baseline) | Establishes a floor; multinomial; uses mean \|coefficient\| as importance |
| **DecisionTreeClassifier** (depth ≤ 6) | Readable rule approximation; exported to `decision_tree.txt` |

All models use `random_state=42`. 5-fold stratified CV is run on the training set before
the final 80/20 split evaluation.

---

## Interpreting results

### Accuracy

Expect ~95–99% across all models. This is not meaningful "intelligence" — the model is
recovering a fixed deterministic formula. Anything below ~90% would indicate a bug in
the feature pipeline or data loading.

### Feature importance vs. labeling weights

The `feature_importance_gbm.png` chart overlays the GBM-learned importances (blue bars)
against the labeling formula weights from `LABELING_WEIGHTS` (orange dashed line). If the
GBM's learned importance for `sector_overlap_score` is higher than its formula weight of
0.20, it means the non-linear cap rules (anti-thesis, stage, check) create compounding
threshold effects that boost the apparent importance of sector beyond its linear weight.

### Ordinal MAE

Mean Absolute Error treating label index as a numeric ordinal (0–4). An MAE of 0.05
means predictions are off by 0.05 label steps on average. A mislabeling of `4 → 3`
contributes MAE=1; a mislabeling of `4 → 0` contributes MAE=4.

### Predictions CSV

`predictions.csv` includes the startup_id, investor_id, true label, predicted labels
from all three models, and GBM class probabilities. Useful for:
- Identifying which pairs the models consistently get wrong
- Checking whether label-4 (excellent fit) pairs are correctly separated from label-3

---

## Phase 13 — Profile Quality Review (offline synthetic harness)

Profile quality review lives in `lib/quality/` (TypeScript rules engine) and `scripts/quality/` (offline harness).  It is separate from the ML pipeline and is documented in `docs/synthetic-matching-lab.md § 9`.

```bash
# Run quality review against 35 synthetic startups + 17 synthetic investors
npm run quality:synthetic-matches
# Outputs (gitignored):
#   data/synthetic-matching/quality/quality_review.csv
#   data/synthetic-matching/quality/quality_review_summary.json
#   data/synthetic-matching/quality/quality_review_report.md
```

**This is NOT part of the ML training pipeline.**  The quality rules run in TypeScript, not Python, and have no dependencies on scikit-learn, pandas, or any ML library.  The ML pipeline and the quality pipeline are independent.

## Phase 12 — Synthetic Personalization Simulator

### Purpose

Phase 12 adds a synthetic personalization layer that tests whether user-specific behavior signals can improve per-founder and per-investor rankings *on top of* the global model candidate (LogReg C=2.0).  It is entirely offline, entirely synthetic, and never touches the production feed.

### Hard boundaries

| Constraint | Status |
|---|---|
| All personas, actions, and rankings are SYNTHETIC | ✅ No real user, founder, or investor is represented |
| Not investment advice | ✅ Prominent disclaimers in every script and output |
| Does not predict startup success | ✅ |
| No production wiring | ✅ `lib/matching/score.ts` and `lib/feed/query.ts` are untouched |
| `scoreMatch` remains the production baseline | ✅ |
| Hard eligibility is NON-NEGOTIABLE | ✅ The personalization layer raises an error if any ineligible pair is about to be scored |
| Personalization cannot override eligibility | ✅ Enforced structurally: only eligible pairs enter the scoring pipeline |
| latent_preferences are never read by the model | ✅ Preference vectors are learned from the action stream only |
| latent_score in CSVs is audit-only | ✅ Documented in every output file header |

### Workflow

```
generate_personas.py          → synthetic_personas.json
    ↓
simulate_actions.py           → simulated_actions.csv
    ↓
preference_vector.py          → persona_preference_vectors.json
    ↓
personalize.py                → personalized_rankings.csv
    ↓
eval_personalization.py       → personalization_metrics.json
                                personalization_report.md
```

### Commands

```bash
# Step 1: Generate personas, simulate actions, build preference vectors
npm run simulate-personas:synthetic-matches

# Step 2: Compute personalized rankings + run evaluation
npm run evaluate-personalization:synthetic-matches

# — OR — full pipeline in one command
npm run prepare-personalization:synthetic-matches
```

### Input files (committed or generated upstream)

| File | Description |
|---|---|
| `data/synthetic-matching/startups.json` | 35 synthetic startup profiles |
| `data/synthetic-matching/investors.json` | 17 synthetic investor profiles |
| `data/synthetic-matching/pairs.json` | 595 labeled pairs (260 eligible) |
| `data/synthetic-matching/embeddings/startups.json` | MiniLM 384-dim embeddings |
| `data/synthetic-matching/artifacts/champion_candidate.json` | LogReg C=2.0 champion metadata |
| `data/synthetic-matching/artifacts/predictions_eligible_oof_multiseed.csv` | Global model scores |

### Generated artifacts (gitignored)

| File | Description |
|---|---|
| `synthetic_personas.json` | 12 synthetic investor-side personas with latent preferences |
| `simulated_actions.csv` | Per-persona shown/save/like/pass/intro action stream |
| `persona_preference_vectors.json` | Learned categorical preferences + semantic centroids |
| `personalized_rankings.csv` | Per-persona candidate lists with global + personalized scores |
| `personalization_metrics.json` | All evaluation metrics (latent NDCG, label NDCG, safety, diversity) |
| `personalization_report.md` | Human-readable evaluation report with recommendation |

### Blending formula

```
global_norm    = expected_label_logreg_c2.0 / 4.0         ∈ [0, 1]
pers_score     = weighted sum of 6 dimension scores        ∈ [-0.95, 0.95]
final_score    = global_norm + confidence × 0.5 × pers_score
```

`behavior_confidence` ∈ [0, 0.40] is a logistic curve over the number of weighted actions.
Cold-start users (few actions) get conf ≈ 0.03; the most active users reach conf ≈ 0.18.
Even at max confidence, personalization shifts the score by at most **8.5%** of the label range.

### Phase 12 current result (Phase 12b-ii)

| Metric | Value |
|---|---|
| Recommendation | **PROCEED_TO_PERSONALIZATION_REFINEMENT** |
| Eligibility violations | **0** |
| Personalization-only ranking jumps | **0** |
| Diversity alerts | **0** |
| Latent NDCG@5 delta | **+0.0017** (stable or slight improvement) |
| Original-label NDCG@5 delta | **−0.0010** (global quality preserved) |
| Positive-action mean Δrank | **+0.07** (moved slightly up) |
| Pass-action mean Δrank | **−0.47** (moved down ✅) |

### Interpretation

- Personalization is **conservative and safe** at current confidence levels.
- Improvement is small because confidence weights are intentionally low (max 0.40, typically 0.03–0.18).
- The next refinement phase should tune personalization weights or expand action simulation, **not connect production yet**.
- Any production deployment requires validation on real post-launch interaction data.

### Files in this directory (Phase 12 additions)

```
scripts/ml/personalization/
  __init__.py              Package marker
  persona_models.py        Persona + LatentPreferences data classes
  generate_personas.py     Define and validate 12 synthetic investor personas
  simulate_actions.py      Generate synthetic action streams from latent preferences
  preference_vector.py     Learn preference vectors from action streams (no latent prefs)
  personalize.py           Compute personalized rankings using preference vectors
  eval_personalization.py  Evaluate before/after metrics; write recommendation
```

## Phase 11c — Model Stability, Calibration, and Champion Candidate

Phase 11c validates whether LogReg is the stable global model candidate before moving
to the personalization simulator.  Three new commands run in sequence:

```bash
# Step 1: Multi-seed OOF (5 seeds × 3 LogReg C values + GBM + DecisionTree)
npm run train-multiseed:synthetic-matches

# Step 2: Multi-seed ranking evaluation (NDCG@K, P@K, MAP@K across seeds)
npm run eval-ranking-multiseed:synthetic-matches

# Step 3: Calibration metrics + champion candidate synthesis
npm run eval-calibration:synthetic-matches
```

### Training modes summary

| Mode | Default? | What it does |
|---|---|---|
| `eligible-only` | ✅ | Train + eval on 260 eligible pairs; Phase 11b OOF |
| `--multiseed` | flag | Add 5-seed OOF for LogReg C grid {0.5, 1.0, 2.0} + GBM + DT |
| `full` | `--training-mode full` | Legacy — all 595 pairs |
| `eligible-train-full-eval` | `--training-mode` flag | Train eligible, predict all |

Seeds evaluated: `[42, 7, 19, 51, 73]`.  LogReg C grid: `[0.5, 1.0, 2.0]`.

### Calibration metrics

`eval_calibration.py` computes on the single-seed OOF predictions (260 pairs):

| Metric | Model | Interpretation |
|---|---|---|
| **Brier score (top-tier)** | LogReg, GBM | MSE for P(label≥3). Lower = better. |
| **ECE@10** | LogReg, GBM | Expected Calibration Error, 10 bins. <0.05 = well-calibrated; <0.10 = acceptable; >0.10 = recalibration recommended. |
| **Brier score (label=4)** | LogReg, GBM | MSE for P(label=4). |
| **Multiclass log loss** | LogReg, GBM | Cross-entropy over all 5 classes. |

If ECE > 0.10, the calibration report notes it and recommends a future recalibration phase.
No isotonic or Platt recalibration is performed in Phase 11c.

### Phase 11c artifacts

| File | Description |
|------|-------------|
| `predictions_eligible_oof_multiseed.csv` | Long-format: 260 pairs × 5 seeds × 5 models = 6 500 rows |
| `multiseed_metrics.json` | OOF accuracy/MAE per seed per model; safety diagnostic; selected C |
| `multiseed_report.md` | Human-readable classification metrics and preliminary C selection |
| `ranking_metrics_multiseed.json` | NDCG@K, P@K, MAP@K — mean ± std ± CI95 across seeds |
| `ranking_report_multiseed.md` | Human-readable ranking comparison with per-seed NDCG@5 detail |
| `calibration_metrics.json` | Brier, ECE, log-loss for LogReg and GBM |
| `calibration_report.md` | Calibration report with per-bin table |
| `champion_candidate.json` | Machine-readable champion summary with all metrics |
| `champion_candidate.md` | Human-readable champion summary |

### C selection rule

1. Reject any LogReg C that increases false-promotion risk above the Phase 10b baseline
   (11/335 ineligible pairs predicted as label ≥ 3).
2. Among safe C values: pick the one with highest mean per-founder NDCG@5 across seeds.
3. If tied within 0.2 pp: prefer lower C (more conservative regularization).

The ranking-based selection (from `eval-ranking-multiseed`) takes precedence over the
preliminary classification-based selection (from `train-multiseed`).

## Phase 10 — Hard Eligibility Layer

### What hard eligibility is

Hard eligibility is a **policy gate** that runs before any model ranking. It is not a learned
preference, not a scored signal, and not a feature in the model.

The gate has three rules (thresholds from `lib/matching/eligibility.ts` and its Python mirror
`scripts/ml/eligibility.py`):

| Rule | Condition | Reason code |
|---|---|---|
| Anti-thesis conflict | `anti_thesis_conflict_score >= 0.5` | `anti_thesis_conflict` |
| Stage mismatch | `stage_match_score == 0` | `stage_mismatch` |
| Check-size mismatch | `check_size_score < 0.25` | `check_size_mismatch` |

Of 595 synthetic pairs: **260 are eligible (43.7%)** and **335 are ineligible (56.3%)**.

### Why the gate is necessary — false-promotion risk

In `eligible-only` mode, each trained model is also applied to all 335 ineligible pairs as a
**safety diagnostic** (never for training — ineligible pairs are excluded from the train/test
split). The results confirm the gate is essential:

| Model | Would falsely promote ineligible pairs to label ≥ 3 |
|---|---|
| GBM | 4 / 335 (1.2%) |
| LogReg | 11 / 335 (3.3%) |
| DecisionTree | **85 / 335 (25.4%)** |

Without the gate, DecisionTree would falsely rank 1-in-4 ineligible pairs as strong or excellent
fit. The gate must run before the model at inference time — it is not a feature the model learns.

### `predictions_ineligible.csv`

This file records what each model would predict for every ineligible pair. It is a **diagnostic
artifact only**. The `false_promotion_risk` column is `1` when any model predicts label ≥ 3.

**Ineligible pairs must never be passed to a production ranking model.** This file exists to
measure and communicate the risk of omitting the eligibility gate, not to use the predictions.

## Next steps after synthetic validation

Once this pipeline is validated, the path to a production-capable model involves:

1. **Collect real interaction data** post-launch (likes, passes, mutual matches) with
   explicit user consent and in compliance with the privacy policy.
2. **Embed text fields** — replace `semantic_similarity_placeholder` with real
   embeddings over `investment_thesis`, `one_liner`, `founder_background`.
3. **Re-run this script on real pair data** — compare feature distribution and
   class separation against the synthetic baseline.
4. **A/B test against `scoreMatch`** — deploy the experimental model behind a feature
   flag and compare match-to-intro conversion rate.

---

## Embedding model details (Phase 7)

| Property | Value |
|---|---|
| Model | `sentence-transformers/all-MiniLM-L6-v2` |
| Dimensions | 384 |
| Normalisation | L2-normalised (dot product = cosine similarity) |
| Download | ~80 MB, cached in `~/.cache/huggingface/` |
| License | Apache 2.0 |
| Startup text | `one_liner + problem + solution + "Team: " + founder_background` |
| Investor text | `investment_thesis` |

### When to regenerate embeddings

- Whenever `data/synthetic-matching/startups.json` or `investors.json` is changed.
- After running `npm run generate:synthetic-matches` without embeddings, a warning will appear.
- Embeddings are cached — if profiles have not changed, you don't need to recompute.

### Cache invalidation

The script checks `embeddings/_metadata.json` for `n_startups` and `n_investors`. If the
profile files have changed, the counts may still match — run `compute_embeddings.py` again
manually to be safe whenever the profile text changes (even if counts are stable).

## Files in this directory

```
scripts/ml/
  compute_embeddings.py         Phase 7: local MiniLM embedding computation
  train_synthetic_matching.py   Main training/evaluation pipeline (Phase 10 default: eligible-only)
  analyze_semantic_agreement.py Phase 8/10: semantic agreement analysis (eligibility-aware)
  eligibility.py                Phase 10: Python mirror of lib/matching/eligibility.ts
                                Defines hard eligibility thresholds and evaluate_eligibility().
                                MUST stay in sync with lib/matching/eligibility.ts.
  requirements.txt              Python dependencies (including sentence-transformers)
  README.md                     This file
  .venv/                        Local virtualenv (gitignored, ~900 MB with torch)
```

Do not commit `.venv/` or any generated `__pycache__/` directories.
