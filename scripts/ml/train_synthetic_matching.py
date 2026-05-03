#!/usr/bin/env python3
"""
scripts/ml/train_synthetic_matching.py

SYNTHETIC EXPERIMENTAL MATCHING MODEL PIPELINE
───────────────────────────────────────────────
NOTICE: This script is for algorithm development only.

  • All input data (pairs.json) is SYNTHETIC. No real user data is used.
  • This model is NOT investment advice.
  • This model does NOT predict startup success or investment returns.
  • Labels (0–4) are rule-generated profile-fit categories, not real outcomes.
  • The model is learning the synthetic labeling rules in
    scripts/generate-synthetic-match-pairs.ts — NOT real investor behaviour.
  • No model artifact produced here should be deployed to production
    without separate validation on real post-launch interaction data.
  • scoreMatch in lib/matching/score.ts remains the safe production baseline.

Phase 10 changes (hard eligibility layer):
  • Default training mode is now "eligible-only" (was implicitly "full" in
    Phases 7–9).  Use --training-mode full to reproduce pre-Phase-10 runs.
  • A hard eligibility gate (lib/matching/eligibility.ts / scripts/ml/
    eligibility.py) separates pairs eligible for model ranking from those
    blocked by hard mandate constraints.  Ineligible pairs are used as a
    safety diagnostic — not as training examples.
  • New artifacts: eligibility_summary.json, predictions_ineligible.csv.
  • predictions.csv now includes eligible_for_model_ranking and
    hard_filter_reasons columns.

Usage (run from repo root):
    python3 scripts/ml/train_synthetic_matching.py
    python3 scripts/ml/train_synthetic_matching.py --validate-only
    python3 scripts/ml/train_synthetic_matching.py --training-mode full
    python3 scripts/ml/train_synthetic_matching.py --training-mode eligible-train-full-eval
    python3 scripts/ml/train_synthetic_matching.py --output-dir /custom/path

See scripts/ml/README.md for setup instructions.

Requires Python 3.9+  (uses `from __future__ import annotations` for 3.10-style type hints)
"""

from __future__ import annotations

import argparse
import json
import sys
import warnings
from datetime import datetime
from pathlib import Path
from typing import Any

# ── Phase 10: import eligibility mirror (same directory) ──────────────────────
# eligibility.py mirrors lib/matching/eligibility.ts. It is imported via a
# sys.path insert so this script works regardless of working directory.
_ML_DIR = Path(__file__).resolve().parent
if str(_ML_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_DIR))

try:
    from eligibility import evaluate_eligibility as _evaluate_eligibility
    from eligibility import ANTI_THESIS_MAX, STAGE_MIN, CHECK_SIZE_MIN
    _ELIGIBILITY_AVAILABLE = True
except ImportError:
    _ELIGIBILITY_AVAILABLE = False
    _evaluate_eligibility = None  # type: ignore[assignment]
    ANTI_THESIS_MAX = STAGE_MIN = CHECK_SIZE_MIN = None  # type: ignore[assignment]

# ── Dependency guard ──────────────────────────────────────────────────────────

_MISSING: list[str] = []

try:
    import numpy as np
except ImportError:
    _MISSING.append("numpy")
    np = None  # type: ignore[assignment]

try:
    import pandas as pd
except ImportError:
    _MISSING.append("pandas")
    pd = None  # type: ignore[assignment]

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
except ImportError:
    _MISSING.append("matplotlib")
    plt = None  # type: ignore[assignment]

try:
    import seaborn as sns
except ImportError:
    _MISSING.append("seaborn")
    sns = None  # type: ignore[assignment]

try:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (
        accuracy_score,
        classification_report,
        confusion_matrix,
        f1_score,
        mean_absolute_error,
    )
    from sklearn.model_selection import (
        StratifiedKFold,
        cross_validate,
        train_test_split,
    )
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.tree import DecisionTreeClassifier, export_text
except ImportError:
    _MISSING.append("scikit-learn")

if _MISSING:
    print("ERROR: Missing Python dependencies:", ", ".join(_MISSING))
    print()
    print("Install with:")
    print("  cd scripts/ml")
    print("  python3 -m venv .venv")
    print("  source .venv/bin/activate    # macOS / Linux")
    print("  .venv\\Scripts\\activate       # Windows")
    print("  pip install -r requirements.txt")
    sys.exit(1)

# ── Constants ─────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PAIRS_PATH = REPO_ROOT / "data" / "synthetic-matching" / "pairs.json"
DEFAULT_ARTIFACTS_DIR = REPO_ROOT / "data" / "synthetic-matching" / "artifacts"

LABEL_NAMES = ["poor fit", "weak fit", "possible fit", "strong fit", "excellent fit"]

FEATURE_COLS: list[str] = [
    "sector_overlap_score",
    "stage_match_score",
    "check_size_score",
    "geography_score",
    "interest_overlap_score",
    "anti_thesis_conflict_score",
    "customer_type_overlap_score",
    "business_model_overlap_score",
    "lead_follow_score",
    "traction_strength_score",
    "profile_completeness_score",
    "semantic_similarity_score",
]

LABELING_WEIGHTS: dict[str, float] = {
    "sector_overlap_score": 0.20,
    "stage_match_score": 0.18,
    "check_size_score": 0.15,
    "interest_overlap_score": 0.12,
    "customer_type_overlap_score": 0.10,
    "business_model_overlap_score": 0.08,
    "geography_score": 0.07,
    "lead_follow_score": 0.05,
    "traction_strength_score": 0.05,
    "anti_thesis_conflict_score": 0.40,
    "profile_completeness_score": 0.00,
    "semantic_similarity_score": 0.00,
}

RANDOM_SEED = 42

# Phase 11c: multi-seed model selection constants.
MULTISEED_SEEDS: list[int] = [42, 7, 19, 51, 73]
LOGREG_C_GRID: list[float] = [0.5, 1.0, 2.0]

# ── Argument parsing ──────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Train an experimental matching model on synthetic pairs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="SYNTHETIC DATA ONLY — NOT investment advice.",
    )
    p.add_argument(
        "--validate-only",
        action="store_true",
        help="Load and validate data only; skip training.",
    )
    p.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_ARTIFACTS_DIR,
        help=f"Directory for output artifacts (default: {DEFAULT_ARTIFACTS_DIR})",
    )
    p.add_argument(
        "--multiseed",
        action="store_true",
        help=(
            "Run multi-seed OOF for LogReg C-grid + reference models (Phase 11c). "
            "Requires --training-mode eligible-only (default). Adds ~30 s to the run."
        ),
    )
    p.add_argument(
        "--training-mode",
        choices=["eligible-only", "full", "eligible-train-full-eval"],
        default="eligible-only",
        help=(
            "eligible-only (default, Phase 10+): train and evaluate on eligible pairs only; "
            "apply models to ineligible pairs as a safety diagnostic. "
            "full: legacy behavior — train and evaluate on all 595 pairs. "
            "eligible-train-full-eval: train on eligible pairs, primary eval on eligible "
            "test split, plus full-dataset prediction export."
        ),
    )
    return p.parse_args()


# ── Data loading & validation ─────────────────────────────────────────────────


def load_and_validate(path: Path) -> "pd.DataFrame":
    """Load pairs.json, validate schema, load eligibility fields, return DataFrame.

    Phase 10 additions:
      - Loads eligible_for_model_ranking and hard_filter_reasons from each pair.
      - If those fields are missing (pre-Phase-10 pairs.json), recomputes them
        from features using eligibility.py and prints a back-compat warning.
      - Validates that stored eligibility is consistent with recomputed values.
    """
    if not path.exists():
        print(f"ERROR: {path} not found.")
        print("Run:  npm run generate:synthetic-matches")
        sys.exit(1)

    with path.open(encoding="utf-8") as fh:
        pairs: list[dict[str, Any]] = json.load(fh)

    if not pairs:
        print("ERROR: pairs.json is empty.")
        sys.exit(1)

    required_keys = {"startup_id", "investor_id", "features", "label", "label_name"}
    missing_top = required_keys - set(pairs[0].keys())
    if missing_top:
        print(f"ERROR: pairs.json records missing keys: {missing_top}")
        sys.exit(1)

    missing_feat = set(FEATURE_COLS) - set(pairs[0]["features"].keys())
    if missing_feat:
        print(f"ERROR: feature fields missing from pairs.json: {missing_feat}")
        sys.exit(1)

    # Detect whether pairs.json has Phase 10 eligibility fields.
    has_eligibility_fields = (
        "eligible_for_model_ranking" in pairs[0]
        and "hard_filter_reasons" in pairs[0]
    )
    if not has_eligibility_fields:
        if _ELIGIBILITY_AVAILABLE:
            print(
                "  ⚠  pairs.json is pre-Phase-10; recomputing eligibility from features.\n"
                "     Run: npm run generate:synthetic-matches  to persist eligibility fields.\n"
            )
        else:
            print(
                "  ⚠  pairs.json is pre-Phase-10 AND eligibility.py not found.\n"
                "     Cannot recompute eligibility — all pairs treated as eligible (conservative).\n"
                "     Run: npm run generate:synthetic-matches  and ensure eligibility.py exists.\n"
            )

    rows: list[dict[str, Any]] = []
    n_sem_null = 0
    n_elig_recomputed = 0
    n_elig_mismatch = 0

    for p in pairs:
        row: dict[str, Any] = {
            "startup_id": p["startup_id"],
            "investor_id": p["investor_id"],
            "label": int(p["label"]),
            "label_name": p["label_name"],
            "label_reason": p.get("label_reason", ""),
        }
        for col in FEATURE_COLS:
            val = p["features"].get(col)
            if val is None:
                row[col] = 0.0
                if col == "semantic_similarity_score":
                    n_sem_null += 1
            else:
                row[col] = float(val)

        # ── Eligibility (Phase 10) ────────────────────────────────────────────
        feat_dict = {col: row[col] for col in FEATURE_COLS}

        if has_eligibility_fields:
            stored_eligible = bool(p["eligible_for_model_ranking"])
            stored_reasons: list[str] = list(p["hard_filter_reasons"])
            row["eligible_for_model_ranking"] = stored_eligible
            row["hard_filter_reasons"] = stored_reasons

            # Validate against recomputed values when eligibility.py is available.
            if _ELIGIBILITY_AVAILABLE:
                recomputed = _evaluate_eligibility(feat_dict)
                if recomputed["eligible_for_model_ranking"] != stored_eligible:
                    n_elig_mismatch += 1
        else:
            # Back-compat: recompute from features.
            if _ELIGIBILITY_AVAILABLE:
                recomputed = _evaluate_eligibility(feat_dict)
                row["eligible_for_model_ranking"] = recomputed["eligible_for_model_ranking"]
                row["hard_filter_reasons"] = recomputed["hard_filter_reasons"]
                n_elig_recomputed += 1
            else:
                # Conservative fallback: assume eligible.
                row["eligible_for_model_ranking"] = True
                row["hard_filter_reasons"] = []

        rows.append(row)

    df = pd.DataFrame(rows)

    # ── Reporting ─────────────────────────────────────────────────────────────
    if n_sem_null > 0:
        pct = n_sem_null / len(rows) * 100
        if n_sem_null == len(rows):
            print(
                f"  ⚠  semantic_similarity_score: all {n_sem_null} values are null (imputed 0.0).\n"
                "     Run: npm run embeddings:synthetic-matches  to compute embeddings first.\n"
            )
        else:
            print(
                f"  ⚠  semantic_similarity_score: {n_sem_null}/{len(rows)} ({pct:.1f}%) null "
                "values imputed to 0.0.\n"
            )
    else:
        print(
            f"  ✓  semantic_similarity_score: all {len(rows)} values present.\n"
        )

    if n_elig_recomputed > 0:
        print(f"  ⚠  Eligibility recomputed for {n_elig_recomputed} pairs (pre-Phase-10 data).\n")

    if n_elig_mismatch > 0:
        print(
            f"  ⚠  {n_elig_mismatch} pairs: stored eligibility differs from recomputed values.\n"
            "     Regenerate pairs.json with: npm run generate:synthetic-matches\n"
        )
    elif has_eligibility_fields and _ELIGIBILITY_AVAILABLE:
        print(
            f"  ✓  Eligibility consistency: stored values match recomputed values for all "
            f"{len(rows)} pairs.\n"
        )

    return df


