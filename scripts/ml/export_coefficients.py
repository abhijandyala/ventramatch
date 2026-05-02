#!/usr/bin/env python3
"""
scripts/ml/export_coefficients.py

Export LogReg C=2.0 Phase 11c champion model coefficients for use in the
TypeScript production shadow scorer (Phase 15).

─── NOTICE ──────────────────────────────────────────────────────────────────
  • All training data is SYNTHETIC.  No real user data is used.
  • This model is NOT investment advice.
  • It does NOT predict startup success or investment returns.
  • The exported coefficients are for offline shadow scoring only.
  • scoreMatch in lib/matching/score.ts remains the production baseline.
─────────────────────────────────────────────────────────────────────────────

Reproduces Phase 11c exactly:
  • eligible-only pairs.json
  • LogReg C=2.0, StandardScaler, random_state=42
  • same FEATURE_COLS and null-imputation (null → 0.0) as train_synthetic_matching.py

Usage (from repo root):
    npm run export-coefficients
    # or:
    python3 scripts/ml/export_coefficients.py

Outputs:
    data/synthetic-matching/artifacts/learning_model_coefficients.json
    (TypeScript-pasteable block printed to stdout)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

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
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
except ImportError:
    _MISSING.append("scikit-learn")

if _MISSING:
    print("ERROR: Missing Python dependencies:", ", ".join(_MISSING))
    print()
    print("Install with:")
    print("  cd scripts/ml")
    print("  source .venv/bin/activate")
    print("  pip install -r requirements.txt")
    sys.exit(1)

# ── Constants matching train_synthetic_matching.py exactly ────────────────────

REPO_ROOT  = Path(__file__).resolve().parent.parent.parent
PAIRS_PATH = REPO_ROOT / "data" / "synthetic-matching" / "pairs.json"
OUTPUT_PATH = REPO_ROOT / "data" / "synthetic-matching" / "artifacts" / "learning_model_coefficients.json"

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
    "semantic_similarity_score",   # null → 0.0 imputed at load time
]

RANDOM_SEED = 42
C_VALUE     = 2.0
COEFFICIENTS_VERSION = "11c-logreg-c2.0-1.0.0"


def load_eligible(path: Path) -> "pd.DataFrame":
    with path.open(encoding="utf-8") as fh:
        pairs = json.load(fh)

    rows = []
    n_sem_null = 0
    for p in pairs:
        if not p.get("eligible_for_model_ranking", True):
            continue   # eligible-only, matching train_synthetic_matching.py default
        row = {
            "startup_id":  p["startup_id"],
            "investor_id": p["investor_id"],
            "label":       int(p["label"]),
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
    print(f"  Loaded {len(df)} eligible pairs ({n_sem_null} with null semantic score → 0.0)")
    return df


def train_pipeline(df: "pd.DataFrame") -> Pipeline:
    X = df[FEATURE_COLS].values.astype(float)
    y = df["label"].values.astype(int)

    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    LogisticRegression(
                max_iter=1000,
                solver="lbfgs",
                C=C_VALUE,
                random_state=RANDOM_SEED,
            )),
        ])
        pipeline.fit(X, y)

    return pipeline


def export_model(pipeline: Pipeline, df: "pd.DataFrame") -> dict:
    scaler: StandardScaler = pipeline.named_steps["scaler"]
    clf: LogisticRegression = pipeline.named_steps["clf"]

    X = df[FEATURE_COLS].values.astype(float)
    y = df["label"].values.astype(int)

    # Validate: replicate predict and measure accuracy
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        y_pred = pipeline.predict(X)
    acc = float(np.mean(y_pred == y))
    print(f"  Training accuracy: {acc:.4f}  (expected ~0.83–0.87 for LogReg C=2.0)")

    coef_list   = clf.coef_.tolist()          # shape (5, 12)
    intercept   = clf.intercept_.tolist()     # shape (5,)
    classes     = clf.classes_.tolist()       # [0, 1, 2, 3, 4]
    scaler_mean = scaler.mean_.tolist()       # shape (12,)
    scaler_std  = scaler.scale_.tolist()      # sklearn uses scale_ not std_ for this

    return {
        "version":              COEFFICIENTS_VERSION,
        "model_class":          "LogisticRegression",
        "C":                    C_VALUE,
        "random_state":         RANDOM_SEED,
        "n_training_samples":   len(df),
        "feature_order":        FEATURE_COLS,
        "classes":              classes,
        "scaler_mean":          scaler_mean,
        "scaler_scale":         scaler_std,
        "coef":                 coef_list,
        "intercept":            intercept,
        "training_accuracy":    round(acc, 4),
        "notice":               (
            "SYNTHETIC EXPERIMENTAL ONLY. Not investment advice. "
            "Does not predict startup success or investment returns. "
            "scoreMatch in lib/matching/score.ts is the production baseline."
        ),
    }


def print_ts_block(data: dict) -> None:
    """Print a TypeScript-pasteable constant block for coefficients.ts."""
    import json as _json

    print()
    print("─" * 72)
    print("PASTE INTO lib/matching/learning-model/coefficients.ts:")
    print("─" * 72)
    print(f'export const COEFFICIENTS_VERSION = "{data["version"]}";')
    print()
    print(f'export const FEATURE_ORDER: readonly string[] = {_json.dumps(data["feature_order"])};')
    print()
    print(f'export const CLASSES: readonly number[] = {_json.dumps(data["classes"])};')
    print()
    print(f'export const SCALER_MEAN: readonly number[] = {_json.dumps([round(x, 8) for x in data["scaler_mean"]])};')
    print()
    print(f'export const SCALER_SCALE: readonly number[] = {_json.dumps([round(x, 8) for x in data["scaler_scale"]])};')
    print()
    coef_str = "[\n" + ",\n".join(
        "  [" + ", ".join(f"{v:.8f}" for v in row) + "]"
        for row in data["coef"]
    ) + "\n]"
    print(f'export const COEF: readonly (readonly number[])[] = {coef_str};')
    print()
    intercept_str = "[" + ", ".join(f"{v:.8f}" for v in data["intercept"]) + "]"
    print(f'export const INTERCEPT: readonly number[] = {intercept_str};')
    print("─" * 72)


def main() -> None:
    print()
    print("═" * 72)
    print("  COEFFICIENT EXPORT — Phase 15")
    print("═" * 72)
    print("  ⚠  Training data is SYNTHETIC. Not investment advice.")
    print("═" * 72)

    if not PAIRS_PATH.exists():
        print(f"ERROR: {PAIRS_PATH} not found.")
        print("Run: npm run generate:synthetic-matches")
        sys.exit(1)

    print(f"\nLoading {PAIRS_PATH.name} …")
    df = load_eligible(PAIRS_PATH)

    print(f"\nTraining LogReg C={C_VALUE} on {len(df)} eligible pairs …")
    pipeline = train_pipeline(df)

    print("\nExporting …")
    data = export_model(pipeline, df)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"  ✓  Wrote coefficients to: {OUTPUT_PATH}")

    print_ts_block(data)

    print(f"\n{'═' * 72}")
    print(f"  Done. Version: {data['version']}")
    print(f"  Training accuracy: {data['training_accuracy']}")
    print("  ⚠  Offline experimental only. Not for production ranking.")
    print("═" * 72 + "\n")


if __name__ == "__main__":
    main()
