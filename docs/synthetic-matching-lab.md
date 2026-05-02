# Synthetic Matching Lab — Documentation

> ## ⚠️ Critical notice — read before touching anything in this lab
>
> - **All data is entirely synthetic.** No real users, founders, or investors are represented anywhere in this pipeline.
> - **This is NOT investment advice.** No output of this lab constitutes a recommendation to invest in any company.
> - **This does NOT predict startup success.** No score, label, or model artifact here should be interpreted as a fundability score, a return-potential score, or a forecast of business outcomes.
> - **This is NOT real traction data.** Synthetic traction fields (`arr`, `enterprise_contracts`, etc.) are fictional — they are not evidence of real company performance.
> - **No trained model should be deployed to production** based on this lab alone. `scoreMatch` in `lib/matching/score.ts` is the safe production baseline until real-data validation exists.

---

## 1. Purpose

VentraMatch is pre-launch and has no real user interaction data. Before launch, it is impossible to train a matching model on real founder–investor engagement signals (likes, passes, mutual matches). The Synthetic Matching Lab exists to:

1. **Build and validate the feature extraction pipeline** before real data arrives, so integration is minimal when real profiles exist.
2. **Test the labeling logic** (weighted score + caps) in a controlled dataset with known properties.
3. **Explore whether embeddings add signal** to the structured feature set, and understand where text similarity agrees or disagrees with rule-based labels.
4. **Establish a before/after baseline** so that when real data is collected, we can measure whether real-world behavior matches the synthetic model's predictions.
5. **Develop and validate the hard eligibility layer** (Phase 10) so the future global ranking model separates pairs that are safe to rank from pairs that must be blocked unconditionally.
6. **Explore synthetic personalization** (Phase 12) so user-specific preference signals can be tested offline before any real interaction data is available — without ever connecting to the production feed.
7. **Validate profile quality rules** (Phase 13) offline against synthetic profiles before wiring them into the production review queue, catching false positives and calibration issues safely.

What this lab is **not**:

- Not a substitute for real user feedback.
- Not a replacement for the existing `scoreMatch` heuristic.
- Not evidence that the labels here reflect how real investors and founders behave.
- Not a deployable product feature.

---

## 2. Legal and product boundary

This entire lab operates under the constraints established in `PRODUCT.md` and `docs/legal.md`:

| Constraint | Status |
|---|---|
| No investment advice | ✅ All scripts and outputs include prominent disclaimers |
| No success prediction | ✅ No "fundability score" or "return potential" language anywhere |
| No real user data | ✅ All profiles are fictional synthetic constructs |
| No paid-data integrations | ✅ All embeddings are computed locally (offline) |
| No LLM-based match scoring | ✅ Model uses structured features + text similarity; no GPT calls |
| `scoreMatch` stays as production baseline | ✅ `lib/matching/score.ts` and `lib/feed/query.ts` are untouched |
| Hard caps non-negotiable | ✅ Anti-thesis, stage mismatch, check-size caps are permanent |
| Hard eligibility gate non-negotiable | ✅ Phase 10 gate must run before any model ranking; cannot be overridden by semantics or personalization |
| Profile quality review stays offline until Phase 14 | ✅ `lib/quality/review.ts` produces bot recommendations only; no production auto-accept/reject until a human-reviewer workflow is active |

Labels 0–4 represent **profile-fit quality for intro relevance** between two synthetic profiles. They do not represent:

- The probability that an investor would fund a startup.
- The predicted financial return of any investment.
- A ranking of startup quality or investor reputation.

---

## 3. Pipeline overview

### Dataset

| File | Contents | Status |
|------|----------|--------|
| `data/synthetic-matching/startups.json` | 35 fictional startup profiles | Committed |
| `data/synthetic-matching/investors.json` | 17 fictional investor profiles | Committed |
| `data/synthetic-matching/pairs.json` | 595 labeled startup–investor pairs with eligibility fields | **Gitignored** — generated |
| `data/synthetic-matching/embeddings/` | Pre-computed MiniLM text embeddings | **Gitignored** — generated |
| `data/synthetic-matching/artifacts/` | Training reports, confusion matrices, plots, eligibility summary | **Gitignored** — generated |

### Step 1 — Feature contract (`lib/matching/features.ts`)

`computeMatchFeatures(startup, investor, startupEmbedding?, investorEmbedding?)` returns 12 numeric features:

| Feature | Formula weight | Description |
|---|---|---|
| `sector_overlap_score` | +0.20 | Fraction of startup sectors in investor mandate (canonical normalisation) |
| `stage_match_score` | +0.18 | 1.0 exact / 0.5 adjacent / 0.2 two-step / 0 none |
| `check_size_score` | +0.15 | 1.0 in range; linear falloff outside |
| `interest_overlap_score` | +0.12 | Synonym-expanded `onboarding_interests` overlap |
| `customer_type_overlap_score` | +0.10 | Compatibility matrix |
| `business_model_overlap_score` | +0.08 | Compatibility matrix |
| `geography_score` | +0.07 | 1.0 confirmed match; 0.2 tension |
| `lead_follow_score` | +0.05 | Investor role vs startup engagement signals |
| `traction_strength_score` | +0.05 | no_traction=0 … enterprise_contracts=1 |
| `anti_thesis_conflict_score` | **−0.40 penalty** | 1 = worst conflict; 0 = none |
| `profile_completeness_score` | 0 (not in formula) | Structural completeness of both profiles |
| `semantic_similarity_score` | 0 (not in formula) | Cosine similarity from all-MiniLM-L6-v2 |

`cosineSimilarity(a, b)` is exported from `features.ts` and used by `generate-synthetic-match-pairs.ts` to populate `semantic_similarity_score`. Returns `null` if either embedding is missing.

### Step 2 — Text embeddings (`scripts/ml/compute_embeddings.py`)

Encodes 35 startups and 17 investors using `sentence-transformers/all-MiniLM-L6-v2` (384-dim, L2-normalised). First run downloads ~80 MB to `~/.cache/huggingface/`; subsequent runs use cache.

| Side | Text composition |
|---|---|
| Startup | `one_liner + problem + solution + "Team: " + founder_background` |
| Investor | `investment_thesis` |