# ── Dataset statistics ─────────────────────────────────────────────────────────


def print_dataset_stats(df: "pd.DataFrame") -> None:
    n = len(df)
    print(f"\n{'─' * 72}")
    print("DATASET STATISTICS  (full dataset)")
    print(f"{'─' * 72}")
    print(f"  Total pairs : {n}")
    print(f"  Features    : {len(FEATURE_COLS)} numeric")
    print()
    print("  Label distribution (all pairs):")
    for i, name in enumerate(LABEL_NAMES):
        count = int((df["label"] == i).sum())
        pct = count / n * 100
        bar = "█" * max(1, round(pct / 2))
        print(f"    {i}  {name:<14}  {count:3d}  ({pct:5.1f}%)  {bar}")
    print()
    print("  Feature ranges (min / mean / max):")
    for col in FEATURE_COLS:
        mn = df[col].min()
        mu = df[col].mean()
        mx = df[col].max()
        print(f"    {col:<38}  {mn:+.3f} / {mu:+.3f} / {mx:+.3f}")
    print(f"{'─' * 72}\n")


# ── Eligibility summary ────────────────────────────────────────────────────────


def print_eligibility_summary(df: "pd.DataFrame") -> None:
    """Print the Phase 10 hard eligibility summary for the full dataset."""
    n = len(df)
    n_eligible = int(df["eligible_for_model_ranking"].sum())
    n_ineligible = n - n_eligible

    reason_counts: dict[str, int] = {
        "anti_thesis_conflict": 0,
        "stage_mismatch": 0,
        "check_size_mismatch": 0,
    }
    multi_reason_count = 0
    for reasons in df[~df["eligible_for_model_ranking"]]["hard_filter_reasons"]:
        for r in reasons:
            if r in reason_counts:
                reason_counts[r] += 1
        if len(reasons) > 1:
            multi_reason_count += 1

    print(f"{'─' * 72}")
    print("HARD ELIGIBILITY SUMMARY  (Phase 10)")
    print(f"{'─' * 72}")
    print(f"  Total pairs                : {n}")
    print(f"  Eligible for model ranking : {n_eligible} ({n_eligible / n * 100:.1f}%)")
    print(f"  Ineligible                 : {n_ineligible} ({n_ineligible / n * 100:.1f}%)")
    print()
    print("  Hard filter reason counts (pairs may carry multiple reasons):")
    print(f"    anti_thesis_conflict  : {reason_counts['anti_thesis_conflict']}")
    print(f"    stage_mismatch        : {reason_counts['stage_mismatch']}")
    print(f"    check_size_mismatch   : {reason_counts['check_size_mismatch']}")
    print(f"    pairs with 2+ reasons : {multi_reason_count}")
    print()
    print("  Label distribution — eligible pairs:")
    df_el = df[df["eligible_for_model_ranking"]]
    n_el = max(1, len(df_el))
    for i, name in enumerate(LABEL_NAMES):
        count = int((df_el["label"] == i).sum())
        pct = count / n_el * 100
        bar = "█" * max(1, round(pct / 2))
        print(f"    {i}  {name:<14}  {count:3d}  ({pct:5.1f}%)  {bar}")
    print()
    print("  Label distribution — ineligible pairs:")
    df_in = df[~df["eligible_for_model_ranking"]]
    n_in = max(1, len(df_in))
    fp_total = 0
    for i, name in enumerate(LABEL_NAMES):
        count = int((df_in["label"] == i).sum())
        pct = count / n_in * 100
        bar = "█" * max(1, round(pct / 2))
        flag = "  ⚠  FALSE-PROMOTION RISK" if i >= 3 and count > 0 else ""
        if i >= 3:
            fp_total += count
        print(f"    {i}  {name:<14}  {count:3d}  ({pct:5.1f}%)  {bar}{flag}")
    if fp_total == 0:
        print("\n  ✓  No ineligible pair has label ≥ 3. Gate and label caps are consistent.")
    else:
        print(
            f"\n  ⚠  {fp_total} ineligible pair(s) carry label ≥ 3. "
            "These would be false promotions without the eligibility gate."
        )
    print(f"{'─' * 72}\n")


# ── Models ────────────────────────────────────────────────────────────────────


def get_models() -> dict[str, Any]:
    return {
        "LogReg": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(
                max_iter=1000,
                solver="lbfgs",
                C=1.0,
                random_state=RANDOM_SEED,
            )),
        ]),
        "GBM": GradientBoostingClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            subsample=0.9,
            random_state=RANDOM_SEED,
        ),
        "DecisionTree": DecisionTreeClassifier(
            max_depth=6,
            random_state=RANDOM_SEED,
        ),
    }


# ── Multi-seed model variants ─────────────────────────────────────────────────


def get_multiseed_models(
    logreg_c_values: list[float] = LOGREG_C_GRID,
) -> dict[str, Any]:
    """Return model variants for multi-seed OOF evaluation (Phase 11c).

    Includes one LogReg per C value and reference GBM + DecisionTree.
    Each call returns fresh untrained instances.
    """
    models: dict[str, Any] = {}
    for c_val in logreg_c_values:
        models[f"logreg_c{c_val}"] = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(
                max_iter=1000, solver="lbfgs", C=c_val, random_state=RANDOM_SEED,
            )),
        ])
    models["gbm"] = GradientBoostingClassifier(
        n_estimators=200, max_depth=5, learning_rate=0.1,
        subsample=0.9, random_state=RANDOM_SEED,
    )
    models["decisiontree"] = DecisionTreeClassifier(
        max_depth=6, random_state=RANDOM_SEED,
    )
    return models


# ── Cross-validation ──────────────────────────────────────────────────────────


def run_cross_validation(
    models: dict[str, Any],
    X: "np.ndarray",
    y: "np.ndarray",
    max_folds: int = 5,
) -> tuple[dict[str, dict[str, "np.ndarray"]] | None, int]:
    """Stratified CV with automatic fold reduction if any class has too few samples.

    Returns (results_dict, n_folds_used).  Results are None if CV is skipped.
    """
    label_counts = pd.Series(y).value_counts()
    min_class_count = int(label_counts.min())
    n_splits = min(max_folds, min_class_count)

    if n_splits < 2:
        print(
            f"  ⚠  Too few samples per class for CV "
            f"(min class count: {min_class_count}). Skipping CV.\n"
        )
        return None, 0

    if n_splits < max_folds:
        print(
            f"  ℹ  CV folds reduced from {max_folds} to {n_splits} "
            f"(min class count in training set: {min_class_count}).\n"
        )

    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_SEED)
    scoring = ["accuracy", "f1_macro", "f1_weighted"]

    results: dict[str, dict[str, "np.ndarray"]] = {}
    for name, model in models.items():
        try:
            scores = cross_validate(model, X, y, cv=cv, scoring=scoring, n_jobs=-1)
        except Exception:
            scores = cross_validate(model, X, y, cv=cv, scoring=scoring, n_jobs=1)

        acc = scores["test_accuracy"]
        f1m = scores["test_f1_macro"]
        f1w = scores["test_f1_weighted"]
        results[name] = {"accuracy": acc, "f1_macro": f1m, "f1_weighted": f1w}

        print(
            f"  {name:<14}  "
            f"accuracy {acc.mean():.4f}±{acc.std():.4f}  "
            f"macro-F1 {f1m.mean():.4f}±{f1m.std():.4f}"
        )

    return results, n_splits


# ── Out-of-fold prediction generation ────────────────────────────────────────


