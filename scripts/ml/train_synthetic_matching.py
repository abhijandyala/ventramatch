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

Usage (run from repo root):
    python3 scripts/ml/train_synthetic_matching.py
    python3 scripts/ml/train_synthetic_matching.py --validate-only
    python3 scripts/ml/train_synthetic_matching.py --output-dir /custom/path

See scripts/ml/README.md for setup instructions.

Requires Python 3.9+  (uses `from __future__ import annotations` for 3.10-style type hints)
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# ── Dependency guard ──────────────────────────────────────────────────────────
# Checked up-front so the error message is actionable, not a raw ImportError
# buried in a stack trace.

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
    matplotlib.use("Agg")  # non-interactive — never opens a window
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

# The 12 numeric features from MatchFeatures in lib/matching/features.ts.
# semantic_similarity_score is null when compute_embeddings.py has not been run;
# null values are imputed to 0.0 at load time (see load_and_validate).
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
    "semantic_similarity_score",   # Phase 7: cosine similarity from MiniLM-L6-v2
]

# Labeling formula weights from generate-synthetic-match-pairs.ts, listed for
# comparison against model-learned feature importances.
# anti_thesis is a penalty so its "expected importance" ≈ 0.40.
# profile_completeness has zero weight in the score formula (zero variance in synthetic data).
# semantic_similarity_score has zero labeling weight — labels are derived from
# structured features only. The model may still learn this feature as predictive.
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
    "anti_thesis_conflict_score": 0.40,  # shown as absolute value for importance chart
    "profile_completeness_score": 0.00,
    "semantic_similarity_score": 0.00,   # not in labeling formula (Phase 7)
}

RANDOM_SEED = 42

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
    return p.parse_args()


# ── Data loading & validation ─────────────────────────────────────────────────


def load_and_validate(path: Path) -> "pd.DataFrame":
    """Load pairs.json, validate schema, and return a flat DataFrame."""
    if not path.exists():
        print(f"ERROR: {path} not found.")
        print("Run:  npm run generate:synthetic-matches")
        sys.exit(1)

    with path.open(encoding="utf-8") as fh:
        pairs: list[dict[str, Any]] = json.load(fh)

    if not pairs:
        print("ERROR: pairs.json is empty.")
        sys.exit(1)

    # Schema check
    required_keys = {"startup_id", "investor_id", "features", "label", "label_name"}
    missing_top = required_keys - set(pairs[0].keys())
    if missing_top:
        print(f"ERROR: pairs.json records missing keys: {missing_top}")
        sys.exit(1)

    missing_feat = set(FEATURE_COLS) - set(pairs[0]["features"].keys())
    if missing_feat:
        print(f"ERROR: feature fields missing from pairs.json: {missing_feat}")
        sys.exit(1)

    rows: list[dict[str, Any]] = []
    n_sem_null = 0  # count null semantic_similarity_score values

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
        rows.append(row)

    df = pd.DataFrame(rows)

    # Report null imputation for semantic similarity
    if n_sem_null > 0:
        pct = n_sem_null / len(rows) * 100
        if n_sem_null == len(rows):
            print(
                f"  ⚠  semantic_similarity_score: all {n_sem_null} values are null (imputed 0.0).\n"
                "     Run: npm run embeddings:synthetic-matches  to compute embeddings first.\n"
                "     The model will train without semantic signal this run.\n"
            )
        else:
            print(
                f"  ⚠  semantic_similarity_score: {n_sem_null}/{len(rows)} ({pct:.1f}%) null values "
                "imputed to 0.0. Partial embedding data — some pairs lack cosine similarity.\n"
            )
    else:
        print(
            f"  ✓  semantic_similarity_score: all {len(rows)} values present "
            "(embeddings loaded from compute_embeddings.py).\n"
        )

    return df


