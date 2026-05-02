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
| `data/synthetic-matching/pairs.json` | 595 labeled startup–investor pairs | **Gitignored** — generated |
| `data/synthetic-matching/embeddings/` | Pre-computed MiniLM text embeddings | **Gitignored** — generated |
| `data/synthetic-matching/artifacts/` | Training reports, confusion matrices, plots | **Gitignored** — generated |

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

**`semantic_similarity_score` has zero weight in the labeling formula.** Labels are derived entirely from the 11 structured features. This is a deliberate design decision — see Section 5.

### Step 4 — Model training (`scripts/ml/train_synthetic_matching.py`)

Trains three classifiers on 595 pairs (stratified 80/20 split + 5-fold CV):

| Model | Phase 7 Accuracy | Phase 7 Macro-F1 |
|---|---|---|
| LogReg + StandardScaler | 87.4% | 82.2% |
| GradientBoostingClassifier | 83.2% | 82.3% |
| DecisionTreeClassifier (depth 6) | 79.0% | 66.0% |

High accuracy (~84–92%) is **expected and not meaningful** — the models are recovering a deterministic labeling formula. This is a pipeline correctness sanity check, not evidence of real-world matching ability.

The GBM ranks `semantic_similarity_score` **4th in feature importance (0.103)** despite its zero labeling weight, confirming the embedding carries genuine signal. All errors are adjacent-class (off-by-1 ordinal step) with zero critical false positives (no poor/weak pair predicted as strong/excellent).

Produces 12 artifacts in `data/synthetic-matching/artifacts/`:
- Confusion matrices (PNG + CSV) for each model
- Feature importance charts (PNG) for each model
- `predictions.csv` — per-pair predictions from all models
- `decision_tree.txt` — readable if-then rule set
- `eval_report.md` — comprehensive metrics report

### Step 5 — Semantic agreement analysis (`scripts/ml/analyze_semantic_agreement.py`)

Phase 8 analysis that answers: should `semantic_similarity_score` enter the labeling formula?

Produces:
- `semantic_scatter.png` — scatter plot: semantic similarity vs label (regression line overlaid)
- `semantic_disagreements.csv` — high-sem/low-label, low-sem/high-label, and would-change pairs
- `semantic_analysis_report.md` — full findings with a clear `RECOMMEND: KEEP / APPLY` decision

---

## 4. Command reference

### Step-by-step

```bash
# From the repo root

# Step 1: compute local text embeddings (~5–10 s after first-run download)
npm run embeddings:synthetic-matches

# Step 2: generate 595 labeled pairs (< 1 s; includes semantic_similarity_score)
npm run generate:synthetic-matches

# Step 3: train models + produce evaluation artifacts (~15 s)
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
# Train: validate data only, skip model training
python3 scripts/ml/train_synthetic_matching.py --validate-only

# Analyze: skip the model retraining step (faster, no Phase 7/8 comparison)
python3 scripts/ml/analyze_semantic_agreement.py --skip-retrain

# Custom output directory for artifacts
python3 scripts/ml/train_synthetic_matching.py --output-dir /tmp/my-run
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

**For future real-data sprints:** the weight should remain 0 in the labeling formula and instead be evaluated as a post-launch signal through A/B testing. If real-world interaction data shows that semantic similarity correlates with mutual match rate (independent of the structured features), then a small additive bonus can be introduced with evidence.

---

## 6. Committed vs generated files

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
    decision_tree.txt    GITIGNORED — generated by train:synthetic-matches
    semantic_*.          GITIGNORED — generated by analyze:synthetic-matches

scripts/ml/
  train_synthetic_matching.py    COMMITTED
  compute_embeddings.py          COMMITTED
  analyze_semantic_agreement.py  COMMITTED
  requirements.txt               COMMITTED
  README.md                      COMMITTED
  .venv/                         GITIGNORED — install with pip install -r requirements.txt
```

---

## 7. Current dataset stats (Phase 8 final state)

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

---

## 8. Known limitations

These are well-understood constraints. They do not block the lab's purpose but must be stated clearly for any future use.

### Data limitations

1. **Entirely synthetic profiles.** The model is recovering a deterministic labeling formula, not learning from real human judgment. All ~92% accuracy reflects this — it is a pipeline correctness check, not a real-world accuracy.

2. **`profile_completeness_score` has zero variance.** Every synthetic profile is intentionally fully filled in. This feature will gain variance once real users submit partial profiles. For now, the model assigns it zero importance and it provides no signal.

3. **`geography_score` has very low variance.** Most synthetic startups are US-based; most investors are US-focused. Mean geo score = 0.927. The 0.07 weight in the formula may overstate the real contribution of geography once diverse international profiles are added.

4. **Interest vocabulary mismatch.** Startup and investor `onboarding_interests` fields use different vocabularies (partly bridged by the synonym map in `INTEREST_SYNONYMS`). In real data, users will write free-text interests that may require a more comprehensive normalisation pass.

### Embedding limitations

5. **`all-MiniLM-L6-v2` is trained on general web text.** Synthetic profiles use marketing and startup-pitch language that is stylistically homogeneous. Real founders and investors write in much wider style ranges. The semantic similarity scores for real text may have a different distribution than 0.017–0.629.

6. **Low semantic score ≠ bad match.** 14 high-quality (strong/excellent) pairs have semantic similarity below 0.22, because structured mandate features align well even when vocabulary differs. Never use semantic similarity alone to filter out matches.