def generate_oof_predictions(
    df_eligible: "pd.DataFrame",
    feature_cols: list[str],
    n_splits_max: int = 5,
    random_seed: int = RANDOM_SEED,
) -> tuple["pd.DataFrame", int]:
    """Generate out-of-fold (OOF) predictions for all eligible pairs.

    Each pair's prediction comes from a StratifiedKFold fold where it was
    excluded from training — so every prediction is leakage-free.

    Returns (oof_df, n_folds_used).  oof_df has the same column schema as
    predictions_eligible_all.csv so eval_ranking.py can load it unchanged.
    Returns (empty DataFrame, 0) if OOF cannot be generated.
    """
    X = df_eligible[feature_cols].values.astype(float)
    y = df_eligible["label"].values.astype(int)

    min_class_count = int(pd.Series(y).value_counts().min())
    n_splits = min(n_splits_max, min_class_count)

    if n_splits < 2:
        print(
            f"  ⚠  Min class count {min_class_count} too small for OOF. Skipping.\n"
        )
        return pd.DataFrame(), 0

    if n_splits < n_splits_max:
        print(
            f"  ℹ  OOF folds reduced from {n_splits_max} to {n_splits} "
            f"(min class count: {min_class_count}).\n"
        )

    print(f"  Running {n_splits}-fold stratified OOF for {len(df_eligible)} eligible pairs …\n")

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_seed)
    n = len(df_eligible)

    model_keys = ["logreg", "gbm", "decisiontree"]
    oof_pred: dict[str, "np.ndarray"] = {k: np.full(n, -1, dtype=int) for k in model_keys}
    oof_proba: dict[str, "np.ndarray"] = {
        k: np.full((n, 5), np.nan, dtype=float) for k in model_keys
    }
    oof_fold_idx: "np.ndarray" = np.full(n, -1, dtype=int)

    for fold_i, (tr_idx, te_idx) in enumerate(skf.split(X, y)):
        X_tr, X_te = X[tr_idx], X[te_idx]
        y_tr = y[tr_idx]

        # Fresh untrained model instances for every fold.
        fold_models = get_models()
        for name, model in fold_models.items():
            key = name.lower()
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")  # suppress sklearn numerical warnings
                model.fit(X_tr, y_tr)
            oof_pred[key][te_idx] = model.predict(X_te)
            if hasattr(model, "predict_proba"):
                oof_proba[key][te_idx] = model.predict_proba(X_te)

        oof_fold_idx[te_idx] = fold_i
        print(f"    fold {fold_i + 1}/{n_splits} complete")

    # Build output with the same schema as predictions_eligible_all.csv.
    out = df_eligible[
        ["startup_id", "investor_id", "label", "label_name", "label_reason",
         "eligible_for_model_ranking", "hard_filter_reasons"]
    ].copy().reset_index(drop=True)
    out = out.rename(columns={"label": "true_label", "label_name": "true_label_name"})
    out["hard_filter_reasons"] = df_eligible["hard_filter_reasons"].apply(json.dumps).values
    # oof_fold: which fold this pair was predicted in (0 … n_splits-1).
    out["oof_fold"] = oof_fold_idx

    label_weights = np.arange(5, dtype=float)
    for key in model_keys:
        out[f"pred_{key}"] = oof_pred[key]
        out[f"correct_{key}"] = (oof_pred[key] == out["true_label"].values).astype(int)
        out[f"error_{key}"] = np.abs(oof_pred[key] - out["true_label"].values.astype(int))

        if not np.any(np.isnan(oof_proba[key])):
            p = oof_proba[key]
            for k_cls in range(5):
                out[f"prob_{k_cls}_{key}"] = p[:, k_cls].round(4)
            out[f"expected_label_{key}"] = (p @ label_weights).round(4)
            out[f"prob_top_tier_{key}"] = (p[:, 3] + p[:, 4]).round(4)

    print()
    return out, n_splits


# ── Multi-seed OOF generation ─────────────────────────────────────────────────


def generate_multiseed_oof(
    df_eligible: "pd.DataFrame",
    df_ineligible: "pd.DataFrame",
    feature_cols: list[str],
    seeds: list[int] = MULTISEED_SEEDS,
    logreg_c_values: list[float] = LOGREG_C_GRID,
    n_splits_max: int = 5,
) -> tuple["pd.DataFrame", dict[str, Any]]:
    """Generate multi-seed OOF predictions for the LogReg C grid + GBM + DecisionTree.

    For each seed: runs stratified K-fold OOF for every model variant.
    Also computes a safety diagnostic (false-promotion risk on ineligible pairs) once
    per model variant.

    Returns (long_oof_df, metrics_dict).
    long_oof_df: one row per (eligible pair × seed × model variant).
    Columns: startup_id, investor_id, true_label, eligible_for_model_ranking,
             hard_filter_reasons, seed, model_name, c_value, pred,
             expected_label, prob_top_tier.
    """
    X_el = df_eligible[feature_cols].values.astype(float)
    y_el = df_eligible["label"].values.astype(int)
    X_in = (
        df_ineligible[feature_cols].values.astype(float)
        if len(df_ineligible) > 0
        else np.zeros((0, len(feature_cols)), dtype=float)
    )

    min_class = int(pd.Series(y_el).value_counts().min())
    n_folds = min(n_splits_max, min_class)
    if n_folds < 2:
        print(f"  ⚠  Min class count {min_class} is too small. Skipping multi-seed OOF.\n")
        return pd.DataFrame(), {}

    print(
        f"  Seeds: {seeds}  |  LogReg C grid: {logreg_c_values}  |  "
        f"Folds: {n_folds}  |  Eligible pairs: {len(df_eligible)}\n"
    )

    # Build (name, c_value, factory) specs.  Lambda default arg captures c by value.
    model_specs: list[tuple[str, "float | None", Any]] = []
    for c_val in logreg_c_values:
        model_specs.append((
            f"logreg_c{c_val}", c_val,
            lambda cv=c_val: Pipeline([
                ("scaler", StandardScaler()),
                ("clf", LogisticRegression(
                    max_iter=1000, solver="lbfgs", C=cv, random_state=RANDOM_SEED,
                )),
            ]),
        ))
    model_specs.append(("gbm", None,
        lambda: GradientBoostingClassifier(
            n_estimators=200, max_depth=5, learning_rate=0.1,
            subsample=0.9, random_state=RANDOM_SEED,
        )
    ))
    model_specs.append(("decisiontree", None,
        lambda: DecisionTreeClassifier(max_depth=6, random_state=RANDOM_SEED)
    ))

    label_weights = np.arange(5, dtype=float)
    n_el = len(df_eligible)

    per_seed_acc: dict[str, list[float]] = {name: [] for name, _, _ in model_specs}
    per_seed_mae: dict[str, list[float]] = {name: [] for name, _, _ in model_specs}

    base_cols = df_eligible[
        ["startup_id", "investor_id", "eligible_for_model_ranking", "hard_filter_reasons"]
    ].copy().reset_index(drop=True)
    base_cols["hard_filter_reasons"] = (
        df_eligible["hard_filter_reasons"].apply(json.dumps).values
    )
    base_cols["true_label"] = y_el

    all_frames: list["pd.DataFrame"] = []

    for seed_i, seed in enumerate(seeds):
        print(f"  Seed {seed_i + 1}/{len(seeds)}  (random_state={seed}):")
        skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=seed)

        seed_pred: dict[str, "np.ndarray"] = {
            name: np.full(n_el, -1, dtype=int) for name, _, _ in model_specs
        }
        seed_proba: dict[str, "np.ndarray"] = {
            name: np.full((n_el, 5), np.nan, dtype=float) for name, _, _ in model_specs
        }

        for _, (tr_idx, te_idx) in enumerate(skf.split(X_el, y_el)):
            X_tr, X_te = X_el[tr_idx], X_el[te_idx]
            y_tr = y_el[tr_idx]
            for name, _, factory in model_specs:
                model = factory()
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    model.fit(X_tr, y_tr)
                seed_pred[name][te_idx] = model.predict(X_te)
                if hasattr(model, "predict_proba"):
                    seed_proba[name][te_idx] = model.predict_proba(X_te)

        for name, _, _ in model_specs:
            acc = float((seed_pred[name] == y_el).mean())
            mae = float(np.abs(seed_pred[name] - y_el).mean())
            per_seed_acc[name].append(round(acc, 4))
            per_seed_mae[name].append(round(mae, 4))
            print(f"    {name:<22}  acc={acc:.4f}  mae={mae:.4f}")

        for name, c_val, _ in model_specs:
            frame = base_cols.copy()
            frame["seed"] = seed
            frame["model_name"] = name
            frame["c_value"] = c_val
            frame["pred"] = seed_pred[name]
            proba = seed_proba[name]
            has_proba = not np.any(np.isnan(proba))
            if has_proba:
                frame["expected_label"] = (proba @ label_weights).round(4)
                frame["prob_top_tier"] = (proba[:, 3] + proba[:, 4]).round(4)
            else:
                frame["expected_label"] = seed_pred[name].astype(float)
                frame["prob_top_tier"] = (seed_pred[name] >= 3).astype(float)
            all_frames.append(frame)
        print()

    long_df = pd.concat(all_frames, ignore_index=True) if all_frames else pd.DataFrame()

    # ── Safety diagnostic ──────────────────────────────────────────────────────
    # Train each model variant on ALL eligible pairs, apply to ineligible pairs.
    # Baseline from Phase 10b: LogReg C=1.0 → 11/335 false promotions.
    baseline_fp = 11
    print("  Safety diagnostic (final model on all eligible → ineligible pairs):")
    safety_diag: dict[str, dict[str, Any]] = {}
    for name, _, factory in model_specs:
        final = factory()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            final.fit(X_el, y_el)
        if len(X_in) > 0:
            preds_in = final.predict(X_in)
            n3 = int((preds_in >= 3).sum())
            n4 = int((preds_in == 4).sum())
        else:
            n3 = n4 = 0
        passes = n3 <= baseline_fp
        safety_diag[name] = {
            "false_promotions_3plus": n3,
            "pct_3plus": round(n3 / max(1, len(X_in)) * 100, 2),
            "false_promotions_4": n4,
            "passes_safety_floor": passes,
        }
        flag = "✓" if passes else "⚠  SAFETY REGRESSION"
        print(f"    {name:<22}  label≥3: {n3}/{len(X_in)} ({safety_diag[name]['pct_3plus']:.1f}%)  {flag}")

    # ── Aggregate classification metrics ───────────────────────────────────────
    agg_cls: dict[str, dict[str, Any]] = {}
    for name, _, _ in model_specs:
        accs = per_seed_acc[name]
        maes = per_seed_mae[name]
        n_s = len(accs)
        ma, sa = float(np.mean(accs)), float(np.std(accs))
        mm, sm = float(np.mean(maes)), float(np.std(maes))
        ci_a = 1.96 * sa / max(1.0, float(n_s) ** 0.5)
        agg_cls[name] = {
            "per_seed_accuracy": accs,
            "mean_accuracy": round(ma, 4),
            "std_accuracy": round(sa, 4),
            "ci95_accuracy": [round(ma - ci_a, 4), round(ma + ci_a, 4)],
            "per_seed_mae": maes,
            "mean_mae": round(mm, 4),
            "std_mae": round(sm, 4),
        }

    # ── Select best LogReg C (preliminary, classification-based) ──────────────
    safe_c = [
        cv for cv in logreg_c_values
        if safety_diag.get(f"logreg_c{cv}", {}).get("passes_safety_floor", False)
    ]
    if not safe_c:
        safe_c = [1.0]  # fallback: always-safe default

    def _c_sort_key(cv: float) -> tuple[float, float]:
        m = agg_cls.get(f"logreg_c{cv}", {})
        return (-m.get("mean_accuracy", 0.0), m.get("mean_mae", 999.0))

    selected_c = float(min(safe_c, key=_c_sort_key))
    best_acc = agg_cls.get(f"logreg_c{selected_c}", {}).get("mean_accuracy", 0.0)
    tied = [cv for cv in safe_c
            if abs(agg_cls.get(f"logreg_c{cv}", {}).get("mean_accuracy", 0.0) - best_acc) < 0.002
            and cv != selected_c]
    if tied:
        reason = (
            f"C={selected_c} tied within 0.2 pp accuracy with {tied}; selected as most "
            "conservative option.  Run eval-ranking-multiseed for ranking-based final confirmation."
        )
    else:
        reason = (
            f"C={selected_c} has highest mean OOF accuracy ({best_acc:.4f}) among safe C values. "
            "Run eval-ranking-multiseed for ranking-based final confirmation."
        )

    metrics_dict: dict[str, Any] = {
        "seeds": seeds,
        "n_folds": n_folds,
        "n_eligible_pairs": n_el,
        "n_ineligible_pairs": len(X_in),
        "logreg_c_grid": logreg_c_values,
        "models": [name for name, _, _ in model_specs],
        "oof_classification": agg_cls,
        "safety_diagnostic": safety_diag,
        "safety_baseline_fp_3plus": baseline_fp,
        "safe_c_values": safe_c,
        "selected_logreg_c": selected_c,
        "selection_reason": reason,
    }

    print(f"\n  Preliminary selected LogReg C: {selected_c}")
    print(f"  {reason}\n")
    return long_df, metrics_dict


