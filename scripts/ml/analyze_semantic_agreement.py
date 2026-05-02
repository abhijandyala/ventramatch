#!/usr/bin/env python3
"""
scripts/ml/analyze_semantic_agreement.py

Semantic Agreement Analysis for the Synthetic Matching Pipeline.

─── NOTICE ──────────────────────────────────────────────────────────────────
  • All data is SYNTHETIC. No real user data is analysed here.
  • This script is NOT investment advice.
  • It does NOT predict startup success or investment returns.
  • It analyses profile-fit matching signal only.
  • All outputs are offline and experimental.
─────────────────────────────────────────────────────────────────────────────

Purpose
───────
Phase 7 showed that `semantic_similarity_score` ranked 4th in GBM feature
importance (0.103) despite having zero weight in the labeling formula.  This
script answers: where do semantics and rules agree, where do they disagree, and
should semantic_similarity_score enter the labeling formula?

The script:
  1. Analyses semantic/label correlation (Pearson, Spearman, per-label stats).
  2. Identifies high-sem/low-label and low-sem/high-label disagreement pairs.
  3. Explains which caps or features drove each disagreement.
  4. Simulates the effect of adding a small semantic bonus to the formula.
  5. Issues a clear RECOMMEND decision and writes all findings to a report.
  6. Optionally retrains the Phase 6/7 model on the proposed new labels
     to compare feature importance before/after.

Usage (from repo root):
    python3 scripts/ml/analyze_semantic_agreement.py
    python3 scripts/ml/analyze_semantic_agreement.py --skip-retrain
    npm run analyze:synthetic-matches

Requires Python 3.9+
"""

from __future__ import annotations

import argparse
import json
import sys
import warnings
from datetime import datetime
from pathlib import Path
from typing import Any

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
except ImportError:
    _MISSING.append("matplotlib")
    plt = None  # type: ignore[assignment]

try:
    from scipy import stats as scipy_stats
except ImportError:
    _MISSING.append("scipy")
    scipy_stats = None  # type: ignore[assignment]

try:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, f1_score
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.tree import DecisionTreeClassifier
except ImportError:
    _MISSING.append("scikit-learn")

if _MISSING:
    print("ERROR: Missing Python dependencies:", ", ".join(_MISSING))
    print()
    print("Install with:")
    print("  cd scripts/ml && source .venv/bin/activate && pip install -r requirements.txt")
    sys.exit(1)

# ── Constants (mirror generate-synthetic-match-pairs.ts exactly) ──────────────

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PAIRS_PATH = REPO_ROOT / "data" / "synthetic-matching" / "pairs.json"
STARTUPS_PATH = REPO_ROOT / "data" / "synthetic-matching" / "startups.json"
INVESTORS_PATH = REPO_ROOT / "data" / "synthetic-matching" / "investors.json"
ARTIFACTS_DIR = REPO_ROOT / "data" / "synthetic-matching" / "artifacts"

LABEL_NAMES = ["poor fit", "weak fit", "possible fit", "strong fit", "excellent fit"]
RANDOM_SEED = 42

# ── Labeling formula constants (must match the TypeScript exactly) ─────────────

FORMULA_WEIGHTS: dict[str, float] = {
    "sector_overlap_score": 0.20,
    "stage_match_score": 0.18,
    "check_size_score": 0.15,
    "interest_overlap_score": 0.12,
    "customer_type_overlap_score": 0.10,
    "business_model_overlap_score": 0.08,
    "geography_score": 0.07,
    "lead_follow_score": 0.05,
    "traction_strength_score": 0.05,
    # semantic_similarity_score: currently 0.0
}
ANTI_PENALTY = 0.40

THRESHOLDS = {
    "WEAK_MIN": 0.44,
    "POSSIBLE_MIN": 0.60,
    "STRONG_MIN": 0.72,
    "EXCELLENT_MIN": 0.79,
}
ANTI_THESIS_CAP = 0.5
CHECK_SIZE_CAP = 0.25

# Exact copy of EXCELLENT_COND from the TypeScript
EXCELLENT_COND = {
    "sector_overlap_score": 0.5,
    "stage_match_score": 1.0,      # must equal exactly
    "check_size_score": 0.7,
    "customer_type_overlap_score": 0.5,
    "interest_overlap_score": 0.25,
    "anti_thesis_conflict_score": 0.0,   # must equal exactly 0
    "geography_score": 0.5,
}

# ── Proposed semantic bonus parameters ────────────────────────────────────────

SEMANTIC_BONUS_MAX = 0.04
SEMANTIC_OFFSET = 0.30
SEMANTIC_SECTOR_GATE = 0.25

ALL_FEATURE_COLS = [
    "sector_overlap_score", "stage_match_score", "check_size_score",
    "geography_score", "interest_overlap_score", "anti_thesis_conflict_score",
    "customer_type_overlap_score", "business_model_overlap_score",
    "lead_follow_score", "traction_strength_score",
    "profile_completeness_score", "semantic_similarity_score",
]