def print_dataset_stats(df: "pd.DataFrame") -> None:
    n = len(df)
    print(f"\n{'─' * 72}")
    print("DATASET STATISTICS")
    print(f"{'─' * 72}")
    print(f"  Total pairs : {n}")
    print(f"  Features    : {len(FEATURE_COLS)} numeric (semantic_similarity_placeholder excluded)")
    print()

    print("  Label distribution:")
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
        null_n = df[col].isna().sum()
        null_note = f"  [{null_n} null]" if null_n else ""
        print(f"    {col:<38}  {mn:+.3f} / {mu:+.3f} / {mx:+.3f}{null_note}")
    print(f"{'─' * 72}\n")


# ── Models ────────────────────────────────────────────────────────────────────


def get_models() -> dict[str, Any]:
    return {
        # StandardScaler avoids lbfgs numerical overflow on unscaled features.
        # Coefficients are accessed via pipeline.named_steps["clf"] in importance plot.
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


# ── Cross-validation ──────────────────────────────────────────────────────────


def run_cross_validation(
    models: dict[str, Any],
    X: "np.ndarray",
    y: "np.ndarray",
) -> dict[str, dict[str, "np.ndarray"]]:
    """5-fold stratified CV for each model. Returns per-model score arrays."""
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    scoring = ["accuracy", "f1_macro", "f1_weighted"]

    results: dict[str, dict[str, "np.ndarray"]] = {}
    for name, model in models.items():
        try:
            scores = cross_validate(model, X, y, cv=cv, scoring=scoring, n_jobs=-1)
        except Exception:
            # Fall back to single-threaded if n_jobs=-1 causes issues
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

    return results


# ── Evaluation ────────────────────────────────────────────────────────────────


def evaluate_model(
    model_name: str,
    model: Any,
    X_test: "np.ndarray",
    y_test: "np.ndarray",
) -> dict[str, Any]:
    """Evaluate a trained model on the held-out test set."""
    y_pred: "np.ndarray" = model.predict(X_test)
    y_proba: "np.ndarray | None" = (
        model.predict_proba(X_test) if hasattr(model, "predict_proba") else None
    )

    acc = accuracy_score(y_test, y_pred)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
    f1_weighted = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    mae = mean_absolute_error(y_test, y_pred)
    report_dict: dict[str, Any] = classification_report(
        y_test,
        y_pred,
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


# ── Artifact helpers ──────────────────────────────────────────────────────────


def save_confusion_matrix_plot(
    y_test: "np.ndarray",
    y_pred: "np.ndarray",
    model_name: str,
    out_dir: Path,
) -> Path:
    """Save a labeled 5×5 confusion matrix heatmap (counts + row-%)."""
    cm = confusion_matrix(y_test, y_pred, labels=list(range(5)))

    # Build annotation: count + row-percentage
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
        cm,
        annot=annot,
        fmt="",
        xticklabels=short_names,
        yticklabels=short_names,
        cmap="Blues",
        linewidths=0.5,
        ax=ax,
    )
    ax.set_xlabel("Predicted label", fontsize=11)
    ax.set_ylabel("True label", fontsize=11)
    ax.set_title(
        f"Confusion Matrix - {model_name}\n"
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
    label_keys = [
        f"{i}_{LABEL_NAMES[i].replace(' ', '_')}" for i in range(5)
    ]
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
    """Save a horizontal bar chart comparing model importance vs labeling weight."""
    # Unwrap sklearn Pipeline to access the underlying estimator.
    est = model.named_steps.get("clf", model) if hasattr(model, "named_steps") else model

    if hasattr(est, "feature_importances_"):
        importances: "np.ndarray" = est.feature_importances_
        method_note = "native feature importances"
    elif hasattr(est, "coef_"):
        # Multi-class LogReg: mean |coefficient| across 5 classes
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
        sorted_expected,
        y_pos,
        "o--",
        color="#E8782A",
        linewidth=1.2,
        markersize=5,
        alpha=0.8,
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
) -> Path:
    """Save per-pair predictions from all models for manual spot-checking."""
    out = df_test[["startup_id", "investor_id", "label", "label_name", "label_reason"]].copy()
    out = out.rename(columns={"label": "true_label", "label_name": "true_label_name"})

    for model_name, m in metrics_all.items():
        key = model_name.lower()
        out[f"pred_{key}"] = m["y_pred"]
        out[f"correct_{key}"] = (m["y_pred"] == out["true_label"].values).astype(int)
        out[f"error_{key}"] = np.abs(m["y_pred"].astype(int) - out["true_label"].values.astype(int))
        if m["y_proba"] is not None:
            for k in range(5):
                out[f"prob_{k}_{key}"] = m["y_proba"][:, k].round(4)

    out_path = out_dir / "predictions.csv"
    out.to_csv(out_path, index=False)
    return out_path


def save_decision_tree_txt(
    model: Any,
    feature_names: list[str],
    out_dir: Path,
) -> Path:
    """Export a human-readable text rule set from the shallow decision tree."""
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
    tree_text = export_text(
        model,
        feature_names=feature_names,
        max_depth=6,
        show_weights=True,
    )
    out_path = out_dir / "decision_tree.txt"
    out_path.write_text(disclaimer + tree_text, encoding="utf-8")
    return out_path


def write_eval_report(
    metrics_all: dict[str, dict[str, Any]],
    cv_results: dict[str, dict[str, "np.ndarray"]],
    label_counts: dict[int, int],
    n_train: int,
    n_test: int,
    artifact_paths: dict[str, Path | None],
    out_dir: Path,
) -> Path:
    """Write eval_report.md."""
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    total = n_train + n_test

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
        "",
    ]

    # ── Dataset summary ───────────────────────────────────────────────────────
    lines += [
        "## Dataset",
        "",
        "| Property | Value |",
        "|---|---|",
        f"| Source | `data/synthetic-matching/pairs.json` |",
        f"| Total pairs | {total} (35 synthetic startups × 17 synthetic investors) |",
        f"| Training set | {n_train} pairs (80%, stratified) |",
        f"| Test set | {n_test} pairs (20%, stratified) |",
        f"| Features | {len(FEATURE_COLS)} numeric (`semantic_similarity_placeholder` excluded) |",
        f"| Target | Label 0–4 (5-class classification) |",
        f"| Random seed | {RANDOM_SEED} |",
        "",
        "### Label distribution (full dataset)",
        "",
        "| Label | Name | Count | % |",
        "|---|---|---|---|",
    ]
    for i, name in enumerate(LABEL_NAMES):
        c = label_counts.get(i, 0)
        pct = c / total * 100
        lines.append(f"| {i} | {name} | {c} | {pct:.1f}% |")
    lines += [
        "",
        "### Label definitions",
        "",
        "| Label | Meaning |",
        "|---|---|",
        "| 0 — poor fit | No meaningful overlap — sector, stage, or check mismatch |",
        "| 1 — weak fit | One or two weak signals align; most dimensions do not |",
        "| 2 — possible fit | Moderate overlap; meaningful gaps remain |",
        "| 3 — strong fit | Solid alignment across sector, stage, check, and customer type |",
        "| 4 — excellent fit | High alignment across all dimensions; no anti-thesis conflict |",
        "",
    ]

    # ── Feature table ─────────────────────────────────────────────────────────
    lines += [
        "## Features",
        "",
        "| Feature | Formula weight | Notes |",
        "|---|---|---|",
        "| `sector_overlap_score` | +0.20 | Fraction of startup sectors in investor mandate (canonical) |",
        "| `stage_match_score` | +0.18 | 1.0 exact / 0.5 adjacent / 0.2 two-step / 0 none |",
        "| `check_size_score` | +0.15 | 1.0 in range; linear falloff outside |",
        "| `interest_overlap_score` | +0.12 | Synonym-expanded onboarding interest overlap |",
        "| `customer_type_overlap_score` | +0.10 | Compatibility matrix (smb↔enterprise=0.5, etc.) |",
        "| `business_model_overlap_score` | +0.08 | Compatibility matrix (subscription≈enterprise_license) |",
        "| `geography_score` | +0.07 | 1.0 confirmed match; 0.2 tension |",
        "| `lead_follow_score` | +0.05 | Investor role vs startup engagement signals |",
        "| `traction_strength_score` | +0.05 | no_traction=0 … enterprise_contracts=1 |",
        "| `anti_thesis_conflict_score` | **−0.40 penalty** | 1 = worst conflict; 0 = none |",
        "| `profile_completeness_score` | 0 (not in score) | Structural completeness of both profiles (zero variance in synthetic data) |",
        "| `semantic_similarity_score` | 0 (not in labeling formula) | Cosine sim from `all-MiniLM-L6-v2`; null → 0.0 if embeddings not computed |",
        "",
    ]

    # ── 5-fold CV ─────────────────────────────────────────────────────────────
    lines += [
        "## 5-fold cross-validation",
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
        "> **Expected**: high accuracy (~95–99%) because the model is fitting a",
        "> deterministic labeling function. This is a **pipeline sanity check**,",
        "> not evidence of real-world matching ability.",
        "",
    ]

    # ── Test-set results ──────────────────────────────────────────────────────
    lines += [
        "## Test-set evaluation (80/20 stratified split)",
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

    # Per-class for GBM (primary)
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

    # ── Feature importance interpretation ─────────────────────────────────────
    lines += [
        "## Feature importance interpretation",
        "",
        "The feature importance chart overlays model-learned importances against the",
        "labeling formula weights (orange dashed line). Close agreement confirms the",
        "pipeline is wired correctly. Divergences typically reflect non-linear cap",
        "effects — the `anti_thesis_conflict`, `stage_match`, and `check_size` caps",
        "create threshold interactions that linear formula weights cannot capture.",
        "",
        "**Expected ranking** (by absolute labeling formula weight):",
        "",
        "> `semantic_similarity_score` and `profile_completeness_score` have zero labeling",
        "> weight but may still appear in model importance if they correlate with labels.",
        "",
    ]
    ranked = sorted(
        [(k, abs(v)) for k, v in LABELING_WEIGHTS.items()],
        key=lambda x: x[1],
        reverse=True,
    )
    for i, (feat, w) in enumerate(ranked, 1):
        note = " ← penalty (inverted)" if feat == "anti_thesis_conflict_score" else ""
        if feat == "profile_completeness_score":
            note = " ← zero labeling weight; zero variance in synthetic data"
        elif feat == "semantic_similarity_score":
            note = " ← zero labeling weight; model may learn correlation with labels"
        lines.append(f"{i}. `{feat}` — abs labeling weight {w:.2f}{note}")
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

    # ── Caveats ───────────────────────────────────────────────────────────────
    lines += [
        "---",
        "",
        "## Important caveats",
        "",
        "1. **Not real data.** All 595 pairs were generated from fictional synthetic profiles.",
        "   The model's high accuracy is expected — it is recovering a deterministic rule.",
        "2. **Tautological accuracy.** Any model trained on these labels will score ~95–99%",
        "   because the labels were generated by a fixed formula, not by human judgment.",
        "3. **No semantic understanding.** `semantic_similarity_placeholder` is `null` in",
        "   all pairs. Thesis text, one-liner, and founder background are not yet embedded.",
        "   A real model would need `text-embedding-3-small` or similar.",
        "4. **Class imbalance in small test buckets.** With ~10 strong-fit and ~7",
        "   excellent-fit test samples, per-class F1 in those buckets is noisy.",
        "5. **No production deployment.** `scoreMatch` in `lib/matching/score.ts` is the",
        "   safe production baseline. Do not replace it with this model without validation",
        "   on real post-launch interaction data.",
        "",
    ]

    out_path = out_dir / "eval_report.md"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


# ── Main ──────────────────────────────────────────────────────────────────────


def main() -> None:
    args = parse_args()
    out_dir: Path = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    # Style seaborn/matplotlib
    try:
        sns.set_theme(style="whitegrid", font_scale=0.95)
    except Exception:
        pass

    # Banner
    print("\n" + "═" * 72)
    print("  SYNTHETIC MATCHING MODEL — EXPERIMENTAL PIPELINE")
    print("═" * 72)
    print("  ⚠  Training on synthetic labels. NOT investment advice.")
    print("  ⚠  Labels are rule-generated, not real investor behaviour.")
    print("═" * 72)

    # ── Load ──────────────────────────────────────────────────────────────────
    print(f"\nLoading {PAIRS_PATH} …")
    df = load_and_validate(PAIRS_PATH)
    print_dataset_stats(df)

    if args.validate_only:
        print("--validate-only set. Stopping before training.\n")
        return

    # ── Prepare matrices ──────────────────────────────────────────────────────
    X: "np.ndarray" = df[FEATURE_COLS].values.astype(float)
    y: "np.ndarray" = df["label"].values.astype(int)

    # Stratified 80/20 split (reproducible via RANDOM_SEED)
    all_indices = np.arange(len(df))
    idx_train, idx_test = train_test_split(
        all_indices, test_size=0.20, stratify=y, random_state=RANDOM_SEED
    )
    X_train, X_test = X[idx_train], X[idx_test]
    y_train, y_test = y[idx_train], y[idx_test]
    df_test = df.iloc[idx_test].reset_index(drop=True)

    print(f"Train: {len(X_train)} pairs  |  Test: {len(X_test)} pairs\n")

    # ── 5-fold CV ─────────────────────────────────────────────────────────────
    print(f"{'─' * 72}")
    print("5-FOLD STRATIFIED CROSS-VALIDATION  (training data only)")
    print(f"{'─' * 72}")
    models = get_models()
    cv_results = run_cross_validation(models, X_train, y_train)

    # ── Train on full train split ─────────────────────────────────────────────
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

    # ── Save artifacts ────────────────────────────────────────────────────────
    print(f"\n{'─' * 72}")
    print(f"SAVING ARTIFACTS  →  {out_dir}")
    print(f"{'─' * 72}")

    artifact_paths: dict[str, Path | None] = {}

    for name, model in trained_models.items():
        m = metrics_all[name]

        cm_plot = save_confusion_matrix_plot(y_test, m["y_pred"], name, out_dir)
        artifact_paths[f"Confusion matrix — {name} (PNG)"] = cm_plot
        print(f"  ✓ {cm_plot.name}")

        cm_csv = save_confusion_matrix_csv(y_test, m["y_pred"], name, out_dir)
        artifact_paths[f"Confusion matrix — {name} (CSV)"] = cm_csv
        print(f"  ✓ {cm_csv.name}")

        imp = save_feature_importance_plot(name, model, FEATURE_COLS, out_dir)
        if imp:
            artifact_paths[f"Feature importance — {name}"] = imp
            print(f"  ✓ {imp.name}")

    pred_csv = save_predictions_csv(df_test, metrics_all, out_dir)
    artifact_paths["Predictions CSV (all models)"] = pred_csv
    print(f"  ✓ {pred_csv.name}")

    dt_model = trained_models.get("DecisionTree")
    if dt_model is not None:
        dt_txt = save_decision_tree_txt(dt_model, FEATURE_COLS, out_dir)
        artifact_paths["Decision tree rules"] = dt_txt
        print(f"  ✓ {dt_txt.name}")

    label_counts = {i: int((df["label"] == i).sum()) for i in range(5)}
    report = write_eval_report(
        metrics_all=metrics_all,
        cv_results=cv_results,
        label_counts=label_counts,
        n_train=len(X_train),
        n_test=len(X_test),
        artifact_paths=artifact_paths,
        out_dir=out_dir,
    )
    artifact_paths["Evaluation report"] = report
    print(f"  ✓ {report.name}")

    print(f"\n{'═' * 72}")
    print(f"  Done. {len(artifact_paths)} artifacts saved to:")
    print(f"  {out_dir}")
    print("  ⚠  Synthetic experimental only. Not for production use.")
    print("═" * 72 + "\n")


if __name__ == "__main__":
    main()