# ── Multi-seed classification report ──────────────────────────────────────────


def write_multiseed_report(metrics: dict[str, Any], out_dir: Path) -> Path:
    """Write multiseed_report.md covering OOF classification metrics and C selection."""
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    seeds = metrics["seeds"]
    n_el = metrics["n_eligible_pairs"]
    n_in = metrics["n_ineligible_pairs"]
    cls = metrics["oof_classification"]
    safety = metrics["safety_diagnostic"]
    baseline_fp = metrics["safety_baseline_fp_3plus"]
    models = metrics["models"]
    selected_c = metrics["selected_logreg_c"]

    lines: list[str] = [
        "# Synthetic Matching Lab — Multi-Seed OOF Report  (Phase 11c-i)",
        "",
        "> ## ⚠️ SYNTHETIC EXPERIMENTAL DATA",
        ">",
        "> All data is SYNTHETIC.  Not investment advice.",
        "> `scoreMatch` in `lib/matching/score.ts` remains the production baseline.",
        "",
        f"Generated: {now}",
        "",
        "## Setup",
        "",
        "| Property | Value |",
        "|---|---|",
        f"| Seeds evaluated | {seeds} |",
        f"| Folds per seed | {metrics['n_folds']} |",
        f"| Total OOF fits per model | {len(seeds) * metrics['n_folds']} |",
        f"| Eligible pairs | {n_el} |",
        f"| Ineligible pairs (safety diagnostic) | {n_in} |",
        f"| LogReg C grid | {metrics['logreg_c_grid']} |",
        f"| Models evaluated | {len(models)} |",
        "",
        "## OOF Classification Metrics — mean ± std across seeds",
        "",
        "| Model | Acc mean | Acc std | CI95 | MAE mean |",
        "|---|---|---|---|---|",
    ]
    for name in models:
        m = cls.get(name, {})
        ci = m.get("ci95_accuracy", [float("nan"), float("nan")])
        lines.append(
            f"| `{name}` | {m.get('mean_accuracy', 0):.4f} | "
            f"{m.get('std_accuracy', 0):.4f} | "
            f"[{ci[0]:.4f}, {ci[1]:.4f}] | "
            f"{m.get('mean_mae', 0):.4f} |"
        )
    lines.append("")

    lines += [
        "## Per-Seed OOF Accuracy",
        "",
        "| Model | " + " | ".join(str(s) for s in seeds) + " |",
        "|" + "---|" * (len(seeds) + 1),
    ]
    for name in models:
        per_seed = cls.get(name, {}).get("per_seed_accuracy", [])
        lines.append("| `" + name + "` | " + " | ".join(f"{v:.4f}" for v in per_seed) + " |")
    lines.append("")

    lines += [
        f"## Safety Diagnostic  ({n_in} ineligible pairs)",
        "",
        f"> Baseline (Phase 10b, LogReg C=1.0): {baseline_fp}/335 false promotions.",
        "> Models exceeding baseline are excluded from C selection.",
        "",
        "| Model | Label ≥ 3 | Label = 4 | % | Passes safety floor |",
        "|---|---|---|---|---|",
    ]
    for name in models:
        s = safety.get(name, {})
        flag = "✅" if s.get("passes_safety_floor", False) else "❌"
        lines.append(
            f"| `{name}` | {s.get('false_promotions_3plus', '—')} | "
            f"{s.get('false_promotions_4', '—')} | "
            f"{s.get('pct_3plus', 0):.2f}% | {flag} |"
        )
    lines.append("")

    lines += [
        "## LogReg C Selection  (preliminary — classification-based)",
        "",
        "| Property | Value |",
        "|---|---|",
        f"| Safe C values | {metrics.get('safe_c_values', [])} |",
        f"| **Selected C** | **{selected_c}** |",
        f"| Criterion | Highest mean OOF accuracy; tiebreak: lowest MAE |",
        f"| Reason | {metrics.get('selection_reason', '—')} |",
        "",
        "> **Run `npm run eval-ranking-multiseed:synthetic-matches`** to confirm with NDCG@5.",
        "",
        "---",
        "",
        "*Synthetic experimental data only.  Not for production use.*",
    ]

    out_path = out_dir / "multiseed_report.md"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


# ── Evaluation ────────────────────────────────────────────────────────────────


def evaluate_model(
    model_name: str,
    model: Any,
    X_test: "np.ndarray",
    y_test: "np.ndarray",
) -> dict[str, Any]:
    y_pred: "np.ndarray" = model.predict(X_test)
    y_proba: "np.ndarray | None" = (
        model.predict_proba(X_test) if hasattr(model, "predict_proba") else None
    )

    acc = accuracy_score(y_test, y_pred)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
    f1_weighted = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    mae = mean_absolute_error(y_test, y_pred)
    report_dict: dict[str, Any] = classification_report(
        y_test, y_pred,
        labels=list(range(5)),
        target_names=LABEL_NAMES,
        zero_division=0,
        output_dict=True,
    )
    cm = confusion_matrix(y_test, y_pred, labels=list(range(5)))

    print(
        f"  {model_name:<14}  acc={acc:.4f}  macro-F1={f1_macro:.4f}  "
        f"weighted-F1={f1_weighted:.4f}  ordinal-MAE={mae:.4f}"
    )

    return {
        "y_pred": y_pred,
        "y_proba": y_proba,
        "accuracy": acc,
        "f1_macro": f1_macro,
        "f1_weighted": f1_weighted,
        "mae": mae,
        "confusion_matrix": cm,
        "classification_report": report_dict,
    }


# ── Ineligible safety diagnostic ──────────────────────────────────────────────