Output:
- `data/synthetic-matching/embeddings/startups.json` — `{ startup_id: [384 floats] }`
- `data/synthetic-matching/embeddings/investors.json` — `{ investor_id: [384 floats] }`
- `data/synthetic-matching/embeddings/_metadata.json` — model name, dim, versions, text fields, timestamp

### Step 3 — Pair generation (`scripts/generate-synthetic-match-pairs.ts`)

Generates all 595 pairs (35 × 17). For each pair:

1. Loads embeddings if present; warns if missing (graceful fallback to `null`).
2. Calls `computeMatchFeatures` → 12 feature scores.
3. Computes weighted score: `Σ(feature × weight) − 0.40 × anti_thesis_conflict_score`.
4. Applies hard caps (non-negotiable):
   - `anti_thesis_conflict_score ≥ 0.5` → label capped at **1 (weak fit)**
   - `stage_match_score = 0` → label capped at **2 (possible fit)**
   - `check_size_score < 0.25` → label capped at **2 (possible fit)**
5. Checks excellent-fit conditions (must ALL pass for label 4).
6. Assigns label 0–4 based on calibrated thresholds.
7. Generates a factual `label_reason` string for each pair.
8. **Phase 10:** Calls `evaluateEligibility` (from `lib/matching/eligibility.ts`) and adds:
   - `eligible_for_model_ranking: boolean` — true only when no hard constraint is violated.
   - `hard_filter_reasons: string[]` — one or more of `anti_thesis_conflict`, `stage_mismatch`, `check_size_mismatch`; empty when eligible.

**`semantic_similarity_score` has zero weight in the labeling formula.** Labels are derived entirely from the 11 structured features. This is a deliberate design decision — see Section 5.

### Step 4 — Model training (`scripts/ml/train_synthetic_matching.py`)

Trains three classifiers using the **eligible-only** pool by default (Phase 10 default — 260 pairs). Legacy full-dataset training is available via `--training-mode full`.

| Mode | Training pool | Safety diagnostic |
|---|---|---|
| `eligible-only` (default) | 260 eligible pairs | Applies models to 335 ineligible pairs; reports false-promotion risk |
| `full` | All 595 pairs (legacy) | No ineligible diagnostic |
| `eligible-train-full-eval` | 260 eligible pairs | Applies models to all 595 pairs; exports `predictions_all.csv` |

| Model | Phase 10 eligible-only Accuracy | Phase 10 eligible-only Macro-F1 |
|---|---|---|
| LogReg + StandardScaler | 84.6% | 85.6% |
| GradientBoostingClassifier | 57.7% | 60.4% |
| DecisionTreeClassifier (depth 6) | 48.1% | 50.9% |

Lower accuracy vs Phase 7/8 full-dataset (~84–92%) is expected and meaningful: the eligible subset has a near-flat label distribution (13–27% per class), so models genuinely differentiate between labels rather than defaulting to the dominant "poor fit" class.

Produces 14+ artifacts in `data/synthetic-matching/artifacts/`:
- Confusion matrices (PNG + CSV) for each model
- Feature importance charts (PNG) for each model
- `predictions.csv` — per-pair predictions from all models (includes `eligible_for_model_ranking` and `hard_filter_reasons`)
- `predictions_ineligible.csv` — model predictions on all 335 ineligible pairs (safety diagnostic)
- `eligibility_summary.json` — machine-readable eligibility counts, reason breakdown, false-promotion risk per model
- `decision_tree.txt` — readable if-then rule set
- `eval_report.md` — comprehensive metrics report

### Step 5 — Semantic agreement analysis (`scripts/ml/analyze_semantic_agreement.py`)

Phase 8 analysis that answers: should `semantic_similarity_score` enter the labeling formula?
Phase 10 update: the analysis is now eligibility-aware and explains high-sem/low-label disagreements through both label caps and the eligibility gate.

Produces:
- `semantic_scatter.png` — scatter plot: semantic similarity vs label (regression line overlaid)
- `semantic_disagreements.csv` — high-sem/low-label, low-sem/high-label, and would-change pairs (includes `eligible_for_model_ranking` and `hard_filter_reasons` columns)
- `semantic_analysis_report.md` — full findings including a "Hard Eligibility Context" section and a clear `RECOMMEND: KEEP / APPLY` decision

---

## 4. Command reference

### Step-by-step

```bash
# From the repo root

# Step 1: compute local text embeddings (~5–10 s after first-run download)
npm run embeddings:synthetic-matches

# Step 2: generate 595 labeled pairs with eligibility fields (< 1 s)
npm run generate:synthetic-matches

# Step 3: train models + produce evaluation artifacts (~15 s)
# Default: eligible-only mode (Phase 10 default)
npm run train:synthetic-matches

# Step 4 (optional): semantic agreement analysis (~3 s)
npm run analyze:synthetic-matches
```

### One-command full pipeline

```bash
npm run prepare:synthetic-matches
# equivalent to:
# npm run embeddings:synthetic-matches && npm run generate:synthetic-matches && npm run train:synthetic-matches
```

> `analyze:synthetic-matches` is intentionally not included in `prepare:synthetic-matches` —
> it is a diagnostic step, not a required production step, and runs more slowly when retraining
> is included.

### Command flags

```bash
# Train: default eligible-only mode (Phase 10 default — trains on 260 eligible pairs only)
python3 scripts/ml/train_synthetic_matching.py

# Train: legacy full-dataset mode (reproduces Phase 7/8 behavior; all 595 pairs)
python3 scripts/ml/train_synthetic_matching.py --training-mode full

# Train: eligible-only training + full-dataset prediction export
python3 scripts/ml/train_synthetic_matching.py --training-mode eligible-train-full-eval

# Train: validate data only, skip model training
python3 scripts/ml/train_synthetic_matching.py --validate-only

# Analyze: skip the model retraining step (faster, no Phase 7/8 comparison)
python3 scripts/ml/analyze_semantic_agreement.py --skip-retrain

# Custom output directory for artifacts
python3 scripts/ml/train_synthetic_matching.py --output-dir /tmp/my-run
```

### Phase 13 — profile quality review (offline synthetic harness)

```bash
# Run quality review against all 35 synthetic startups + 17 synthetic investors
npm run quality:synthetic-matches
```

### Phase 12 — synthetic personalization pipeline