7. **Embedding staleness.** If `startups.json` or `investors.json` text changes and `compute_embeddings.py` is not re-run, `pairs.json` will carry stale `semantic_similarity_score` values. The metadata file records `n_startups`/`n_investors` for a quick count check.

### Model limitations

8. **The trained model learns synthetic labeling rules, not real investor behavior.** GBM accuracy of 83% means the model is 83% accurate at recovering a deterministic formula. It has no knowledge of actual investment outcomes, real investor preferences, or real market dynamics.

9. **Class imbalance in small test buckets.** The 80/20 split produces ~7 excellent-fit and ~11 strong-fit test samples. Per-class metrics for these buckets are noisy and should not be cited as reliable performance figures.

10. **No temporal validation.** The dataset is static — all 595 pairs generated at one point in time. Real matching data has temporal structure (preferences change, markets shift) that the synthetic pipeline cannot model.

---

## 9. Recommended next real-development phase (post-launch)

When VentraMatch is live and users are creating real profiles:

### 9.1 Data collection

- Collect explicit interaction signals: like, pass, mutual match, intro request, intro accepted.
- Store them in `public.interactions` and `public.matches` (already in the production schema).
- Build a data consent and privacy-policy framework before using any interaction data for training.
- Tag the dataset with timestamps so temporal drift can be detected.

### 9.2 Feature validation

- Run `computeMatchFeatures` on real startup–investor profile pairs.
- Compare the real-data feature distribution to the synthetic baseline:
  - Does `profile_completeness_score` show variance? (It will — partial profiles are common.)
  - Does `geography_score` have more variance? (Likely — real users are internationally distributed.)
  - Does `semantic_similarity_score` have a similar range? (May be lower — real text is more diverse.)
- If distributions differ significantly, recalibrate feature weights and label thresholds on real data.

### 9.3 Model evaluation against real signals

- Use mutual match rate as the positive label (implicit feedback).
- Compute precision@k: of the top-k recommendations `scoreMatch` generates, how many result in a mutual match or intro?
- Compare `scoreMatch` precision@k to the experimental GBM model's precision@k.
- **Only promote the experimental model if it beats `scoreMatch` on precision@k with statistical significance.**

### 9.4 Production gating

- Run the experimental model behind a **feature flag** (`feature_flags` table already exists in migration `0034_feature_flags.sql`).
- A/B test: 10% of verified users on experimental model, 90% on `scoreMatch`.
- Monitor: mutual match rate, intro request rate, intro acceptance rate, pass rate.
- Keep `scoreMatch` as fallback until the experimental model is validated with ≥ 6 months of data.

### 9.5 Embedding update

- Replace `all-MiniLM-L6-v2` with a domain-fine-tuned model if real profile text shows poor separation.
- Consider computing embeddings at profile-submission time (Edge Function or background job) and storing them in a separate table.
- Add `semantic_similarity_score` to the live `scoreMatch` score only after real-data validation demonstrates it adds lift beyond structured features.

---

## 10. Do not do yet — hard stops

The following actions are explicitly prohibited until the post-launch validation described above is complete:

| Action | Why it is blocked |
|---|---|
| Deploy any trained model artifact from this lab | All models were trained on synthetic labels, not real user behavior |
| Remove the anti-thesis, stage, or check-size hard caps | These caps encode mandate constraints; without them the model can assign high labels to mandate violations |
| Market this pipeline as predicting investment outcomes | Labels measure profile-fit only; no investment or business outcome is predicted |
| Replace `scoreMatch` in the production feed | `scoreMatch` is the only baseline validated against the production profile schema |
| Use `pairs.json` or any labeled artifact as ground truth for a real recommendation system | Labels are rule-generated; they are not real investor preferences |
| Train on `pairs.json` using real user identifiers | All data is synthetic and fictional; mixing with real user data would corrupt both datasets |
| Claim the experimental GBM model accuracy (~83–92%) as a production quality metric | That accuracy measures rule recovery, not real-world relevance |
| Use traction fields from `startups.json` as evidence of real company performance | All traction data is fabricated; fields like `enterprise_contracts` are synthetic constructs |

---

## 11. Files in this lab (quick reference)

```
lib/matching/
  features.ts               Feature contract — SyntheticStartup, SyntheticInvestor,
                            MatchFeatures, computeMatchFeatures, cosineSimilarity

data/synthetic-matching/
  README.md                 Dataset-level documentation
  startups.json             35 synthetic startup profiles
  investors.json            17 synthetic investor profiles

scripts/
  generate-synthetic-match-pairs.ts   Pair generation + labeling (TypeScript / tsx)

scripts/ml/
  compute_embeddings.py          MiniLM embedding computation (Python)
  train_synthetic_matching.py    Model training + evaluation (Python)
  analyze_semantic_agreement.py  Phase 8 semantic agreement analysis (Python)
  requirements.txt               Python dependencies
  README.md                      ML pipeline documentation

docs/
  synthetic-matching-lab.md      This document (single source of truth for the lab)
```

---

*Last updated: Phase 8 complete. Semantic analysis confirmed that `semantic_similarity_score` should remain at weight 0 in the labeling formula. The GBM model uses it as a 4th-ranked feature (importance 0.103) without it being in the labels.*

*Next: post-launch real-data collection and comparative validation against `scoreMatch`.*