def run_ineligible_safety_diagnostic(
    trained_models: dict[str, Any],
    df_ineligible: "pd.DataFrame",
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    """Apply eligible-trained models to all ineligible pairs.

    Returns:
      (diagnostic_summary_dict, preds_by_model_dict)

    The diagnostic summary is suitable for embedding in eval_report.md and
    eligibility_summary.json.  The preds dict is used by the CSV writer.
    """
    n_in = len(df_ineligible)
    X_in = df_ineligible[FEATURE_COLS].values.astype(float)

    diagnostic: dict[str, Any] = {"n_ineligible": n_in, "models": {}}
    preds_by_model: dict[str, dict[str, Any]] = {}

    print(f"  Applying eligible-trained models to {n_in} ineligible pairs (safety diagnostic):\n")

    for name, model in trained_models.items():
        y_pred = model.predict(X_in)
        y_proba = model.predict_proba(X_in) if hasattr(model, "predict_proba") else None

        pred_dist = {i: int((y_pred == i).sum()) for i in range(5)}
        n_3plus = int((y_pred >= 3).sum())
        n_4 = int((y_pred == 4).sum())
        pct_3plus = n_3plus / n_in * 100 if n_in > 0 else 0.0

        # Breakdown of label-≥-3 predictions by filter reason.
        reason_3plus: dict[str, int] = {
            "anti_thesis_conflict": 0,
            "stage_mismatch": 0,
            "check_size_mismatch": 0,
        }
        for idx in range(n_in):
            if y_pred[idx] >= 3:
                for r in df_ineligible.iloc[idx]["hard_filter_reasons"]:
                    if r in reason_3plus:
                        reason_3plus[r] += 1

        # Top-10 highest-risk predictions by P(label=3) + P(label=4).
        top10_info: list[dict[str, Any]] = []
        if y_proba is not None:
            risk_scores = y_proba[:, 3] + y_proba[:, 4]
            top10_idx = np.argsort(risk_scores)[::-1][:10]
            for idx in top10_idx:
                row = df_ineligible.iloc[idx]
                top10_info.append({
                    "startup_id": row["startup_id"],
                    "investor_id": row["investor_id"],
                    "true_label": int(row["label"]),
                    "predicted_label": int(y_pred[idx]),
                    "risk_score": round(float(risk_scores[idx]), 4),
                    "hard_filter_reasons": list(row["hard_filter_reasons"]),
                })

        diagnostic["models"][name] = {
            "predicted_label_distribution": pred_dist,
            "n_predicted_3plus": n_3plus,
            "pct_predicted_3plus": round(pct_3plus, 2),
            "n_predicted_4": n_4,
            "breakdown_3plus_by_reason": reason_3plus,
            "top10_highest_risk": top10_info,
        }
        preds_by_model[name] = {"y_pred": y_pred, "y_proba": y_proba}

        risk_flag = f"  ⚠  {n_3plus} pairs would be false-promoted!" if n_3plus > 0 else "  ✓"
        print(
            f"  {name:<14}  predicted label≥3: {n_3plus}/{n_in} "
            f"({pct_3plus:.1f}%)  label=4: {n_4}{risk_flag}"
        )

    print()
    return diagnostic, preds_by_model


# ── Artifact helpers ──────────────────────────────────────────────────────────


def save_confusion_matrix_plot(
    y_test: "np.ndarray",
    y_pred: "np.ndarray",
    model_name: str,
    out_dir: Path,
    title_suffix: str = "",
) -> Path:
    cm = confusion_matrix(y_test, y_pred, labels=list(range(5)))
    cm_pct = np.zeros_like(cm, dtype=float)
    for i in range(5):
        row_sum = cm[i].sum()
        if row_sum > 0:
            cm_pct[i] = cm[i] / row_sum * 100

    annot = np.array(
        [[f"{cm[i][j]}\n({cm_pct[i][j]:.0f}%)" for j in range(5)] for i in range(5)]
    )
    short_names = [str(i) + "\n" + n.replace(" ", "\n") for i, n in enumerate(LABEL_NAMES)]

    fig, ax = plt.subplots(figsize=(9, 7))
    sns.heatmap(
        cm, annot=annot, fmt="",
        xticklabels=short_names, yticklabels=short_names,
        cmap="Blues", linewidths=0.5, ax=ax,
    )
    ax.set_xlabel("Predicted label", fontsize=11)
    ax.set_ylabel("True label", fontsize=11)
    ax.set_title(
        f"Confusion Matrix - {model_name}{title_suffix}\n"
        "[SYNTHETIC experimental labels only - not real user data]",
        fontsize=11,
    )
    fig.tight_layout()
    out_path = out_dir / f"confusion_matrix_{model_name.lower()}.png"
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


def save_confusion_matrix_csv(
    y_test: "np.ndarray",
    y_pred: "np.ndarray",
    model_name: str,
    out_dir: Path,
) -> Path:
    cm = confusion_matrix(y_test, y_pred, labels=list(range(5)))
    label_keys = [f"{i}_{LABEL_NAMES[i].replace(' ', '_')}" for i in range(5)]
    df_cm = pd.DataFrame(
        cm,
        index=[f"true_{k}" for k in label_keys],
        columns=[f"pred_{k}" for k in label_keys],
    )
    out_path = out_dir / f"confusion_matrix_{model_name.lower()}.csv"
    df_cm.to_csv(out_path)
    return out_path


def save_feature_importance_plot(
    model_name: str,
    model: Any,
    feature_names: list[str],
    out_dir: Path,
) -> "Path | None":
    est = model.named_steps.get("clf", model) if hasattr(model, "named_steps") else model

    if hasattr(est, "feature_importances_"):
        importances: "np.ndarray" = est.feature_importances_
        method_note = "native feature importances"
    elif hasattr(est, "coef_"):
        importances = np.abs(est.coef_).mean(axis=0)
        method_note = "mean |coefficient| across classes (scaled)"
    else:
        return None

    indices = np.argsort(importances)
    sorted_names = [feature_names[i] for i in indices]
    sorted_model = importances[indices]
    sorted_expected = np.array([LABELING_WEIGHTS.get(n, 0.0) for n in sorted_names])

    fig, ax = plt.subplots(figsize=(10, 5))
    y_pos = np.arange(len(sorted_names))
    ax.barh(y_pos, sorted_model, color="#4A90D9", alpha=0.85, label="Model learned importance")
    ax.plot(
        sorted_expected, y_pos, "o--",
        color="#E8782A", linewidth=1.2, markersize=5, alpha=0.8,
        label="Labeling formula weight (expected)",
    )
    ax.set_yticks(y_pos)
    ax.set_yticklabels(sorted_names, fontsize=9)
    ax.set_xlabel("Importance", fontsize=10)
    ax.set_title(
        f"Feature Importance - {model_name} ({method_note})\n"
        "[SYNTHETIC experimental - orange dots show labeling formula weights]",
        fontsize=10,
    )
    ax.legend(fontsize=9)
    fig.tight_layout()
    out_path = out_dir / f"feature_importance_{model_name.lower()}.png"
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


def save_predictions_csv(
    df_test: "pd.DataFrame",
    metrics_all: dict[str, dict[str, Any]],
    out_dir: Path,
    filename: str = "predictions.csv",
) -> Path:
    """Save per-pair predictions. Includes eligibility fields (Phase 10)."""
    out = df_test[["startup_id", "investor_id", "label", "label_name", "label_reason"]].copy()
    out = out.rename(columns={"label": "true_label", "label_name": "true_label_name"})

    # Phase 10: include eligibility fields even when all rows are eligible.
    out["eligible_for_model_ranking"] = df_test["eligible_for_model_ranking"].values
    out["hard_filter_reasons"] = df_test["hard_filter_reasons"].apply(json.dumps)

    # Phase 11a: include train/test split annotation when available (predictions_eligible_all.csv).
    if "split" in df_test.columns:
        out["split"] = df_test["split"].values

    for model_name, m in metrics_all.items():
        key = model_name.lower()
        out[f"pred_{key}"] = m["y_pred"]
        out[f"correct_{key}"] = (m["y_pred"] == out["true_label"].values).astype(int)
        out[f"error_{key}"] = np.abs(
            m["y_pred"].astype(int) - out["true_label"].values.astype(int)
        )
        if m["y_proba"] is not None:
            for k in range(5):
                out[f"prob_{k}_{key}"] = m["y_proba"][:, k].round(4)
            # Phase 11a: ranking-ready derived columns.
            # expected_label = Σ k · P(label=k), a continuous ranking score.
            # prob_top_tier  = P(label≥3) = P(label=3) + P(label=4).
            label_weights = np.arange(5, dtype=float)
            out[f"expected_label_{key}"] = (m["y_proba"] @ label_weights).round(4)
            out[f"prob_top_tier_{key}"] = (
                m["y_proba"][:, 3] + m["y_proba"][:, 4]
            ).round(4)

    out_path = out_dir / filename
    out.to_csv(out_path, index=False)
    return out_path


def save_predictions_ineligible_csv(
    df_ineligible: "pd.DataFrame",
    preds_by_model: dict[str, dict[str, Any]],
    out_dir: Path,
) -> Path:
    """Save model predictions on ineligible pairs for audit/safety review."""
    out = df_ineligible[
        ["startup_id", "investor_id", "label", "label_name", "label_reason"]
    ].copy()
    out = out.rename(columns={"label": "true_label", "label_name": "true_label_name"})
    out["eligible_for_model_ranking"] = False
    out["hard_filter_reasons"] = df_ineligible["hard_filter_reasons"].apply(json.dumps)

    false_promotion_any = np.zeros(len(df_ineligible), dtype=bool)

    for model_name, preds in preds_by_model.items():
        key = model_name.lower()
        y_pred = preds["y_pred"]
        y_proba = preds["y_proba"]
        out[f"pred_{key}"] = y_pred
        out[f"error_{key}"] = np.abs(
            y_pred.astype(int) - out["true_label"].values.astype(int)
        )
        if y_proba is not None:
            for k in range(5):
                out[f"prob_{k}_{key}"] = y_proba[:, k].round(4)
            label_weights = np.arange(5, dtype=float)
            out[f"expected_label_{key}"] = (y_proba @ label_weights).round(4)
            out[f"prob_top_tier_{key}"] = (y_proba[:, 3] + y_proba[:, 4]).round(4)
        false_promotion_any |= (y_pred >= 3)

    out["false_promotion_risk"] = false_promotion_any.astype(int)

    out_path = out_dir / "predictions_ineligible.csv"
    out.to_csv(out_path, index=False)
    return out_path


def save_eligibility_summary_json(
    df: "pd.DataFrame",
    training_mode: str,
    ineligible_diagnostic: "dict[str, Any] | None",
    out_dir: Path,
) -> Path:
    """Save machine-readable eligibility summary."""
    n = len(df)
    n_eligible = int(df["eligible_for_model_ranking"].sum())
    n_ineligible = n - n_eligible

    reason_counts: dict[str, int] = {
        "anti_thesis_conflict": 0,
        "stage_mismatch": 0,
        "check_size_mismatch": 0,
    }
    multi_reason_count = 0
    for reasons in df[~df["eligible_for_model_ranking"]]["hard_filter_reasons"]:
        for r in reasons:
            if r in reason_counts:
                reason_counts[r] += 1
        if len(reasons) > 1:
            multi_reason_count += 1

    df_el = df[df["eligible_for_model_ranking"]]
    df_in = df[~df["eligible_for_model_ranking"]]

    fp_in_dataset = int(((df_in["label"] >= 3)).sum())

    summary: dict[str, Any] = {
        "generated": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        "training_mode": training_mode,
        "total_pairs": n,
        "eligible_pair_count": n_eligible,
        "eligible_pair_pct": round(n_eligible / n * 100, 2),
        "ineligible_pair_count": n_ineligible,
        "ineligible_pair_pct": round(n_ineligible / n * 100, 2),
        "hard_filter_reason_counts": reason_counts,
        "pairs_with_multiple_reasons": multi_reason_count,
        "label_distribution_eligible": {
            str(i): int((df_el["label"] == i).sum()) for i in range(5)
        },
        "label_distribution_ineligible": {
            str(i): int((df_in["label"] == i).sum()) for i in range(5)
        },
        "false_promotion_risk_in_dataset": fp_in_dataset,
        "false_promotion_risk_model": (
            {
                model_name: {
                    "n_predicted_3plus": info["n_predicted_3plus"],
                    "pct_predicted_3plus": info["pct_predicted_3plus"],
                    "n_predicted_4": info["n_predicted_4"],
                    "breakdown_3plus_by_reason": info["breakdown_3plus_by_reason"],
                }
                for model_name, info in ineligible_diagnostic["models"].items()
            }
            if ineligible_diagnostic
            else None
        ),
    }

    out_path = out_dir / "eligibility_summary.json"
    out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return out_path


def save_decision_tree_txt(
    model: Any,
    feature_names: list[str],
    out_dir: Path,
) -> Path:
    disclaimer = (
        "# ─────────────────────────────────────────────────────────────────────\n"
        "# SYNTHETIC EXPERIMENTAL DATA ONLY\n"
        "#\n"
        "# This decision tree was trained on rule-generated SYNTHETIC labels.\n"
        "# It approximates the labeling rules in:\n"
        "#   scripts/generate-synthetic-match-pairs.ts\n"
        "#\n"
        "# It does NOT represent real investor behaviour.\n"
        "# It is NOT investment advice.\n"
        "# It does NOT predict startup success or investment returns.\n"
        "# Do NOT use these rules to guide real investment decisions.\n"
        "# ─────────────────────────────────────────────────────────────────────\n\n"
    )
    tree_text = export_text(model, feature_names=feature_names, max_depth=6, show_weights=True)
    out_path = out_dir / "decision_tree.txt"
    out_path.write_text(disclaimer + tree_text, encoding="utf-8")
    return out_path


# ── Evaluation report ─────────────────────────────────────────────────────────


def write_eval_report(
    metrics_all: dict[str, dict[str, Any]],
    cv_results: "dict[str, dict[str, np.ndarray]] | None",
    label_counts: dict[int, int],
    n_train: int,
    n_test: int,
    artifact_paths: dict[str, "Path | None"],
    out_dir: Path,
    *,
    training_mode: str = "full",
    n_total: int = 0,
    n_eligible: int = 0,
    n_ineligible: int = 0,
    n_cv_folds: int = 5,
    label_counts_eligible: "dict[int, int] | None" = None,
    label_counts_ineligible: "dict[int, int] | None" = None,
    reason_counts: "dict[str, int] | None" = None,
    multi_reason_count: int = 0,
    ineligible_diagnostic: "dict[str, Any] | None" = None,
    oof_metrics: "dict[str, Any] | None" = None,
) -> Path:
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    total_training = n_train + n_test

    lines: list[str] = []

    # ── Header ────────────────────────────────────────────────────────────────
    lines += [
        "# Synthetic Matching Model — Evaluation Report",
        "",
        "> ## ⚠️ SYNTHETIC EXPERIMENTAL DATA — READ BEFORE USING",
        ">",
        "> - All training data is entirely **synthetic**. No real user data was used.",
        "> - **This model is NOT investment advice.**",
        "> - This model does **NOT** predict startup success or investment returns.",
        "> - Labels 0–4 are **rule-generated** profile-fit categories from",
        ">   `scripts/generate-synthetic-match-pairs.ts`.",
        "> - The model is learning the **synthetic labeling rules**, not real investor behaviour.",
        "> - **No production deployment should be based on this model alone.**",
        "> - Use `scoreMatch` in `lib/matching/score.ts` as the safe production baseline.",
        "",
        f"Generated: {now}",
        f"Training mode: **{training_mode}** (see Phase 10 for mode descriptions)",
        "",
    ]

    # ── Phase 10: Hard eligibility summary ────────────────────────────────────
    lines += [
        "## Hard Eligibility Summary  (Phase 10)",
        "",
        "Hard eligibility is a **policy gate**, not a learned feature.  "
        "Ineligible pairs are blocked from model ranking unconditionally.",
        "",
        "| Property | Value |",
        "|---|---|",
        f"| Total pairs | {n_total} |",
        f"| Eligible for model ranking | {n_eligible} ({n_eligible / max(1, n_total) * 100:.1f}%) |",
        f"| Ineligible | {n_ineligible} ({n_ineligible / max(1, n_total) * 100:.1f}%) |",
        "",
    ]
    if reason_counts:
        lines += [
            "| Hard filter reason | Count |",
            "|---|---|",
            f"| `anti_thesis_conflict` | {reason_counts.get('anti_thesis_conflict', 0)} |",
            f"| `stage_mismatch` | {reason_counts.get('stage_mismatch', 0)} |",
            f"| `check_size_mismatch` | {reason_counts.get('check_size_mismatch', 0)} |",
            f"| Pairs with 2+ reasons | {multi_reason_count} |",
            "",
        ]

    # Eligible label distribution
    if label_counts_eligible:
        lines += [
            "### Label distribution — eligible pairs",
            "",
            "| Label | Name | Count | % |",
            "|---|---|---|---|",
        ]
        n_el = sum(label_counts_eligible.values())
        for i, name in enumerate(LABEL_NAMES):
            c = label_counts_eligible.get(i, 0)
            pct = c / max(1, n_el) * 100
            lines.append(f"| {i} | {name} | {c} | {pct:.1f}% |")
        lines.append("")

    # Ineligible label distribution
    if label_counts_ineligible:
        lines += [
            "### Label distribution — ineligible pairs",
            "",
            "| Label | Name | Count | % | Note |",
            "|---|---|---|---|---|",
        ]
        n_in = sum(label_counts_ineligible.values())
        for i, name in enumerate(LABEL_NAMES):
            c = label_counts_ineligible.get(i, 0)
            pct = c / max(1, n_in) * 100
            note = "⚠️ false-promotion risk" if i >= 3 and c > 0 else ""
            lines.append(f"| {i} | {name} | {c} | {pct:.1f}% | {note} |")
        fp = sum(label_counts_ineligible.get(i, 0) for i in [3, 4])
        if fp == 0:
            lines += ["", "> ✅ No ineligible pair has label ≥ 3. Gate and caps are consistent.", ""]
        else:
            lines += [
                "",
                f"> ⚠️ {fp} ineligible pair(s) carry label ≥ 3. "
                "Investigate label-cap / eligibility alignment.",
                "",
            ]

    # ── Training mode description ─────────────────────────────────────────────
    lines += [
        "## Training Mode",
        "",
        f"**`{training_mode}`** — ",
    ]
    if training_mode == "eligible-only":
        lines[-1] += (
            "Models trained and evaluated on eligible pairs only. "
            "Ineligible pairs are used as a safety diagnostic (View B) but never as training data."
        )
    elif training_mode == "full":
        lines[-1] += (
            "Legacy mode: models trained and evaluated on all pairs. "
            "Eligibility fields are reported but not used to filter training data."
        )
    else:
        lines[-1] += (
            "Models trained on eligible pairs only. Primary evaluation on eligible test split. "
            "Full-dataset predictions also exported for comparison."
        )
    lines.append("")

    # ── Dataset summary ───────────────────────────────────────────────────────
    lines += [
        "## Dataset",
        "",
        "| Property | Value |",
        "|---|---|",
        f"| Source | `data/synthetic-matching/pairs.json` |",
        f"| Total pairs | {n_total} |",
        f"| Training pool ({training_mode}) | {total_training} pairs |",
        f"| Training set | {n_train} pairs (80%, stratified) |",
        f"| Test set | {n_test} pairs (20%, stratified) |",
        f"| Features | {len(FEATURE_COLS)} numeric |",
        f"| Target | Label 0–4 (5-class classification) |",
        f"| Random seed | {RANDOM_SEED} |",
        "",
        "### Label distribution (training pool)",
        "",
        "| Label | Name | Count | % |",
        "|---|---|---|---|",
    ]
    for i, name in enumerate(LABEL_NAMES):
        c = label_counts.get(i, 0)
        pct = c / max(1, total_training) * 100
        lines.append(f"| {i} | {name} | {c} | {pct:.1f}% |")
    lines.append("")

    # ── Features ──────────────────────────────────────────────────────────────
    lines += [
        "## Features",
        "",
        "| Feature | Formula weight | Notes |",
        "|---|---|---|",
        "| `sector_overlap_score` | +0.20 | Fraction of startup sectors in investor mandate (canonical) |",
        "| `stage_match_score` | +0.18 | 1.0 exact / 0.5 adjacent / 0.2 two-step / 0 none |",
        "| `check_size_score` | +0.15 | 1.0 in range; linear falloff outside |",
        "| `interest_overlap_score` | +0.12 | Synonym-expanded onboarding interest overlap |",
        "| `customer_type_overlap_score` | +0.10 | Compatibility matrix |",
        "| `business_model_overlap_score` | +0.08 | Compatibility matrix |",
        "| `geography_score` | +0.07 | 1.0 confirmed match; 0.2 tension |",
        "| `lead_follow_score` | +0.05 | Investor role vs startup engagement signals |",
        "| `traction_strength_score` | +0.05 | no_traction=0 … enterprise_contracts=1 |",
        "| `anti_thesis_conflict_score` | **−0.40 penalty** | 1 = worst conflict; 0 = none |",
        "| `profile_completeness_score` | 0 (not in score) | Zero variance in synthetic data |",
        "| `semantic_similarity_score` | 0 (not in labeling formula) | Cosine sim from all-MiniLM-L6-v2 |",
        "",
    ]

    # ── 5-fold CV ─────────────────────────────────────────────────────────────
    if cv_results:
        lines += [
            f"## {n_cv_folds}-Fold Cross-Validation  (training data only)",
            "",
            "| Model | Accuracy | Macro-F1 | Weighted-F1 |",
            "|---|---|---|---|",
        ]
        for model_name, cv in cv_results.items():
            acc = cv["accuracy"]
            f1m = cv["f1_macro"]
            f1w = cv["f1_weighted"]
            lines.append(
                f"| {model_name} | "
                f"{acc.mean():.4f}±{acc.std():.4f} | "
                f"{f1m.mean():.4f}±{f1m.std():.4f} | "
                f"{f1w.mean():.4f}±{f1w.std():.4f} |"
            )
        lines += [
            "",
            "> **Expected**: high accuracy because the model is fitting a deterministic labeling",
            "> function. This is a **pipeline sanity check**, not evidence of real-world ability.",
            "",
        ]
    else:
        lines += [
            "## Cross-Validation",
            "",
            "> CV skipped — insufficient samples per class for stratified folding.",
            "",
        ]

    # ── Test-set results ──────────────────────────────────────────────────────
    lines += [
        "## Test-Set Evaluation  (80/20 stratified split)",
        "",
        "| Model | Accuracy | Macro-F1 | Weighted-F1 | Ordinal MAE |",
        "|---|---|---|---|---|",
    ]
    for model_name, m in metrics_all.items():
        lines.append(
            f"| {model_name} | {m['accuracy']:.4f} | {m['f1_macro']:.4f} | "
            f"{m['f1_weighted']:.4f} | {m['mae']:.4f} |"
        )
    lines.append("")

    best_name = "GBM" if "GBM" in metrics_all else list(metrics_all.keys())[0]
    m_best = metrics_all[best_name]
    lines += [
        f"### Per-class metrics ({best_name})",
        "",
        "| Label | Precision | Recall | F1-score | Support |",
        "|---|---|---|---|---|",
    ]
    rep = m_best["classification_report"]
    for i, name in enumerate(LABEL_NAMES):
        if name in rep:
            r = rep[name]
            lines.append(
                f"| {i} — {name} | {r['precision']:.3f} | "
                f"{r['recall']:.3f} | {r['f1-score']:.3f} | {int(r['support'])} |"
            )
    lines.append("")

    # ── Feature importance ────────────────────────────────────────────────────
    lines += [
        "## Feature Importance Interpretation",
        "",
        "The feature importance chart overlays model-learned importances against the "
        "labeling formula weights. Divergences reflect non-linear cap effects.",
        "",
    ]

    # ── Phase 10: Safety diagnostic ───────────────────────────────────────────
    if ineligible_diagnostic and training_mode in ("eligible-only", "eligible-train-full-eval"):
        n_in = ineligible_diagnostic["n_ineligible"]
        lines += [
            "## Safety Diagnostic — Model Behavior on Ineligible Pairs  (Phase 10, View B)",
            "",
            "> **Important:** These pairs were **never seen during training**.  They were excluded "
            "by the hard eligibility gate.  The table below shows what the model would predict "
            "if the gate were absent — i.e., the false-promotion risk.",
            "",
            f"Ineligible pairs evaluated: **{n_in}**",
            "",
            "| Model | Predicted label≥3 | Predicted label=4 | anti_thesis | stage | check_size |",
            "|---|---|---|---|---|---|",
        ]
        for model_name, info in ineligible_diagnostic["models"].items():
            n3 = info["n_predicted_3plus"]
            n4 = info["n_predicted_4"]
            pct3 = info["pct_predicted_3plus"]
            rb = info["breakdown_3plus_by_reason"]
            lines.append(
                f"| {model_name} | {n3} ({pct3:.1f}%) | {n4} | "
                f"{rb.get('anti_thesis_conflict', 0)} | "
                f"{rb.get('stage_mismatch', 0)} | "
                f"{rb.get('check_size_mismatch', 0)} |"
            )
        lines.append("")

        # Interpretation
        all_zero = all(
            info["n_predicted_3plus"] == 0
            for info in ineligible_diagnostic["models"].values()
        )
        if all_zero:
            lines += [
                "> ✅ **No false-promotion risk detected.** All models correctly assign label ≤ 2 "
                "to every ineligible pair, consistent with the hard label caps. "
                "The eligibility gate is adding a structural safeguard but no pair "
                "is being incorrectly promoted in the current synthetic dataset.",
                "",
            ]
        else:
            lines += [
                "> ⚠️ **False-promotion risk detected.** Some ineligible pairs are predicted "
                "at label ≥ 3 by at least one model. Review `predictions_ineligible.csv` "
                "and the reason breakdown to understand which constraint is being overridden.",
                "",
            ]

        # Top-10 for GBM
        gbm_diag = ineligible_diagnostic["models"].get("GBM", {})
        top10 = gbm_diag.get("top10_highest_risk", [])
        if top10:
            lines += [
                "### Top-10 Highest-Risk Ineligible Pairs  (GBM — P(label≥3))",
                "",
                "| Startup | Investor | True label | Predicted | Risk score | Filter reasons |",
                "|---|---|---|---|---|---|",
            ]
            for row in top10:
                reasons_str = ", ".join(row["hard_filter_reasons"])
                lines.append(
                    f"| `{row['startup_id']}` | `{row['investor_id']}` | "
                    f"{row['true_label']} | {row['predicted_label']} | "
                    f"{row['risk_score']:.4f} | {reasons_str} |"
                )
            lines.append("")

    # ── Artifacts ─────────────────────────────────────────────────────────────
    lines += [
        "## Artifacts",
        "",
        "| File | Description |",
        "|---|---|",
    ]
    for desc, path in artifact_paths.items():
        if path and path.exists():
            try:
                rel = path.relative_to(REPO_ROOT)
                lines.append(f"| `{rel}` | {desc} |")
            except ValueError:
                lines.append(f"| `{path}` | {desc} |")
    lines.append("")

    # ── Phase 11b: OOF section ────────────────────────────────────────────────
    if oof_metrics:
        lines += [
            "## Out-of-Fold Evaluation  (Phase 11b — leakage-free)",
            "",
            "In-sample ranking metrics (Phase 11a, `predictions_eligible_all.csv`) are an "
            "**upper bound**: the 208 training pairs receive predictions from models that "
            "saw them during training.",
            "",
            "Out-of-fold (OOF) predictions provide the **fairest available synthetic estimate** "
            "of ranking quality:",
            "- Each pair is predicted by a fold that excluded it from training.",
            "- All 260 eligible pairs receive exactly one OOF prediction (no leakage).",
            "- The `oof_fold` column records which K-fold each pair was predicted in.",
            "",
            "### OOF vs in-sample classification metrics",
            "",
            "| Model | OOF Accuracy | OOF Ordinal MAE | In-sample Accuracy | In-sample MAE |",
            "|---|---|---|---|---|",
        ]
        for model_name, m in metrics_all.items():
            oof_m = oof_metrics.get(model_name, {})
            oof_acc = oof_m.get("accuracy")
            oof_mae_val = oof_m.get("ordinal_mae")
            lines.append(
                f"| {model_name} | "
                f"{f'{oof_acc:.4f}' if oof_acc is not None else '—'} | "
                f"{f'{oof_mae_val:.4f}' if oof_mae_val is not None else '—'} | "
                f"{m['accuracy']:.4f} | "
                f"{m['mae']:.4f} |"
            )
        lines += [
            "",
            "> OOF accuracy is typically 5–15 pp lower than in-sample accuracy.  "
            "The gap reflects overfitting on the training set (most pronounced in "
            "GBM and DecisionTree; LogReg is more regularized).",
            "",
            "### Using OOF metrics for model selection",
            "",
            "For Phase 11c and beyond, **use OOF metrics** for model selection, "
            "not in-sample metrics.  Compute OOF ranking metrics with:",
            "",
            "```bash",
            "npm run eval-ranking-oof:synthetic-matches",
            "```",
            "",
            "This evaluates NDCG@K, P@K, and MAP@K using `predictions_eligible_oof.csv`, "
            "writing results to `ranking_report_oof.md`.  Compare with the in-sample "
            "`ranking_report.md` to understand how much ranking quality drops when "
            "leakage is removed — the gap quantifies overfitting in the ranking task.",
            "",
        ]

    # ── Caveats ───────────────────────────────────────────────────────────────
    lines += [
        "---",
        "",
        "## Important Caveats",
        "",
        "1. **Not real data.** All pairs were generated from fictional synthetic profiles.",
        "2. **Tautological accuracy.** High accuracy (~95–99%) is expected — "
        "it reflects deterministic rule recovery, not real-world matching ability.",
        "3. **Eligibility gate is policy.** Hard filter reasons are mandate constraints, "
        "not learned preferences. Never use them as model features.",
        "4. **No production deployment.** `scoreMatch` in `lib/matching/score.ts` is the "
        "safe production baseline. Do not replace it without real post-launch validation.",
        "5. **Class imbalance in small test buckets.** Per-class F1 for label 3/4 is "
        "noisy due to small test set counts.",
        "",
    ]

    out_path = out_dir / "eval_report.md"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


# ── Main ──────────────────────────────────────────────────────────────────────


def main() -> None:
    args = parse_args()
    training_mode: str = args.training_mode
    out_dir: Path = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        sns.set_theme(style="whitegrid", font_scale=0.95)
    except Exception:
        pass

    print("\n" + "═" * 72)
    print("  SYNTHETIC MATCHING MODEL — EXPERIMENTAL PIPELINE")
    print("═" * 72)
    print("  ⚠  Training on synthetic labels. NOT investment advice.")
    print("  ⚠  Labels are rule-generated, not real investor behaviour.")
    print(f"  ℹ  Training mode: {training_mode}")
    if training_mode != "full":
        print("     (default since Phase 10 — use --training-mode full for legacy behavior)")
    print("═" * 72)

    if not _ELIGIBILITY_AVAILABLE:
        print(
            "\n  ⚠  eligibility.py not found in scripts/ml/. "
            "Eligibility will be loaded from pairs.json only.\n"
        )

    # ── Load ──────────────────────────────────────────────────────────────────
    print(f"\nLoading {PAIRS_PATH} …")
    df = load_and_validate(PAIRS_PATH)
    print_dataset_stats(df)
    print_eligibility_summary(df)

    if args.validate_only:
        print("--validate-only set. Stopping before training.\n")
        return

    # ── Split into eligible / ineligible ──────────────────────────────────────
    df_eligible = df[df["eligible_for_model_ranking"]].reset_index(drop=True)
    df_ineligible = df[~df["eligible_for_model_ranking"]].reset_index(drop=True)
    n_total = len(df)
    n_eligible = len(df_eligible)
    n_ineligible = len(df_ineligible)

    # ── Select training pool ───────────────────────────────────────────────────
    if training_mode in ("eligible-only", "eligible-train-full-eval"):
        df_train_pool = df_eligible
        pool_label = "eligible pairs"
    else:
        df_train_pool = df
        pool_label = "all pairs (legacy full mode)"

    X: "np.ndarray" = df_train_pool[FEATURE_COLS].values.astype(float)
    y: "np.ndarray" = df_train_pool["label"].values.astype(int)

    # Stratified 80/20 split on the training pool.
    all_indices = np.arange(len(df_train_pool))
    idx_train, idx_test = train_test_split(
        all_indices, test_size=0.20, stratify=y, random_state=RANDOM_SEED
    )
    X_train, X_test = X[idx_train], X[idx_test]
    y_train, y_test = y[idx_train], y[idx_test]
    df_test = df_train_pool.iloc[idx_test].reset_index(drop=True)

    print(
        f"Training pool: {pool_label}  "
        f"({len(df_train_pool)} pairs)  →  "
        f"Train: {len(X_train)}  |  Test: {len(X_test)}\n"
    )

    # ── 5-fold CV ─────────────────────────────────────────────────────────────
    print(f"{'─' * 72}")
    print(f"{len(X_train)//len(X_train)*5}-FOLD STRATIFIED CROSS-VALIDATION  (training pool)")
    print(f"{'─' * 72}")
    models = get_models()
    cv_results, n_cv_folds = run_cross_validation(models, X_train, y_train)

    # ── Train on full training split ───────────────────────────────────────────
    print(f"\n{'─' * 72}")
    print("TEST SET EVALUATION  (80/20 stratified split)")
    print(f"{'─' * 72}")
    trained_models: dict[str, Any] = {}
    for name, model in models.items():
        model.fit(X_train, y_train)
        trained_models[name] = model

    metrics_all: dict[str, dict[str, Any]] = {}
    for name, model in trained_models.items():
        metrics_all[name] = evaluate_model(name, model, X_test, y_test)

    # ── Phase 10: Ineligible safety diagnostic ────────────────────────────────
    ineligible_diagnostic: "dict[str, Any] | None" = None
    preds_ineligible: dict[str, dict[str, Any]] = {}

    if training_mode in ("eligible-only", "eligible-train-full-eval") and n_ineligible > 0:
        print(f"\n{'─' * 72}")
        print("SAFETY DIAGNOSTIC  — model behavior on ineligible pairs  (View B)")
        print(f"{'─' * 72}")
        ineligible_diagnostic, preds_ineligible = run_ineligible_safety_diagnostic(
            trained_models, df_ineligible
        )

    # Phase 11c: multi-seed OOF variables (always in scope; populated by --multiseed).
    ms_df_: "pd.DataFrame" = pd.DataFrame()
    ms_metrics_: "dict[str, Any]" = {}

    if args.multiseed:
        if training_mode != "eligible-only":
            print(
                "  ⚠  --multiseed requires --training-mode eligible-only. Skipping.\n"
            )
        else:
            print(f"\n{'─' * 72}")
            print("MULTI-SEED OOF GENERATION  (Phase 11c — model selection)")
            print(f"{'─' * 72}")
            ms_df_, ms_metrics_ = generate_multiseed_oof(
                df_eligible, df_ineligible, FEATURE_COLS,
            )

    # ── Phase 10: Full-dataset predictions (eligible-train-full-eval) ─────────
    preds_full: dict[str, dict[str, Any]] = {}
    if training_mode == "eligible-train-full-eval":
        X_full = df[FEATURE_COLS].values.astype(float)
        for name, model in trained_models.items():
            preds_full[name] = {
                "y_pred": model.predict(X_full),
                "y_proba": model.predict_proba(X_full) if hasattr(model, "predict_proba") else None,
            }

    # ── Phase 11a: All-eligible predictions for per-founder ranking eval ──────
    # In eligible-only mode, produce predictions for ALL 260 eligible pairs
    # (not just the 52-pair test split) so eval_ranking.py can build per-founder
    # and per-investor ranked lists.
    #
    # WARNING: the 208 training pairs have in-sample predictions; scores for
    # those pairs may be inflated (especially for GBM and DecisionTree).  The
    # "split" column marks "train" vs "test" so analysts can track this.
    # Run eval_ranking.py --source oof for leakage-free OOF ranking (Phase 11b).
    metrics_el_all_: dict[str, dict[str, Any]] = {}
    df_el_split_: "pd.DataFrame | None" = None
    # Phase 11b variables (initialised here so they are always in scope).
    oof_df_: "pd.DataFrame" = pd.DataFrame()
    oof_metrics_: "dict[str, Any] | None" = None
    if training_mode == "eligible-only":
        X_all_el = df_eligible[FEATURE_COLS].values.astype(float)
        for name, model in trained_models.items():
            metrics_el_all_[name] = {
                "y_pred": model.predict(X_all_el),
                "y_proba": (
                    model.predict_proba(X_all_el)
                    if hasattr(model, "predict_proba") else None
                ),
            }
        df_el_split_ = df_eligible.copy().reset_index(drop=True)
        is_test_arr = np.zeros(len(df_el_split_), dtype=bool)
        is_test_arr[idx_test] = True
        df_el_split_["split"] = np.where(is_test_arr, "test", "train")

        # ── Phase 11b: Leakage-free OOF predictions ──────────────────────────
        print(f"\n{'─' * 72}")
        print("OUT-OF-FOLD PREDICTION GENERATION  (Phase 11b — leakage-free)")
        print(f"{'─' * 72}")
        oof_df_, _ = generate_oof_predictions(df_eligible, FEATURE_COLS)
        if not oof_df_.empty:
            # Compute and display OOF classification metrics.
            oof_metrics_: dict[str, Any] = {}
            name_display = {"logreg": "LogReg", "gbm": "GBM", "decisiontree": "DecisionTree"}
            print(f"  OOF classification metrics (n={len(oof_df_)} eligible pairs):")
            for key, display in name_display.items():
                if f"correct_{key}" in oof_df_.columns:
                    acc = float(oof_df_[f"correct_{key}"].mean())
                    mae = float(oof_df_[f"error_{key}"].mean())
                    oof_metrics_[display] = {
                        "accuracy": round(acc, 4),
                        "ordinal_mae": round(mae, 4),
                    }
                    print(f"  {display:<14}  OOF acc={acc:.4f}  OOF ordinal-MAE={mae:.4f}")

    # ── Save artifacts ────────────────────────────────────────────────────────
    print(f"\n{'─' * 72}")
    print(f"SAVING ARTIFACTS  →  {out_dir}")
    print(f"{'─' * 72}")

    artifact_paths: dict[str, "Path | None"] = {}

    # Suffix for plot titles indicates the training scope.
    title_suffix = "" if training_mode == "full" else " (eligible-only)"

    for name, model in trained_models.items():
        m = metrics_all[name]

        cm_plot = save_confusion_matrix_plot(
            y_test, m["y_pred"], name, out_dir, title_suffix=title_suffix
        )
        artifact_paths[f"Confusion matrix — {name} (PNG)"] = cm_plot
        print(f"  ✓ {cm_plot.name}")

        cm_csv = save_confusion_matrix_csv(y_test, m["y_pred"], name, out_dir)
        artifact_paths[f"Confusion matrix — {name} (CSV)"] = cm_csv
        print(f"  ✓ {cm_csv.name}")

        imp = save_feature_importance_plot(name, model, FEATURE_COLS, out_dir)
        if imp:
            artifact_paths[f"Feature importance — {name}"] = imp
            print(f"  ✓ {imp.name}")

    # predictions.csv (training scope, with eligibility fields)
    pred_csv = save_predictions_csv(df_test, metrics_all, out_dir)
    artifact_paths["Predictions CSV — test set (all models, with eligibility fields)"] = pred_csv
    print(f"  ✓ {pred_csv.name}")

    # predictions_eligible_all.csv (Phase 11a — eligible-only mode only)
    if df_el_split_ is not None and metrics_el_all_:
        pred_el_all_csv = save_predictions_csv(
            df_el_split_, metrics_el_all_, out_dir, "predictions_eligible_all.csv"
        )
        artifact_paths[
            "Predictions CSV — all eligible pairs incl. train split (Phase 11a ranking eval)"
        ] = pred_el_all_csv
        print(f"  ✓ {pred_el_all_csv.name}")

    # predictions_eligible_oof.csv (Phase 11b — leakage-free OOF)
    if not oof_df_.empty:
        oof_csv_path = out_dir / "predictions_eligible_oof.csv"
        oof_df_.to_csv(oof_csv_path, index=False)
        artifact_paths[
            "Predictions CSV — eligible OOF (leakage-free, Phase 11b)"
        ] = oof_csv_path
        print(f"  ✓ {oof_csv_path.name}")

    # multiseed artifacts (Phase 11c — only generated with --multiseed flag)
    if not ms_df_.empty:
        ms_csv_path = out_dir / "predictions_eligible_oof_multiseed.csv"
        ms_df_.to_csv(ms_csv_path, index=False)
        artifact_paths["Multi-seed OOF predictions (Phase 11c)"] = ms_csv_path
        print(f"  ✓ {ms_csv_path.name}")

        ms_json_path = out_dir / "multiseed_metrics.json"
        ms_json_path.write_text(json.dumps(ms_metrics_, indent=2), encoding="utf-8")
        artifact_paths["Multi-seed metrics (Phase 11c)"] = ms_json_path
        print(f"  ✓ {ms_json_path.name}")

        ms_report = write_multiseed_report(ms_metrics_, out_dir)
        artifact_paths["Multi-seed classification report (Phase 11c)"] = ms_report
        print(f"  ✓ {ms_report.name}")

    # Full-dataset predictions (eligible-train-full-eval only)
    if training_mode == "eligible-train-full-eval" and preds_full:
        # Build a synthetic "metrics_all" dict for the full df (y_pred only, no y_test).
        metrics_full_for_csv: dict[str, dict[str, Any]] = {
            name: {"y_pred": preds["y_pred"], "y_proba": preds["y_proba"]}
            for name, preds in preds_full.items()
        }
        pred_all_csv = save_predictions_csv(df, metrics_full_for_csv, out_dir, "predictions_all.csv")
        artifact_paths["Predictions CSV — all pairs (eligible-train-full-eval)"] = pred_all_csv
        print(f"  ✓ {pred_all_csv.name}")

    # predictions_ineligible.csv
    if preds_ineligible:
        pred_in_csv = save_predictions_ineligible_csv(df_ineligible, preds_ineligible, out_dir)
        artifact_paths["Predictions CSV — ineligible pairs (safety diagnostic)"] = pred_in_csv
        print(f"  ✓ {pred_in_csv.name}")

    # eligibility_summary.json (always written)
    elig_json = save_eligibility_summary_json(df, training_mode, ineligible_diagnostic, out_dir)
    artifact_paths["Eligibility summary (Phase 10)"] = elig_json
    print(f"  ✓ {elig_json.name}")

    # decision_tree.txt
    dt_model = trained_models.get("DecisionTree")
    if dt_model is not None:
        dt_txt = save_decision_tree_txt(dt_model, FEATURE_COLS, out_dir)
        artifact_paths["Decision tree rules"] = dt_txt
        print(f"  ✓ {dt_txt.name}")

    # Compute eligibility breakdowns for the report.
    df_el_full = df[df["eligible_for_model_ranking"]]
    df_in_full = df[~df["eligible_for_model_ranking"]]
    label_counts_eligible = {i: int((df_el_full["label"] == i).sum()) for i in range(5)}
    label_counts_ineligible = {i: int((df_in_full["label"] == i).sum()) for i in range(5)}
    reason_counts_for_report: dict[str, int] = {
        "anti_thesis_conflict": 0,
        "stage_mismatch": 0,
        "check_size_mismatch": 0,
    }
    multi_reason_report = 0
    for reasons in df_in_full["hard_filter_reasons"]:
        for r in reasons:
            if r in reason_counts_for_report:
                reason_counts_for_report[r] += 1
        if len(reasons) > 1:
            multi_reason_report += 1

    label_counts_pool = {i: int((df_train_pool["label"] == i).sum()) for i in range(5)}

    report = write_eval_report(
        metrics_all=metrics_all,
        cv_results=cv_results,
        label_counts=label_counts_pool,
        n_train=len(X_train),
        n_test=len(X_test),
        artifact_paths=artifact_paths,
        out_dir=out_dir,
        training_mode=training_mode,
        n_total=n_total,
        n_eligible=n_eligible,
        n_ineligible=n_ineligible,
        n_cv_folds=n_cv_folds,
        label_counts_eligible=label_counts_eligible,
        label_counts_ineligible=label_counts_ineligible,
        reason_counts=reason_counts_for_report,
        multi_reason_count=multi_reason_report,
        ineligible_diagnostic=ineligible_diagnostic,
        oof_metrics=oof_metrics_,
    )
    artifact_paths["Evaluation report"] = report
    print(f"  ✓ {report.name}")

    print(f"\n{'═' * 72}")
    print(f"  Done. {len(artifact_paths)} artifacts saved to:")
    print(f"  {out_dir}")
    print(f"  Training mode: {training_mode}")
    print("  ⚠  Synthetic experimental only. Not for production use.")
    print("═" * 72 + "\n")


if __name__ == "__main__":
    main()