```bash
# Step 1: generate personas, simulate actions, build preference vectors
npm run simulate-personas:synthetic-matches

# Step 2: compute personalized rankings + run evaluation
npm run evaluate-personalization:synthetic-matches

# — OR — full pipeline in one command (all 5 Phase 12 scripts)
npm run prepare-personalization:synthetic-matches
```

### When to regenerate embeddings

Re-run `npm run embeddings:synthetic-matches` whenever the text content of `startups.json` or `investors.json` changes. The script writes a `_metadata.json` file with `n_startups` and `n_investors`; a count mismatch signals stale embeddings.

---

## 5. Why `semantic_similarity_score` stays out of the label formula

Phase 8 ran the semantic agreement analysis with the following result:

| Metric | Value |
|---|---|
| Pearson r (sem vs label) | **0.296** |
| Spearman ρ (sem vs label) | **0.257** |
| Pairs that would change with +0.04 max bonus | **5 / 595 (0.8%)** |
| Inflated weak/buzzword startups | **0** |
| Max distribution drift | **0.5 pp** (limit: 2 pp) |

The analysis recommendation was **KEEP FORMULA UNCHANGED** for three reasons:

1. **Near-zero practical impact.** Only 0.8% of pairs change label. Adding a non-linear bonus to the formula for a 5-pair change is not worth the interpretability cost.

2. **Caps correctly override semantic matches.** 100% of high-sem/low-label disagreements are protected by existing hard caps (anti-thesis conflict or check-size mismatch). A crypto-vocabulary investor does not become a good match for a crypto-buzzword startup that has a $10M ask vs a $350K max check. The caps are functioning correctly.

3. **The model already uses semantics.** GBM ranks `semantic_similarity_score` 4th in feature importance (0.103 / 10.3% of explained variance) without it entering the label formula. The model learns the correlation on its own. Adding it to the formula would make labels partially a function of their own explanatory feature — a source of circularity.

**Phase 10 confirmation (semantic analysis, Phase 10c):** The KEEP FORMULA UNCHANGED recommendation is unchanged after adding eligibility awareness. 22 of 27 high-sem/low-label disagreement pairs are eligibility-gated — excluded from model ranking entirely — not just label-capped. All 8 low-sem/high-label pairs are eligible, confirming structured features correctly drive high labels for rankable pairs. Semantic similarity cannot override hard eligibility.

**For future real-data sprints:** the weight should remain 0 in the labeling formula and instead be evaluated as a post-launch signal through A/B testing. If real-world interaction data shows that semantic similarity correlates with mutual match rate (independent of the structured features), then a small additive bonus can be introduced with evidence.

---

## 6. Phase 10 — Hard Eligibility Layer

Phase 10 added a hard eligibility layer to the synthetic matching lab. This section is the single source of truth for what hard eligibility is, why it exists, and how it differs from the existing label caps.

### 6.1 What hard eligibility is — and is not

Hard eligibility is a **policy gate**. It is not a learned model preference, not a scored signal, and not a soft penalization.

| Property | Label caps (Phases 1–9) | Hard eligibility gate (Phase 10) |
|---|---|---|
| **What it does** | Reduces the maximum label a pair can receive | Removes a pair from the model ranking pool entirely |
| **When applied** | During label assignment (pair generation) | Before model ranking at both train and inference time |
| **Effect on dataset** | Pair still exists with label 1 or 2 | Pair excluded from eligible training/inference pool |
| **Overrideable by semantics?** | No | No — never |
| **Overrideable by personalization?** | No | No — never |
| **Source of truth** | `generate-synthetic-match-pairs.ts` | `lib/matching/eligibility.ts` (TS) / `scripts/ml/eligibility.py` (Python mirror) |

**Critical rule:** Hard eligibility encodes investor mandate constraints that must be respected unconditionally. A future global ranking model trained on eligible pairs must never receive an ineligible pair as input at inference time — ineligible pairs must be filtered before the model runs.

### 6.2 The three hard eligibility rules

| Rule | Condition | `hard_filter_reasons` code |
|---|---|---|
| Anti-thesis conflict | `anti_thesis_conflict_score >= 0.5` | `"anti_thesis_conflict"` |
| Stage mismatch | `stage_match_score === 0` (exactly zero — adjacent stages with score 0.5 remain eligible) | `"stage_mismatch"` |
| Check-size mismatch | `check_size_score < 0.25` | `"check_size_mismatch"` |

A pair may carry multiple reasons (e.g., both `anti_thesis_conflict` and `check_size_mismatch`). All applicable reasons are recorded. `eligible_for_model_ranking` is `true` only when `hard_filter_reasons` is empty.

### 6.3 New pair output fields (Phase 10a)

Each record in `data/synthetic-matching/pairs.json` now includes:

```ts
{
  startup_id: string,
  investor_id: string,
  features: MatchFeatures,        // 12 numeric features (unchanged)
  label: 0 | 1 | 2 | 3 | 4,      // label assignment (unchanged)
  label_name: string,             // unchanged
  label_reason: string,           // unchanged
  // ── Phase 10 additions ──────────────────────────────────────
  eligible_for_model_ranking: boolean,  // true only when hard_filter_reasons is empty
  hard_filter_reasons: string[],        // [] when eligible; one or more reason codes otherwise
}
```

### 6.4 Phase 10 eligibility stats (595 synthetic pairs)

| Property | Value |
|---|---|
| Total pairs | 595 |
| Eligible for model ranking | **260 / 595 (43.7%)** |
| Ineligible | **335 / 595 (56.3%)** |

| Hard filter reason | Count | Notes |
|---|---|---|
| `check_size_mismatch` | 240 | Most common; raise amount far outside investor check band |
| `anti_thesis_conflict` | 142 | Investor mandate explicitly excludes the startup's sector/model |
| `stage_mismatch` | 24 | No stage overlap at all |
| Pairs with 2+ reasons | 64 | Counted once per pair; reason counts may sum > 335 |

**Label cross-tab for ineligible pairs:**

| Label | Count | Note |
|---|---|---|
| 0 — poor fit | 200 | Expected |
| 1 — weak fit | 74 | Anti-thesis cap correctly limits these to ≤ 1 |
| 2 — possible fit | 61 | Stage/check caps correctly limit these to ≤ 2 |
| 3 — strong fit | **0** | ✅ Gate and caps are consistent |
| 4 — excellent fit | **0** | ✅ Gate and caps are consistent |