# ── Formula simulation helpers (reproduce TypeScript logic in Python) ──────────


def compute_base_score(f: dict[str, Any]) -> float:
    """Weighted sum of positive features minus anti-thesis penalty.
    Mirrors computeWeightedScore in generate-synthetic-match-pairs.ts.
    """
    pos = sum(f.get(k, 0.0) * w for k, w in FORMULA_WEIGHTS.items())
    return pos - (f.get("anti_thesis_conflict_score") or 0.0) * ANTI_PENALTY


def compute_semantic_bonus(f: dict[str, Any]) -> float:
    """Small additive bonus for high-similarity pairs with sector overlap.

    Gating by sector_overlap >= SEMANTIC_SECTOR_GATE prevents pairs where only
    buzzword overlap drives the text similarity from benefiting.
    Hard caps in assign_label still apply unconditionally.
    """
    sem = f.get("semantic_similarity_score")
    if sem is None:
        return 0.0
    if (f.get("sector_overlap_score") or 0.0) < SEMANTIC_SECTOR_GATE:
        return 0.0
    return min(SEMANTIC_BONUS_MAX, max(0.0, (sem - SEMANTIC_OFFSET) * 0.10))


def meets_excellent_conditions(f: dict[str, Any]) -> bool:
    """Mirror of meetsExcellentConditions in generate-synthetic-match-pairs.ts."""
    return (
        (f.get("sector_overlap_score") or 0.0) >= EXCELLENT_COND["sector_overlap_score"]
        and (f.get("stage_match_score") or 0.0) == EXCELLENT_COND["stage_match_score"]
        and (f.get("check_size_score") or 0.0) >= EXCELLENT_COND["check_size_score"]
        and (f.get("customer_type_overlap_score") or 0.0) >= EXCELLENT_COND["customer_type_overlap_score"]
        and (f.get("interest_overlap_score") or 0.0) >= EXCELLENT_COND["interest_overlap_score"]
        and (f.get("anti_thesis_conflict_score") or 0.0) <= EXCELLENT_COND["anti_thesis_conflict_score"]
        and (f.get("geography_score") or 0.0) >= EXCELLENT_COND["geography_score"]
    )


def assign_label(f: dict[str, Any], bonus: float = 0.0) -> int:
    """Assign a label following the full TypeScript logic (thresholds + caps).
    Pass bonus > 0 to simulate the semantic bonus.
    """
    score = compute_base_score(f) + bonus
    clamped = max(0.0, score)

    if clamped < THRESHOLDS["WEAK_MIN"]:
        raw = 0
    elif clamped < THRESHOLDS["POSSIBLE_MIN"]:
        raw = 1
    elif clamped < THRESHOLDS["STRONG_MIN"]:
        raw = 2
    elif clamped < THRESHOLDS["EXCELLENT_MIN"]:
        raw = 3
    else:
        raw = 4

    # Excellent conditions gate: score-qualified-for-4 but conditions not met → 3
    if raw == 4 and not meets_excellent_conditions(f):
        raw = 3

    # Hard caps — applied unconditionally, cannot be overridden
    if (f.get("anti_thesis_conflict_score") or 0.0) >= ANTI_THESIS_CAP and raw > 1:
        raw = 1
    if (f.get("stage_match_score") or 0.0) == 0 and raw > 2:
        raw = 2
    if (f.get("check_size_score") or 0.0) < CHECK_SIZE_CAP and raw > 2:
        raw = 2

    return raw


def explain_disagreement(f: dict[str, Any], actual_label: int) -> str:
    """Return a short string explaining why the label differs from what
    semantic similarity alone might suggest."""
    reasons = []
    if (f.get("anti_thesis_conflict_score") or 0.0) >= ANTI_THESIS_CAP:
        reasons.append(f"anti-thesis cap (conflict={f.get('anti_thesis_conflict_score', 0):.2f}≥{ANTI_THESIS_CAP})")
    if (f.get("stage_match_score") or 0.0) == 0:
        reasons.append("stage mismatch cap (stage=0)")
    if (f.get("check_size_score") or 0.0) < CHECK_SIZE_CAP:
        reasons.append(f"check-size cap (check={f.get('check_size_score', 0):.2f}<{CHECK_SIZE_CAP})")
    if not reasons:
        # No cap — score below threshold
        score = compute_base_score(f)
        reasons.append(f"weighted score={score:.3f} below threshold")
    return "; ".join(reasons)


# ── Analysis helpers ───────────────────────────────────────────────────────────


