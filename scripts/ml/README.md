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

# Step 2: regenerate pairs.json with semantic_similarity_score filled in
npm run generate:synthetic-matches

# Step 3: train models and produce artifacts
npm run train:synthetic-matches

# — OR — all three in one command
npm run prepare:synthetic-matches
```

### Individual scripts

```bash
# Compute embeddings only
python3 scripts/ml/compute_embeddings.py

# Train only (requires pairs.json; semantic_similarity_score will be null if
# compute_embeddings.py has not been run, but training still works)
python3 scripts/ml/train_synthetic_matching.py
python3 scripts/ml/train_synthetic_matching.py --validate-only
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
| `eval_report.md` | Full human-readable report with all metrics, feature importance interpretation, and caveats |
| `confusion_matrix_gbm.png` | 5×5 heatmap (count + row-%) for GBM |
| `confusion_matrix_gbm.csv` | Same as PNG, machine-readable |
| `confusion_matrix_logreg.png` | Confusion matrix for Logistic Regression |
| `confusion_matrix_logreg.csv` | CSV version |
| `confusion_matrix_decisiontree.png` | Confusion matrix for Decision Tree |
| `confusion_matrix_decisiontree.csv` | CSV version |
| `feature_importance_gbm.png` | GBM native feature importances vs labeling formula weights |
| `feature_importance_logreg.png` | LogReg mean \|coefficient\| vs labeling formula weights |
| `feature_importance_decisiontree.png` | Decision tree importances |
| `predictions.csv` | Per-pair predictions from all 3 models + GBM probabilities for manual review |
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
  train_synthetic_matching.py   Main training/evaluation pipeline
  requirements.txt              Python dependencies (including sentence-transformers)
  README.md                     This file
  .venv/                        Local virtualenv (gitignored, ~900 MB with torch)
```

Do not commit `.venv/` or any generated `__pycache__/` directories.