No ineligible pair carries label ≥ 3. The existing label caps (anti-thesis → label ≤ 1; stage/check → label ≤ 2) guarantee this. The eligibility gate and label caps are fully consistent.

### 6.5 Why the eligibility gate is necessary — Phase 10b model safety finding

When the three eligible-only trained models were applied to all 335 ineligible pairs as a safety diagnostic (View B), the results confirmed the gate is doing real protective work:

| Model | Predicted label ≥ 3 without gate | Predicted label = 4 | Primary reason |
|---|---|---|---|
| GradientBoostingClassifier | **4 / 335 (1.2%)** | 0 | check_size_mismatch |
| Logistic Regression | **11 / 335 (3.3%)** | 0 | check_size_mismatch |
| DecisionTree | **85 / 335 (25.4%)** | 17 | check_size_mismatch |

Without the eligibility gate, **DecisionTree would falsely promote 25% of ineligible pairs to strong or excellent fit**. GBM and LogReg are more conservative but still promote some. These would be false rankings of pairs that violate hard investor mandate constraints.

**This proves the eligibility gate must remain outside the model and must not be learned as a ranking signal.** A model that partially learns eligibility rules would enforce them softly (e.g., "slightly fewer check-size mismatches in top results") rather than absolutely. That is not safe — mandate constraints are binary, not gradable.

### 6.6 Semantic analysis through an eligibility lens — Phase 10c finding

After adding eligibility awareness to `analyze_semantic_agreement.py`:

| Property | Value |
|---|---|
| Semantic formula recommendation | **KEEP FORMULA UNCHANGED** (unchanged from Phase 8) |
| High-sem / low-label pairs | 27 |
| ↳ cap-protected | 27 (100%) |
| ↳ eligibility-gated (also removed from model) | 22 / 27 (81%) |
| Low-sem / high-label pairs | 8 |
| ↳ ineligible | **0** ✅ |

All 8 low-sem/high-label pairs are eligible — structured mandate alignment correctly drives their high labels. Semantic similarity carries genuine signal (Pearson r = 0.296) but cannot and must not override either label caps or the eligibility gate.

### 6.7 Implementation files

| File | Language | Role |
|---|---|---|
| `lib/matching/eligibility.ts` | TypeScript | **Canonical source of truth** for all hard eligibility constants and logic |
| `scripts/ml/eligibility.py` | Python | Mirror of the TypeScript module, used by ML training scripts. Must stay in sync with the TS file. |

---

## 7. Phase 12 — Synthetic Personalization Simulator

Phase 12 adds a synthetic personalization layer that tests whether user-specific behavior signals can improve per-founder and per-investor rankings *on top of* the global model candidate (LogReg C=2.0). It is entirely offline, entirely synthetic, and never touches the production feed.

### 7.1 What synthetic personalization is — and is not

| Property | Value |
|---|---|
| **What it does** | Learns categorical preferences + semantic centroids from simulated action streams; re-ranks eligible candidates using a small confidence-weighted correction |
| **What it does NOT do** | Connect to production, use real user data, override hard eligibility, replace `scoreMatch`, or constitute investment advice |
| **Hard guardrail** | The personalization layer raises an error if any ineligible pair is about to be scored. It is structurally impossible for personalization to surface ineligible pairs. |
| **Global model dominance** | `final_score = global_norm + confidence × 0.5 × pers_score`. Even the most active synthetic user shifts rankings by at most **8.5%** of the label range. |
| **latent_preferences isolation** | Preference vectors are learned entirely from the action stream. `latent_preferences` (the ground-truth used for simulation) are never read by `personalize.py` or `eval_personalization.py`. |

### 7.2 Pipeline (5 scripts in sequence)

```
generate_personas.py  → synthetic_personas.json
    ↓
simulate_actions.py   → simulated_actions.csv
    ↓
preference_vector.py  → persona_preference_vectors.json
    ↓
personalize.py        → personalized_rankings.csv
    ↓
eval_personalization.py → personalization_metrics.json
                          personalization_report.md
```

**Step 1 — `generate_personas.py`**  
Defines 12 synthetic investor-side personas with latent preferences (used only by step 2) and behavioral parameters (`n_actions_simulated`, `noise_level`). Personas span sector/stage/geography/style archetypes and include deliberately challenging cases (high noise, cold-start).

**Step 2 — `simulate_actions.py`**  
Simulates a feed experience for each persona: shown → profile_viewed / save / like / pass / intro_requested. Actions are generated deterministically (seeded per persona) from the latent preferences, not from the preference vectors. `latent_score` in the output CSV is for audit only.

**Step 3 — `preference_vector.py`**  
Learns preference vectors from the action stream (never from `latent_preferences`). Outputs:
- Categorical preference maps (positive/negative sectors, stages, customer types, business models, geographies) — normalised to [0, 1].
- Semantic centroids: L2-normalised weighted-mean embeddings of liked/saved/intro'd startups (positive) and passed startups (negative). Null when fewer than 3 weighted actions contribute.
- `behavior_confidence` from a logistic curve — low for sparse users, max 0.40 at any activity level.

**Step 4 — `personalize.py`**  
Uses the champion LogReg C=2.0 global scores (mean across 5-seed OOF) and the preference vectors to compute personalized rankings. Formula:
```
global_norm   = expected_label_logreg_c2.0 / 4.0
pers_score    = Σ dim_weight × dim_score    ∈ [-0.95, 0.95]
final_score   = global_norm + confidence × 0.5 × pers_score
```

**Step 5 — `eval_personalization.py`**  
Evaluates before/after rankings against two ground truths: (a) synthetic latent scores (does personalization recover persona preferences?) and (b) original pair labels (does personalization preserve global quality?). Also checks safety, diversity, and behavior-action rank movement.

### 7.3 Phase 12 results (Phase 12b-ii / Phase 12c final state)