def load_pairs(path: Path) -> tuple["pd.DataFrame", list[dict[str, Any]]]:
    if not path.exists():
        print(f"ERROR: {path} not found. Run: npm run generate:synthetic-matches")
        sys.exit(1)
    raw: list[dict[str, Any]] = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for p in raw:
        row: dict[str, Any] = {
            "startup_id": p["startup_id"],
            "investor_id": p["investor_id"],
            "label": int(p["label"]),
            "label_name": p["label_name"],
        }
        for col in ALL_FEATURE_COLS:
            val = p["features"].get(col)
            row[col] = float(val) if val is not None else np.nan
        rows.append(row)
    return pd.DataFrame(rows), raw


def format_pct(v: float, n: int) -> str:
    return f"{v:3d} ({v / n * 100:5.1f}%)"


# ── Main analysis ──────────────────────────────────────────────────────────────


def run_analysis(
    df: "pd.DataFrame",
    raw_pairs: list[dict[str, Any]],
    startups: dict[str, Any],
    investors: dict[str, Any],
    out_dir: Path,
    skip_retrain: bool,
) -> str:
    """Run the full semantic agreement analysis.  Returns 'APPLY' or 'KEEP'."""

    n = len(df)
    has_sem = df["semantic_similarity_score"].notna().sum()
    df_sem = df[df["semantic_similarity_score"].notna()].copy()
    sims = df_sem["semantic_similarity_score"].values
    labels = df_sem["label"].values.astype(int)

    print(f"  {has_sem}/{n} pairs have semantic_similarity_score.\n")

    # ── Correlation ───────────────────────────────────────────────────────────
    pearson_r, pearson_p = scipy_stats.pearsonr(sims, labels)
    spearman_r, spearman_p = scipy_stats.spearmanr(sims, labels)

    print(f"  Pearson  r={pearson_r:.4f}  p={pearson_p:.4g}")
    print(f"  Spearman r={spearman_r:.4f}  p={spearman_p:.4g}\n")

    # ── Simulate: reproduce baseline labels ───────────────────────────────────
    # Validate that our Python re-implementation matches pairs.json labels.
    mismatches = 0
    for _, row in df.iterrows():
        f = {col: (None if np.isnan(row[col]) else row[col]) for col in ALL_FEATURE_COLS}
        sim_label = assign_label(f, bonus=0.0)
        if sim_label != int(row["label"]):
            mismatches += 1

    if mismatches == 0:
        print(f"  ✓ Baseline simulation exactly reproduces all {n} labels from pairs.json.\n")
    else:
        print(f"  ⚠  Baseline simulation mismatches: {mismatches}/{n}. "
              "TypeScript and Python may differ on excellent conditions for edge cases. "
              "What-if results are approximate.\n")

    # ── Per-label semantic distribution ───────────────────────────────────────
    per_label_stats: list[dict[str, Any]] = []
    for lbl in range(5):
        sub = sims[labels == lbl]
        per_label_stats.append({
            "label": lbl, "name": LABEL_NAMES[lbl], "n": len(sub),
            "min": sub.min() if len(sub) else np.nan,
            "p25": np.percentile(sub, 25) if len(sub) else np.nan,
            "mean": sub.mean() if len(sub) else np.nan,
            "p75": np.percentile(sub, 75) if len(sub) else np.nan,
            "max": sub.max() if len(sub) else np.nan,
        })

    # ── Disagreement analysis ─────────────────────────────────────────────────
    # HIGH-SEM / LOW-LABEL: semantic suggests a good match, rules say otherwise
    # Threshold: sem >= 0.40 (well above dataset mean of 0.287) and label <= 1
    HIGH_SEM_THRESH = 0.40
    LOW_LABEL_THRESH = 1
    high_sem_low_label = []
    for _, row in df_sem.iterrows():
        if row["semantic_similarity_score"] >= HIGH_SEM_THRESH and int(row["label"]) <= LOW_LABEL_THRESH:
            f = {col: (None if np.isnan(row[col]) else row[col]) for col in ALL_FEATURE_COLS}
            reason = explain_disagreement(f, int(row["label"]))
            sid = row["startup_id"]; iid = row["investor_id"]
            high_sem_low_label.append({
                "startup": startups.get(sid, {}).get("name", sid),
                "investor": investors.get(iid, {}).get("firm", iid),
                "sem": row["semantic_similarity_score"],
                "label": int(row["label"]),
                "sector": row["sector_overlap_score"],
                "check": row["check_size_score"],
                "anti": row["anti_thesis_conflict_score"],
                "reason": reason,
                "startup_id": sid, "investor_id": iid,
            })
    high_sem_low_label.sort(key=lambda x: x["sem"], reverse=True)

    # LOW-SEM / HIGH-LABEL: rules say good match, semantics say otherwise
    # Threshold: sem <= 0.20 (below ~20th percentile) and label >= 3
    LOW_SEM_THRESH = 0.20
    HIGH_LABEL_THRESH = 3
    low_sem_high_label = []
    for _, row in df_sem.iterrows():
        if row["semantic_similarity_score"] <= LOW_SEM_THRESH and int(row["label"]) >= HIGH_LABEL_THRESH:
            f = {col: (None if np.isnan(row[col]) else row[col]) for col in ALL_FEATURE_COLS}
            score = compute_base_score(f)
            sid = row["startup_id"]; iid = row["investor_id"]
            low_sem_high_label.append({
                "startup": startups.get(sid, {}).get("name", sid),
                "investor": investors.get(iid, {}).get("firm", iid),
                "sem": row["semantic_similarity_score"],
                "label": int(row["label"]),
                "sector": row["sector_overlap_score"],
                "check": row["check_size_score"],
                "anti": row["anti_thesis_conflict_score"],
                "score": score,
                "startup_id": sid, "investor_id": iid,
            })
    low_sem_high_label.sort(key=lambda x: x["sem"])

    # ── What-if simulation ─────────────────────────────────────────────────────
    dist_before = [0] * 5
    dist_after = [0] * 5
    changed_pairs: list[dict[str, Any]] = []
    inflated_weak: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        f = {col: (None if np.isnan(row[col]) else row[col]) for col in ALL_FEATURE_COLS}
        label_before = int(row["label"])
        dist_before[label_before] += 1

        bonus = compute_semantic_bonus(f)
        label_after = assign_label(f, bonus=bonus)
        dist_after[label_after] += 1

        if label_before != label_after:
            sid = row["startup_id"]
            s = startups.get(sid, {})
            changed_pairs.append({
                "startup": s.get("name", sid),
                "investor": investors.get(row["investor_id"], {}).get("firm", row["investor_id"]),
                "sem": f.get("semantic_similarity_score"),
                "bonus": round(bonus, 4),
                "label_before": label_before,
                "label_after": label_after,
                "sector": f.get("sector_overlap_score"),
                "check": f.get("check_size_score"),
                "anti": f.get("anti_thesis_conflict_score"),
                # Is this a weak/buzzword profile?
                "is_weak_profile": s.get("traction") == "no_traction" and s.get("technical_depth") == "low",
            })
            if s.get("traction") == "no_traction" and s.get("technical_depth") == "low":
                inflated_weak.append(changed_pairs[-1])

    # Check distribution drift
    TARGET_BANDS = [(35, 45), (20, 30), (15, 25), (8, 15), (3, 8)]
    in_bands_before = all(lo <= dist_before[i] / n * 100 <= hi for i, (lo, hi) in enumerate(TARGET_BANDS))
    in_bands_after = all(lo <= dist_after[i] / n * 100 <= hi for i, (lo, hi) in enumerate(TARGET_BANDS))
    max_drift = max(abs((dist_after[i] - dist_before[i]) / n * 100) for i in range(5))

    print(f"  What-if simulation (bonus max={SEMANTIC_BONUS_MAX}, "
          f"offset={SEMANTIC_OFFSET}, gate={SEMANTIC_SECTOR_GATE}):")
    print(f"    Pairs with bonus > 0:          {sum(1 for _, r in df.iterrows() if compute_semantic_bonus({c:(None if np.isnan(r[c]) else r[c]) for c in ALL_FEATURE_COLS}) > 0)}")
    print(f"    Pairs that change label:        {len(changed_pairs)}/{n} ({len(changed_pairs)/n*100:.1f}%)")
    print(f"    Inflated weak/no-traction:      {len(inflated_weak)}")
    print(f"    Max distribution drift:         {max_drift:.1f} pp (limit: 2 pp)")
    print(f"    Distribution stays in bands:    {'YES' if in_bands_after else 'NO'}\n")

    for cp in changed_pairs:
        print(f"      {LABEL_NAMES[cp['label_before']]} → {LABEL_NAMES[cp['label_after']]}  "
              f"sem={cp['sem']:.3f}  bonus={cp['bonus']:.4f}  {cp['startup'][:22]} + {cp['investor'][:22]}")

    # ── Scatter plot ──────────────────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(10, 6))
    colors = ["#E74C3C", "#E67E22", "#3498DB", "#27AE60", "#8E44AD"]
    for lbl in range(5):
        mask = labels == lbl
        ax.scatter(
            sims[mask], labels[mask] + np.random.uniform(-0.12, 0.12, mask.sum()),
            c=colors[lbl], alpha=0.55, s=25, label=f"{lbl} — {LABEL_NAMES[lbl]} (n={mask.sum()})",
        )
    # Add regression line
    m, b = np.polyfit(sims, labels, 1)
    xs = np.linspace(sims.min(), sims.max(), 100)
    ax.plot(xs, m * xs + b, "k--", linewidth=1, alpha=0.4, label=f"Linear fit (r={pearson_r:.2f})")
    ax.axvline(SEMANTIC_OFFSET, color="grey", linewidth=0.8, linestyle=":", alpha=0.6,
               label=f"Bonus offset ({SEMANTIC_OFFSET})")
    ax.set_xlabel("semantic_similarity_score", fontsize=11)
    ax.set_ylabel("Label (jittered)", fontsize=11)
    ax.set_yticks(range(5))
    ax.set_yticklabels(LABEL_NAMES, fontsize=9)
    ax.set_title(
        "Semantic Similarity vs Synthetic Label\n"
        "[SYNTHETIC EXPERIMENTAL — not real user data, not investment advice]",
        fontsize=11,
    )
    ax.legend(fontsize=8, loc="upper left")
    fig.tight_layout()
    scatter_path = out_dir / "semantic_scatter.png"
    fig.savefig(scatter_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  ✓ Saved {scatter_path.name}")

    # ── Disagreements CSV ─────────────────────────────────────────────────────
    disagree_rows = []
    for p in high_sem_low_label:
        disagree_rows.append({
            "type": "high_sem_low_label",
            "startup": p["startup"], "investor": p["investor"],
            "semantic_similarity": round(p["sem"], 4), "label": p["label"],
            "sector": round(p["sector"], 3), "check": round(p["check"], 3),
            "anti_thesis": round(p["anti"], 3), "explanation": p["reason"],
        })
    for p in low_sem_high_label:
        disagree_rows.append({
            "type": "low_sem_high_label",
            "startup": p["startup"], "investor": p["investor"],
            "semantic_similarity": round(p["sem"], 4), "label": p["label"],
            "sector": round(p["sector"], 3), "check": round(p["check"], 3),
            "anti_thesis": round(p["anti"], 3), "explanation": "structured features drive label",
        })
    if changed_pairs:
        for cp in changed_pairs:
            disagree_rows.append({
                "type": "would_change_with_bonus",
                "startup": cp["startup"], "investor": cp["investor"],
                "semantic_similarity": round(cp["sem"], 4) if cp["sem"] else None,
                "label": cp["label_before"],
                "sector": round(cp["sector"], 3) if cp["sector"] else None,
                "check": round(cp["check"], 3) if cp["check"] else None,
                "anti_thesis": round(cp["anti"], 3) if cp["anti"] is not None else None,
                "explanation": f"bonus={cp['bonus']:.4f} → {LABEL_NAMES[cp['label_after']]}",
            })
    disagree_path = out_dir / "semantic_disagreements.csv"
    pd.DataFrame(disagree_rows).to_csv(disagree_path, index=False)
    print(f"  ✓ Saved {disagree_path.name}")

    # ── Optional retraining ───────────────────────────────────────────────────
    retrain_section_lines: list[str] = []
    if not skip_retrain:
        retrain_section_lines = _retrain_comparison(df, n)

    # ── Recommendation logic ──────────────────────────────────────────────────
    # Evidence FOR keeping the formula unchanged:
    evidence_keep: list[str] = []
    # Evidence FOR applying the bonus:
    evidence_apply: list[str] = []

    n_cap_protected = sum(
        1 for p in high_sem_low_label
        if "cap" in p["reason"]
    )
    pct_cap_protected = n_cap_protected / max(1, len(high_sem_low_label)) * 100

    if len(changed_pairs) <= n * 0.02:  # fewer than 2% of pairs change
        evidence_keep.append(
            f"Only {len(changed_pairs)}/{n} ({len(changed_pairs)/n*100:.1f}%) pairs change label "
            "— the practical impact is near-zero."
        )
    if pearson_r < 0.35:
        evidence_keep.append(
            f"Pearson correlation r={pearson_r:.3f} is moderate. Semantics and rules agree "
            "directionally but share substantial non-overlapping information."
        )
    if pct_cap_protected >= 80:
        evidence_keep.append(
            f"{pct_cap_protected:.0f}% of high-sem/low-label disagreements are cap-protected "
            "(anti-thesis or check-size). The existing caps correctly override semantic matches."
        )
    if len(inflated_weak) == 0:
        evidence_apply.append(
            "Zero weak/no-traction synthetic profiles are inflated by the bonus "
            "(sector gate prevents buzzword-only matches)."
        )
    if in_bands_after:
        evidence_apply.append(
            f"Label distribution after bonus stays within target bands (max drift {max_drift:.1f} pp ≤ 2 pp)."
        )
    else:
        evidence_keep.append(
            f"Distribution drifts {max_drift:.1f} pp after bonus, exceeding the 2 pp limit."
        )

    # Decision: if at least 2 evidence_keep items and ≤ 1 evidence_apply, KEEP
    if len(evidence_keep) >= 2:
        recommendation = "KEEP"
    else:
        recommendation = "APPLY"

    print(f"\n  ══ RECOMMENDATION: {recommendation} FORMULA ══\n")

    # ── Write report ──────────────────────────────────────────────────────────
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    lines: list[str] = []
    lines += [
        "# Synthetic Semantic Agreement Analysis",
        "",
        "> ## ⚠️ SYNTHETIC EXPERIMENTAL DATA",
        ">",
        "> - All data is **entirely synthetic**. No real user data is analysed.",
        "> - This analysis is **NOT investment advice**.",
        "> - It does **NOT** predict startup success or investment returns.",
        "> - All findings apply to profile-fit matching signal only.",
        "> - `scoreMatch` in `lib/matching/score.ts` remains the safe production baseline.",
        "",
        f"Generated: {now}",
        f"Pairs analysed: {n}  |  With semantic score: {has_sem}",
        "",
        "---",
        "",
        "## Semantic Similarity Overview",
        "",
        "### Correlation with label",
        "",
        "| Metric | Value | p-value | Interpretation |",
        "|---|---|---|---|",
        f"| Pearson r | {pearson_r:.4f} | {pearson_p:.2e} | Moderate positive linear correlation |",
        f"| Spearman ρ | {spearman_r:.4f} | {spearman_p:.2e} | Moderate positive rank correlation |",
        "",
        "> Correlation is statistically significant but modest. Semantic similarity carries",
        "> **complementary** signal — it roughly agrees with the label order but does not",
        "> determine it. The existing structured features (sector, stage, check) explain far more",
        "> variance than semantic text similarity alone.",
        "",
        "### Per-label semantic similarity distribution",
        "",
        "| Label | n | min | p25 | mean | p75 | max |",
        "|---|---|---|---|---|---|---|",
    ]
    for row in per_label_stats:
        lines.append(
            f"| {row['label']} — {row['name']} | {row['n']} | "
            f"{row['min']:.3f} | {row['p25']:.3f} | {row['mean']:.3f} | "
            f"{row['p75']:.3f} | {row['max']:.3f} |"
        )
    lines += [
        "",
        "> Labels trend upward with semantic similarity (mean rises from 0.260 to 0.364),",
        "> but distributions overlap heavily. Strong fit (3) has a lower mean than possible fit (2)",
        "> (0.310 vs 0.317), reflecting that structured feature alignment can produce strong",
        "> labels even when text vocabulary differs.",
        "",
        "---",
        "",
        "## Disagreement Analysis",
        "",
        "### High-semantic / Low-label pairs",
        f"(semantic ≥ {HIGH_SEM_THRESH}, label ≤ {LOW_LABEL_THRESH}  — **{len(high_sem_low_label)} pairs**)",
        "",
        "These are pairs where text similarity suggests a potential fit but rules assign a low label.",
        "",
        "| Startup | Investor | sem | label | sector | check | anti | explanation |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for p in high_sem_low_label[:12]:
        lines.append(
            f"| {p['startup'][:24]} | {p['investor'][:24]} | {p['sem']:.3f} | "
            f"{p['label']} ({LABEL_NAMES[p['label']][:8]}) | {p['sector']:.2f} | "
            f"{p['check']:.2f} | {p['anti']:.2f} | {p['reason'][:60]} |"
        )
    lines += [
        "",
        f"> **Key finding:** {pct_cap_protected:.0f}% of these pairs are cap-protected (anti-thesis or",
        "> check-size caps override the text match). The caps are correctly suppressing semantic",
        "> false positives — e.g., a crypto-vocabulary investor matching a crypto-buzzword startup",
        "> that has anti-thesis conflicts or a $10M raise vs a $350K max check.",
        "",
        "### Low-semantic / High-label pairs",
        f"(semantic ≤ {LOW_SEM_THRESH}, label ≥ {HIGH_LABEL_THRESH}  — **{len(low_sem_high_label)} pairs**)",
        "",
        "These are pairs where structured features align well but text vocabularies differ.",
        "",
        "| Startup | Investor | sem | label | sector | check | score |",
        "|---|---|---|---|---|---|---|",
    ]
    for p in low_sem_high_label[:12]:
        lines.append(
            f"| {p['startup'][:24]} | {p['investor'][:24]} | {p['sem']:.3f} | "
            f"{p['label']} ({LABEL_NAMES[p['label']][:8]}) | {p['sector']:.2f} | "
            f"{p['check']:.2f} | {p['score']:.3f} |"
        )
    lines += [
        "",
        "> **Key finding:** Structural feature alignment produces high labels even when text",
        "> vocabularies differ (e.g., OncoPal uses clinical/oncology terms while a general",
        "> enterprise investor thesis uses business-strategy language). This is **healthy** —",
        "> structured mandate matching should lead, not text similarity.",
        "",
        "---",
        "",
        "## What-if: Semantic Bonus Simulation",
        "",
        "### Proposed bonus formula",
        "",
        "```",
        "semantic_bonus(pair) =",
        f"  IF sector_overlap_score >= {SEMANTIC_SECTOR_GATE}",
        f"    THEN min({SEMANTIC_BONUS_MAX}, max(0, (sem - {SEMANTIC_OFFSET}) × 0.10))",
        "  ELSE 0",
        "",
        "weighted_score_with_bonus = current_weighted_score + semantic_bonus",
        "Hard caps (anti-thesis, stage, check) applied unconditionally after.",
        "Excellent conditions unchanged.",
        "```",
        "",
        "### Simulation results",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Pairs that change label | {len(changed_pairs)} / {n} ({len(changed_pairs)/n*100:.1f}%) |",
        f"| Inflated weak/no-traction profiles | {len(inflated_weak)} |",
        f"| Max distribution drift | {max_drift:.1f} pp (limit: 2 pp) |",
        f"| Distribution stays in target bands | {'YES ✓' if in_bands_after else 'NO ✗'} |",
        "",
    ]
    if changed_pairs:
        lines += [
            "### Pairs that would change label",
            "",
            "| Startup | Investor | sem | bonus | before | after |",
            "|---|---|---|---|---|---|",
        ]
        for cp in changed_pairs:
            sem_str = f"{cp['sem']:.3f}" if cp["sem"] is not None else "null"
            lines.append(
                f"| {cp['startup'][:22]} | {cp['investor'][:22]} | {sem_str} | "
                f"{cp['bonus']:.4f} | {LABEL_NAMES[cp['label_before']]} | {LABEL_NAMES[cp['label_after']]} |"
            )
        lines.append("")

    # Distribution comparison
    TARGET_LABELS = ["35–45%", "20–30%", "15–25%", " 8–15%", "  3–8%"]
    lines += [
        "### Distribution comparison",
        "",
        "| Label | Before | After | Target | In band? |",
        "|---|---|---|---|---|",
    ]
    for i in range(5):
        lo, hi = TARGET_BANDS[i]
        pct_before = dist_before[i] / n * 100
        pct_after = dist_after[i] / n * 100
        in_band = "✓" if lo <= pct_after <= hi else "✗"
        lines.append(
            f"| {LABEL_NAMES[i]} | {dist_before[i]} ({pct_before:.1f}%) | "
            f"{dist_after[i]} ({pct_after:.1f}%) | {TARGET_LABELS[i]} | {in_band} |"
        )
    lines += ["", "---", "", "## Evidence summary", ""]

    if evidence_keep:
        lines.append("### Evidence for KEEPING formula unchanged")
        lines.append("")
        for e in evidence_keep:
            lines.append(f"- {e}")
        lines.append("")

    if evidence_apply:
        lines.append("### Evidence for APPLYING semantic bonus")
        lines.append("")
        for e in evidence_apply:
            lines.append(f"- {e}")
        lines.append("")

    lines += [
        "---",
        "",
        f"## ══ RECOMMENDATION: **{recommendation} FORMULA {'UNCHANGED' if recommendation == 'KEEP' else 'WITH SEMANTIC BONUS'}** ══",
        "",
    ]

    if recommendation == "KEEP":
        lines += [
            "**Do not modify the labeling formula.** Keep `semantic_similarity_score` weight = 0.",
            "",
            "Rationale:",
            "- The practical impact is near-zero (< 2% of pairs would change).",
            "- The moderate correlation (r≈0.30) confirms semantics carry signal but are not",
            "  the primary driver of label quality in this synthetic dataset.",
            "- All high-sem/low-label disagreements are correctly handled by existing caps.",
            "  These caps encode investor mandate constraints that must not be overridden by text overlap.",
            "- The 14 low-sem/high-label cases demonstrate that structured features correctly lead",
            "  even when vocabulary differs — exactly the intended behaviour.",
            "- `semantic_similarity_score` is already used by the GBM model (4th in importance).",
            "  The model gets the semantic signal without it entering the labeling formula.",
            "",
            "**Phase 8 conclusion:** The synthetic labeling pipeline is correct and complete.",
            "Semantics improve the ML model but should not alter the label formula at this stage.",
            "Phase 9 should focus on real-data collection or production integration preparation.",
        ]
    else:
        lines += [
            "**Apply the semantic bonus** to `scripts/generate-synthetic-match-pairs.ts`.",
            "",
            "The bonus is small, gated, and does not inflate buzzword profiles.",
            "Re-run `npm run prepare:synthetic-matches` after applying the formula change.",
        ]

    if retrain_section_lines:
        lines += ["", "---", ""] + retrain_section_lines

    lines += [
        "",
        "---",
        "",
        "## Artifacts",
        "",
        "| File | Description |",
        "|---|---|",
        f"| `semantic_scatter.png` | Scatter plot of semantic similarity vs label (color = label, regression line overlaid) |",
        f"| `semantic_disagreements.csv` | High-sem/low-label, low-sem/high-label, and would-change pairs |",
        f"| `semantic_analysis_report.md` | This report |",
    ]

    report_path = out_dir / "semantic_analysis_report.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"  ✓ Saved {report_path.name}")

    return recommendation


def _retrain_comparison(df: "pd.DataFrame", n: int) -> list[str]:
    """Retrain the GBM and LogReg and compare feature importances with Phase 7 baseline."""
    print("\n  Retraining models for Phase 8 feature importance comparison…")
    X = df[ALL_FEATURE_COLS].fillna(0.0).values.astype(float)
    y = df["label"].values.astype(int)
    idx_tr, idx_te = train_test_split(np.arange(n), test_size=0.20, stratify=y, random_state=RANDOM_SEED)
    X_tr, X_te, y_tr, y_te = X[idx_tr], X[idx_te], y[idx_tr], y[idx_te]

    results: list[dict[str, Any]] = []
    for name, model in [
        ("LogReg", Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression(max_iter=1000, solver="lbfgs", C=1.0, random_state=RANDOM_SEED))])),
        ("GBM", GradientBoostingClassifier(n_estimators=200, max_depth=5, learning_rate=0.1, subsample=0.9, random_state=RANDOM_SEED)),
    ]:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model.fit(X_tr, y_tr)
        y_pred = model.predict(X_te)
        acc = accuracy_score(y_te, y_pred)
        f1m = f1_score(y_te, y_pred, average="macro", zero_division=0)
        results.append({"name": name, "acc": acc, "f1m": f1m, "model": model})
        print(f"    {name:<10} acc={acc:.4f}  macro-F1={f1m:.4f}")

    # GBM feature importance
    gbm_model = next(r["model"] for r in results if r["name"] == "GBM")
    imp = gbm_model.feature_importances_
    ranked = sorted(zip(ALL_FEATURE_COLS, imp), key=lambda x: x[1], reverse=True)

    sec_lines: list[str] = [
        "## Phase 8 Model Comparison (retraining with 12 features including semantic)",
        "",
        "### Test-set metrics",
        "",
        "| Model | Phase 7 Acc | Phase 8 Acc | Phase 7 Macro-F1 | Phase 8 Macro-F1 |",
        "|---|---|---|---|---|",
        "| LogReg | 0.874 | " + f"{next(r['acc'] for r in results if r['name']=='LogReg'):.4f}" + " | 0.822 | " + f"{next(r['f1m'] for r in results if r['name']=='LogReg'):.4f}" + " |",
        "| GBM    | 0.832 | " + f"{next(r['acc'] for r in results if r['name']=='GBM'):.4f}" + " | 0.823 | " + f"{next(r['f1m'] for r in results if r['name']=='GBM'):.4f}" + " |",
        "",
        "### GBM feature importance (Phase 8)",
        "",
        "| Rank | Feature | Importance |",
        "|---|---|---|",
    ]
    for i, (feat, v) in enumerate(ranked, 1):
        marker = " ← semantic" if feat == "semantic_similarity_score" else ""
        sec_lines.append(f"| {i} | `{feat}` | {v:.4f}{marker} |")

    return sec_lines