| Metric | Value |
|---|---|
| Recommendation | **PROCEED_TO_PERSONALIZATION_REFINEMENT** |
| Eligibility violations | **0** ✅ |
| Personalization-only ranking jumps | **0** ✅ |
| Diversity alerts | **0** ✅ |
| Latent NDCG@5 delta | **+0.0017** (stable or slight improvement) |
| Original-label NDCG@5 delta | **−0.0010** (within noise; global quality preserved) |
| Positive-action mean Δrank | **+0.07** (moved slightly up ✅) |
| Pass-action mean Δrank | **−0.47** (moved down ✅) |
| Behavior confidence range | 0.024 (tiny pool) → 0.178 (most active persona) |

**Interpretation:**

- Personalization is **conservative and safe** at current confidence levels.  The conservative blend means the global model still drives 92–98% of the final score for any persona.
- Improvement is small because `behavior_confidence` is intentionally low (max 0.18 reached with 13.9 weighted actions). This is the correct design, not a bug.
- This proves the **mechanism** (the pipeline works; no eligibility violations; pass candidates move down; positive candidates move slightly up), not real investor behavior.
- Real personalization requires real interaction data after launch.

### 7.4 Implementation files

| File | Language | Role |
|---|---|---|
| `scripts/ml/personalization/__init__.py` | Python | Package marker |
| `scripts/ml/personalization/persona_models.py` | Python | `Persona` and `LatentPreferences` data classes |
| `scripts/ml/personalization/generate_personas.py` | Python | Define and validate 12 synthetic investor personas |
| `scripts/ml/personalization/simulate_actions.py` | Python | Generate synthetic action streams from latent preferences |
| `scripts/ml/personalization/preference_vector.py` | Python | Learn preference vectors from action streams only |
| `scripts/ml/personalization/personalize.py` | Python | Compute personalized rankings (global model stays dominant) |
| `scripts/ml/personalization/eval_personalization.py` | Python | Evaluate before/after metrics; write recommendation |

---

## 8. Committed vs generated files

```
data/synthetic-matching/
  startups.json          COMMITTED  — 35 synthetic startup profiles
  investors.json         COMMITTED  — 17 synthetic investor profiles
  README.md              COMMITTED  — dataset documentation

  pairs.json             GITIGNORED — generated by generate:synthetic-matches
  embeddings/
    .gitkeep             COMMITTED  — anchors directory in git
    startups.json        GITIGNORED — generated by embeddings:synthetic-matches
    investors.json       GITIGNORED — generated by embeddings:synthetic-matches
    _metadata.json       GITIGNORED — generated by embeddings:synthetic-matches
  artifacts/
    .gitkeep             COMMITTED  — anchors directory in git
    eval_report.md       GITIGNORED — generated by train:synthetic-matches
    confusion_matrix_*.  GITIGNORED — generated by train:synthetic-matches
    feature_importance_* GITIGNORED — generated by train:synthetic-matches
    predictions.csv      GITIGNORED — generated by train:synthetic-matches
    predictions_ineligible.csv  GITIGNORED — generated by train:synthetic-matches (Phase 10)
    predictions_all.csv  GITIGNORED — generated by train:synthetic-matches (eligible-train-full-eval mode only)
    eligibility_summary.json    GITIGNORED — generated by train:synthetic-matches (Phase 10)
    decision_tree.txt    GITIGNORED — generated by train:synthetic-matches
    semantic_*.          GITIGNORED — generated by analyze:synthetic-matches

    Phase 13 quality review artifacts (all GITIGNORED — generated by quality:synthetic-matches):
    quality/
      .gitkeep                     COMMITTED  — anchors directory
      quality_review.csv           GITIGNORED — one row per profile
      quality_review_summary.json  GITIGNORED — aggregate stats + timing
      quality_review_report.md     GITIGNORED — human-readable report

    Phase 12 personalization artifacts (all GITIGNORED — generated by prepare-personalization):
    synthetic_personas.json          GITIGNORED — generated by simulate-personas
    simulated_actions.csv            GITIGNORED — generated by simulate-personas
    persona_preference_vectors.json  GITIGNORED — generated by simulate-personas
    personalized_rankings.csv        GITIGNORED — generated by evaluate-personalization
    personalization_metrics.json     GITIGNORED — generated by evaluate-personalization
    personalization_report.md        GITIGNORED — generated by evaluate-personalization

scripts/ml/
  train_synthetic_matching.py    COMMITTED
  compute_embeddings.py          COMMITTED
  analyze_semantic_agreement.py  COMMITTED
  eligibility.py                 COMMITTED  — Phase 10: Python mirror of lib/matching/eligibility.ts
  requirements.txt               COMMITTED
  README.md                      COMMITTED
  .venv/                         GITIGNORED — install with pip install -r requirements.txt
```

---

## 8. Current dataset stats (Phase 10 final state)

| Property | Value |
|---|---|
| Synthetic startups | 35 (covering 20 distinct sector categories) |
| Synthetic investors | 17 (covering all archetypes: pre-seed, seed, Series A+, geographic, sector-specialist) |
| Total pairs | 595 (35 × 17) |
| Embedding model | sentence-transformers/all-MiniLM-L6-v2 (384-dim) |
| Semantic sim range | 0.017 – 0.629, mean 0.287 |

### Label distribution (calibrated, all target bands ✓)

| Label | Name | Count | % | Target |
|---|---|---|---|---|
| 0 | poor fit | 235 | 39.5% | 35–45% |
| 1 | weak fit | 140 | 23.5% | 20–30% |
| 2 | possible fit | 131 | 22.0% | 15–25% |
| 3 | strong fit | 53 | 8.9% | 8–15% |
| 4 | excellent fit | 36 | 6.1% | 3–8% |

### Eligibility breakdown (Phase 10)

| Property | Value |
|---|---|
| Eligible for model ranking | 260 / 595 (43.7%) |
| Ineligible | 335 / 595 (56.3%) |
| check_size_mismatch | 240 |
| anti_thesis_conflict | 142 |
| stage_mismatch | 24 |
| Pairs with 2+ reasons | 64 |
| Ineligible pairs with label ≥ 3 | **0** ✅ |

### Label distribution — eligible pairs only

| Label | Name | Count | % |
|---|---|---|---|
| 0 | poor fit | 35 | 13.5% |
| 1 | weak fit | 66 | 25.4% |
| 2 | possible fit | 70 | 26.9% |
| 3 | strong fit | 53 | 20.4% |
| 4 | excellent fit | 36 | 13.8% |

The eligible subset has a near-flat label distribution — a much better training signal than the skewed full-dataset distribution.

---

## 9. Phase 13 — Profile Quality Review

Phase 13 adds an offline rules-based quality review system that checks whether founder and investor profiles are usable, complete enough, non-spam, and internally coherent — **before** they would enter the discovery feed.

### 9.1 What profile quality review is — and is not

| Property | Value |
|---|---|
| **What it does** | Applies deterministic rules to each profile and emits a bot recommendation (`accept`, `needs_changes`, `decline`, `flag`) |
| **Relationship to pipeline** | Upstream of eligibility, global ranking, and personalization. A profile that doesn't pass quality review would never reach the matching layer. |
| **What it does NOT do** | Predict startup success, produce investment advice, auto-reject real users, or replace `lib/profile/completion.ts` |
| **Distinction from `completion.ts`** | `completion.ts` checks whether fields are filled in (quantity). Quality review checks whether the content is usable (quality — length, coherence, spam, realism). |
| **Dormant sibling** | `lib/matching/startupInvestorMatching.ts` contains older trust/spam scaffolding that is not imported by the product-facing matching path. Phase 13 leaves it untouched. Future cleanup can decide whether to deprecate or remove it separately. |
| **Production status** | **NOT wired to production in Phase 13.** The library exists; it is called only by the offline synthetic harness. Phase 14 will wire it into `app/build/actions.ts` so submitted profiles write a `bot_recommendation` row. |

### 9.2 Rule categories

Seven rule categories run in sequence.  Each returns an array of `QualityFlag` objects with a `severity`:

| Category | Checks | Severity range |
|---|---|---|
| **field-shape** | Presence, minimum length, test-data detection for core fields | block / suspect / warning / info |
| **length-thresholds** | Upper bounds on one_liner/thesis; depth-field minimums for problem/solution | warning / info |
| **format-safety** | HTML/script injection; URL format; excess URLs in pitch; burner email domain | block / suspect / warning |
| **buzzword-density** | Proportion of generic startup buzzwords in pitch/thesis text; substance heuristic | warning / suspect |
| **numeric-realism** | Stage-to-raise bands; investor check-size plausibility; implausibly wide ranges | warning |
| **cross-field-consistency** | one_liner ↔ problem/solution near-duplication; traction/stage tension; broad mandate with thin thesis | suspect / warning |
| **spam-patterns** | Lorem ipsum; repeated characters; test phrases in content fields; all-caps names | block / suspect |

### 9.3 Verdict mapping

| Verdict | Condition | Bot can set? | Human sign-off needed? |
|---|---|---|---|
| `accept` | No blocks, suspects, or ≥3 warnings | ✅ | No (accept is non-terminal) |
| `needs_changes` | 1+ suspect OR 3+ warnings | ✅ | No |
| `decline` | Any block flag | ✅ | Yes — terminal in production |
| `flag` | 2+ suspect flags | ✅ | Yes — terminal in production |
| `ban` | Reserved for abuse detection (Phase 15+) | ⚠️ Bot can recommend only | Yes — always human-only |

> The production database constraint `applications_terminal_requires_human` (in `db/migrations/0005_application_review.sql`) prevents any code from setting `status = 'rejected'` or `status = 'banned'` without a human reviewer's `decided_by` field.  The quality library is designed to work within this constraint.

### 9.4 Implementation files

| File | Language | Role |
|---|---|---|
| `lib/quality/types.ts` | TypeScript | `QualityFlag`, `ReviewResult`, `StartupQualityInput`, `InvestorQualityInput` |
| `lib/quality/ruleset-version.ts` | TypeScript | `RULESET_VERSION = "0.1.0"` — bumped on rule changes |
| `lib/quality/buzzwords.ts` | TypeScript | ~57-term curated buzzword stoplist |
| `lib/quality/rules/field-shape.ts` | TypeScript | Field presence and basic shape checks |
| `lib/quality/rules/length-thresholds.ts` | TypeScript | Text length upper/lower bounds |
| `lib/quality/rules/format-safety.ts` | TypeScript | HTML injection, URL format, burner email |
| `lib/quality/rules/buzzword-density.ts` | TypeScript | Buzzword density with substance heuristic |
| `lib/quality/rules/numeric-realism.ts` | TypeScript | Stage-to-raise bands; check-size plausibility |
| `lib/quality/rules/cross-field-consistency.ts` | TypeScript | Cross-field duplication and tension checks |
| `lib/quality/rules/spam-patterns.ts` | TypeScript | Spam, placeholder, keyboard-mash detection |
| `lib/quality/review.ts` | TypeScript | `reviewStartup()` / `reviewInvestor()` orchestrator |
| `scripts/quality/run_quality_review.ts` | TypeScript (tsx) | Offline synthetic harness |

Stage-to-raise bands used by numeric-realism (all warnings, not blocks):

| Stage | Typical range |
|---|---|
| `idea` | up to $2M |
| `pre_seed` | $50K – $3M |
| `seed` | $200K – $8M |
| `series_a` | $2M – $25M |
| `series_b_plus` | $5M – $200M |

### 9.5 Phase 13c synthetic harness results

| Property | Value |
|---|---|
| Profiles reviewed | 52 (35 startups + 17 investors) |
| accept | **52 (100%)** |
| needs_changes | 0 |
| decline | 0 |
| flag | 0 |
| ban | 0 |
| Top flag | `website_missing` × 35 (info — field absent in synthetic data) |
| Second flag | `raise_above_stage_band` × 3 (warning — 3 startups exceed typical band) |
| Average runtime | **0.3 ms per profile** |
| Maximum runtime | 3.5 ms per profile |
| Budget | < 50 ms per profile (no network calls) |

**Phase 13c calibration finding:** The first run discovered that `keyboard_mash_in_content` was firing on 28/35 synthetic startups.  Root cause: character-class regex patterns `[qwertyuiop]{6,}` matched common English words ("report", "prototype", "property", "router") because most top-row keyboard characters are common English letters.  The patterns were replaced with literal keyboard-mash sequences (`qwerty`, `asdfgh`, `zxcvbn`, `qazwsx`) that are extremely unlikely in legitimate text.  This is exactly the kind of false-positive discovery the offline harness is designed to catch before production wiring.