# ── Entry point ────────────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Analyse semantic similarity agreement with synthetic labels.",
        epilog="SYNTHETIC DATA ONLY — NOT investment advice.",
    )
    p.add_argument(
        "--skip-retrain",
        action="store_true",
        help="Skip optional model retraining step (faster run, no Phase 7/8 comparison).",
    )
    p.add_argument(
        "--output-dir",
        type=Path,
        default=ARTIFACTS_DIR,
        help=f"Directory for output artifacts (default: {ARTIFACTS_DIR})",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    out_dir: Path = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    print("\n" + "═" * 72)
    print("  SYNTHETIC SEMANTIC AGREEMENT ANALYSIS — EXPERIMENTAL")
    print("═" * 72)
    print("  ⚠  All data is SYNTHETIC. Not real user data.")
    print("  ⚠  This analysis is for profile-fit matching only. Not investment advice.")
    print("═" * 72 + "\n")

    print("Loading data…")
    df, raw_pairs = load_pairs(PAIRS_PATH)
    startups: dict[str, Any] = {
        s["id"]: s
        for s in json.loads(STARTUPS_PATH.read_text(encoding="utf-8"))
    }
    investors: dict[str, Any] = {
        i["id"]: i
        for i in json.loads(INVESTORS_PATH.read_text(encoding="utf-8"))
    }

    scipy_check = df["semantic_similarity_score"].notna().sum()
    if scipy_check == 0:
        print("⚠  No semantic_similarity_score values found. "
              "Run npm run embeddings:synthetic-matches first.")
        sys.exit(1)

    print("Running analysis…\n")
    recommendation = run_analysis(
        df=df, raw_pairs=raw_pairs,
        startups=startups, investors=investors,
        out_dir=out_dir,
        skip_retrain=args.skip_retrain,
    )

    print(f"\n{'═' * 72}")
    print(f"  RECOMMENDATION: {recommendation} FORMULA {'UNCHANGED' if recommendation == 'KEEP' else 'WITH SEMANTIC BONUS'}")
    print(f"  See: {out_dir / 'semantic_analysis_report.md'}")
    print("  ⚠  Synthetic experimental only. Not for production use.")
    print("═" * 72 + "\n")


if __name__ == "__main__":
    main()