---

## 10. Known limitations

These are well-understood constraints. They do not block the lab's purpose but must be stated clearly for any future use.

### Data limitations

1. **Entirely synthetic profiles.** The model is recovering a deterministic labeling formula, not learning from real human judgment. All ~85–92% accuracy reflects this — it is a pipeline correctness check, not a real-world accuracy.

2. **`profile_completeness_score` has zero variance.** Every synthetic profile is intentionally fully filled in. This feature will gain variance once real users submit partial profiles. For now, the model assigns it zero importance and it provides no signal.

3. **`geography_score` has very low variance.** Most synthetic startups are US-based; most investors are US-focused. Mean geo score = 0.927. The 0.07 weight in the formula may overstate the real contribution of geography once diverse international profiles are added.

4. **Interest vocabulary mismatch.** Startup and investor `onboarding_interests` fields use different vocabularies (partly bridged by the synonym map in `INTEREST_SYNONYMS`). In real data, users will write free-text interests that may require a more comprehensive normalisation pass.

### Embedding limitations

5. **`all-MiniLM-L6-v2` is trained on general web text.** Synthetic profiles use marketing and startup-pitch language that is stylistically homogeneous. Real founders and investors write in much wider style ranges. The semantic similarity scores for real text may have a different distribution than 0.017–0.629.

6. **Low semantic score ≠ bad match.** 14 high-quality (strong/excellent) pairs have semantic similarity below 0.22, because structured mandate features align well even when vocabulary differs. Never use semantic similarity alone to filter out matches.

7. **Embedding staleness.** If `startups.json` or `investors.json` text changes and `compute_embeddings.py` is not re-run, `pairs.json` will carry stale `semantic_similarity_score` values. The metadata file records `n_startups`/`n_investors` for a quick count check.

### Model limitations

8. **The trained model learns synthetic labeling rules, not real investor behavior.** GBM accuracy of ~83% (full mode) / ~58% (eligible-only mode) means the model is recovering a deterministic formula. It has no knowledge of actual investment outcomes, real investor preferences, or real market dynamics.

9. **Class imbalance in small test buckets.** The 80/20 split on 260 eligible pairs produces approximately 7–14 samples per class in the test set. Per-class metrics for label-3/4 buckets are noisy and should not be cited as reliable performance figures.

10. **No temporal validation.** The dataset is static — all 595 pairs generated at one point in time. Real matching data has temporal structure (preferences change, markets shift) that the synthetic pipeline cannot model.

11. **Hard eligibility thresholds are synthetic policy proxies.** The three threshold values (0.5, 0, 0.25) encode reasonable mandate constraints for the synthetic profiles. They are not calibrated against real investor behavior. Threshold values should be validated when real profile data is available.

---

## 10. Recommended next real-development phase (post-launch)

When VentraMatch is live and users are creating real profiles:

### 10.1 Data collection

- Collect explicit interaction signals: like, pass, mutual match, intro request, intro accepted.
- Store them in `public.interactions` and `public.matches` (already in the production schema).
- Build a data consent and privacy-policy framework before using any interaction data for training.
- Tag the dataset with timestamps so temporal drift can be detected.

### 10.2 Feature validation

- Run `computeMatchFeatures` on real startup–investor profile pairs.
- Compare the real-data feature distribution to the synthetic baseline:
  - Does `profile_completeness_score` show variance? (It will — partial profiles are common.)
  - Does `geography_score` have more variance? (Likely — real users are internationally distributed.)
  - Does `semantic_similarity_score` have a similar range? (May be lower — real text is more diverse.)
- If distributions differ significantly, recalibrate feature weights and label thresholds on real data.

### 10.3 Model evaluation against real signals

- Use mutual match rate as the positive label (implicit feedback).
- Compute precision@k: of the top-k recommendations `scoreMatch` generates, how many result in a mutual match or intro?
- Compare `scoreMatch` precision@k to the experimental GBM model's precision@k.
- **Only promote the experimental model if it beats `scoreMatch` on precision@k with statistical significance.**

### 10.4 Production gating

- Run the experimental model behind a **feature flag** (`feature_flags` table already exists in migration `0034_feature_flags.sql`).
- A/B test: 10% of verified users on experimental model, 90% on `scoreMatch`.
- Monitor: mutual match rate, intro request rate, intro acceptance rate, pass rate.
- Keep `scoreMatch` as fallback until the experimental model is validated with ≥ 6 months of data.

### 10.5 Embedding update

- Replace `all-MiniLM-L6-v2` with a domain-fine-tuned model if real profile text shows poor separation.
- Consider computing embeddings at profile-submission time (Edge Function or background job) and storing them in a separate table.
- Add `semantic_similarity_score` to the live `scoreMatch` score only after real-data validation demonstrates it adds lift beyond structured features.

### 10.6 Hard eligibility validation

- Validate the three hard eligibility thresholds against real investor behavior.
- If real investor interactions show that some ineligible pairs (e.g., check-size mismatch = 0.20, just below 0.25) do result in mutual matches, consider threshold recalibration — but with evidence, not intuition.
- The gate must remain outside the model even when calibrated on real data. It is never a learned feature.

---

## 11. Do not do yet — hard stops

The following actions are explicitly prohibited until the post-launch validation described above is complete:

| Action | Why it is blocked |
|---|---|
| Deploy any trained model artifact from this lab | All models were trained on synthetic labels, not real user behavior |
| Remove the anti-thesis, stage, or check-size hard caps | These caps encode mandate constraints; without them the model can assign high labels to mandate violations |
| Remove or lower the hard eligibility gate thresholds | The gate is what prevents false promotion of ineligible pairs; Phase 10b showed 85 / 335 (25%) false promotions without it (DecisionTree) |
| **Treat hard eligibility as a learned ranking signal** | Hard eligibility encodes policy rules that must be applied unconditionally. If it enters the model as a feature, the model can partially override it through non-linear interactions — which defeats its purpose |
| **Allow semantic similarity to override eligibility** | A pair with sem=0.62 and anti_thesis_conflict=0.70 must remain ineligible regardless of text overlap. Semantic score can never promote a pair past the eligibility gate |
| **Allow personalization to override eligibility** | Personalization (Phase 11+) applies within the eligible set only. It must never receive an ineligible pair as a candidate |
| Market this pipeline as predicting investment outcomes | Labels measure profile-fit only; no investment or business outcome is predicted |
| Replace `scoreMatch` in the production feed | `scoreMatch` is the only baseline validated against the production profile schema |
| Use `pairs.json` or any labeled artifact as ground truth for a real recommendation system | Labels are rule-generated; they are not real investor preferences |
| Train on `pairs.json` using real user identifiers | All data is synthetic and fictional; mixing with real user data would corrupt both datasets |
| Claim the experimental model accuracy as a production quality metric | Eligible-only accuracy measures rule recovery on a balanced synthetic pool, not real-world relevance |
| Use traction fields from `startups.json` as evidence of real company performance | All traction data is fabricated; fields like `enterprise_contracts` are synthetic constructs |
| **Connect personalization to the production feed** | `personalize.py` and `eval_personalization.py` are offline scripts only. No personalization score may enter `lib/feed/query.ts` or any production route until real-data validation is complete |
| **Allow personalization to override hard eligibility** | The personalization layer must raise an error if an ineligible pair is about to be scored. It cannot change this behavior |
| **Treat synthetic persona behavior as real investor behavior** | Personas are fictional constructs; simulated actions are rule-generated from latent preferences, not real user choices |
| **Use personalization report as investment advice or startup quality ranking** | `personalization_report.md` and `personalization_metrics.json` are offline diagnostics only |
| **Read `latent_preferences` in personalize.py or eval_personalization.py** | Those scripts must learn from the action stream only; reading ground-truth preferences would make the evaluation circular and useless |
| **Wire `lib/quality/review.ts` into production before Phase 14** | The quality library needs an active human-reviewer workflow before it can gate real users; wiring it without that would silently block or bounce real founders |
| **Let the bot auto-accept or auto-reject real users without human review** | The production DB constraint requires human sign-off on terminal application statuses; bot recommendations are suggestions only |
| **Add LLM-assisted review in Phase 13** | LLM review adds variance, cost, and privacy complexity; it is reserved for Phase 15 after the rules engine is validated on real traffic |
| **Treat profile quality labels as investment quality labels** | A profile is "quality" if it is complete and internally coherent — this says nothing about the startup's chance of success or an investor's likelihood of closing deals |
| **Store full user text in `application_reviews.rule_results`** | Audit log entries should contain rule codes and summaries only, never full-content copies of pitch text or thesis, to keep the audit log compact and avoid duplicating PII |

---

## 12. Files in this lab (quick reference)

```
lib/matching/
  features.ts               Feature contract — SyntheticStartup, SyntheticInvestor,
                            MatchFeatures, computeMatchFeatures, cosineSimilarity
  eligibility.ts            Phase 10 — CANONICAL source of truth for hard eligibility
                            constants (HARD_ELIGIBILITY_THRESHOLDS), types
                            (HardFilterReason, EligibilityResult), and evaluateEligibility().
                            The Python mirror must stay in sync with this file.

data/synthetic-matching/
  README.md                 Dataset-level documentation
  startups.json             35 synthetic startup profiles
  investors.json            17 synthetic investor profiles

scripts/
  generate-synthetic-match-pairs.ts   Pair generation + labeling + eligibility fields (TypeScript / tsx)

scripts/ml/
  compute_embeddings.py          MiniLM embedding computation (Python)
  train_synthetic_matching.py    Model training + evaluation — default eligible-only mode (Python)
  analyze_semantic_agreement.py  Phase 8/10 semantic agreement analysis — eligibility-aware (Python)
  eligibility.py                 Phase 10 — Python mirror of lib/matching/eligibility.ts.
                                 Must stay in sync with the TypeScript source of truth.
  requirements.txt               Python dependencies
  README.md                      ML pipeline documentation

scripts/ml/personalization/
  __init__.py              Package marker
  persona_models.py        Persona + LatentPreferences data classes
  generate_personas.py     Define and validate 12 synthetic investor personas
  simulate_actions.py      Generate action streams from latent preferences
  preference_vector.py     Learn preference vectors from action streams (not latent prefs)
  personalize.py           Compute personalized rankings (global model stays dominant)
  eval_personalization.py  Evaluate before/after; write recommendation

lib/quality/
  types.ts                 Phase 13 — QualityFlag, ReviewResult, input types
  ruleset-version.ts       Phase 13 — RULESET_VERSION constant
  buzzwords.ts             Phase 13 — curated ~57-term buzzword stoplist
  review.ts                Phase 13 — reviewStartup() / reviewInvestor() orchestrator
  rules/
    field-shape.ts         Presence, length, test-data detection
    length-thresholds.ts   Text length upper/lower bounds
    format-safety.ts       HTML injection, URL format, burner email
    buzzword-density.ts    Buzzword density with substance heuristic
    numeric-realism.ts     Stage-to-raise bands; check-size plausibility
    cross-field-consistency.ts  Cross-field duplication and tension
    spam-patterns.ts       Spam, placeholder, keyboard-mash detection

scripts/quality/
  run_quality_review.ts    Phase 13c — offline synthetic quality review harness

docs/
  synthetic-matching-lab.md      This document (single source of truth for the lab)
```

---

*Last updated: Phase 13d complete. Profile quality review system added (Phases 13a–13c). 52/52 synthetic profiles accepted on first calibrated run. 0.3 ms average runtime per profile. Phase 13c caught and fixed a keyboard-mash false-positive regex — this is the intended offline-validation workflow before production wiring (Phase 14). Hard eligibility gate and quality review are now both upstream of matching.*

*Phase 12c: Synthetic personalization simulator closed out. Recommendation: PROCEED_TO_PERSONALIZATION_REFINEMENT.*

*Phase 11c: LogReg C=2.0 confirmed as offline global model champion via 5-seed OOF, calibration metrics (ECE@10=0.064), and false-promotion safety check (4/335). `champion_candidate.json` is the machine-readable handoff to Phase 12.*

*Phase 10: Hard eligibility layer added. Default training mode is `eligible-only`. Semantic analysis confirmed gate and caps are consistent — no ineligible pair carries label ≥ 3. KEEP FORMULA UNCHANGED recommendation unchanged from Phase 8.*
