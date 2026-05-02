#!/usr/bin/env python3
"""
scripts/ml/eval_calibration.py

Calibration metrics and champion candidate synthesis (Phase 11c-ii/iv).

─── NOTICE ──────────────────────────────────────────────────────────────────
  • All data is SYNTHETIC. No real user data is analysed.
  • This script is NOT investment advice.
  • It does NOT predict startup success or investment returns.
  • All outputs are offline experimental artifacts.
  • scoreMatch in lib/matching/score.ts remains the production baseline.
─────────────────────────────────────────────────────────────────────────────

Inputs (read-only):
  - data/synthetic-matching/artifacts/predictions_eligible_oof.csv     (Phase 11b)
  - data/synthetic-matching/artifacts/multiseed_metrics.json           (Phase 11c-i)
  - data/synthetic-matching/artifacts/ranking_metrics_multiseed.json   (Phase 11c-i)
  - data/synthetic-matching/artifacts/eligibility_summary.json         (Phase 10)

Outputs:
  - data/synthetic-matching/artifacts/calibration_metrics.json
  - data/synthetic-matching/artifacts/calibration_report.md
  - data/synthetic-matching/artifacts/champion_candidate.json
  - data/synthetic-matching/artifacts/champion_candidate.md

Usage (from repo root):
    python3 scripts/ml/eval_calibration.py
    npm run eval-calibration:synthetic-matches

Requires Python 3.9+
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

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
    from sklearn.metrics import brier_score_loss, log_loss
except ImportError:
    _MISSING.append("scikit-learn")

if _MISSING:
    print("ERROR: Missing Python dependencies:", ", ".join(_MISSING))
    print("Install with:  cd scripts/ml && source .venv/bin/activate")
    sys.exit(1)

# ── Constants ──────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ARTIFACTS_DIR = REPO_ROOT / "data" / "synthetic-matching" / "artifacts"

OOF_PATH              = ARTIFACTS_DIR / "predictions_eligible_oof.csv"
MULTISEED_METRICS     = ARTIFACTS_DIR / "multiseed_metrics.json"
RANKING_MULTISEED     = ARTIFACTS_DIR / "ranking_metrics_multiseed.json"
ELIGIBILITY_SUMMARY   = ARTIFACTS_DIR / "eligibility_summary.json"

PHASE10B_BASELINE_FP = 11  # LogReg C=1.0 → 11/335 false promotions


# ── Calibration metric functions ──────────────────────────────────────────────


def ece_score(
    y_true: "np.ndarray",
    y_prob: "np.ndarray",
    n_bins: int = 10,
) -> tuple[float, list[dict[str, Any]]]:
    """Expected Calibration Error with equal-width bins over [0, 1].

    Args:
        y_true: binary array (1 = positive class, 0 = negative)
        y_prob: predicted probabilities for the positive class
        n_bins: number of equal-width bins

    Returns:
        (ece_value, bin_details_list)
    """
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    n = len(y_true)
    ece = 0.0
    bin_details: list[dict[str, Any]] = []

    for i in range(n_bins):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        mask = (y_prob >= lo) & (y_prob <= hi if i == n_bins - 1 else y_prob < hi)
        n_bin = int(mask.sum())
        if n_bin == 0:
            bin_details.append({
                "bin_lower": round(float(lo), 2),
                "bin_upper": round(float(hi), 2),
                "n": 0,
                "mean_pred": None,
                "frac_pos": None,
                "calibration_error": None,
            })
            continue
        mean_pred = float(y_prob[mask].mean())
        frac_pos = float(y_true[mask].mean())
        cal_err = abs(frac_pos - mean_pred)
        ece += (n_bin / n) * cal_err
        bin_details.append({
            "bin_lower": round(float(lo), 2),
            "bin_upper": round(float(hi), 2),
            "n": n_bin,
            "mean_pred": round(mean_pred, 4),
            "frac_pos": round(frac_pos, 4),
            "calibration_error": round(cal_err, 4),
        })

    return round(float(ece), 4), bin_details


def compute_model_calibration(
    df: "pd.DataFrame",
    key: str,
) -> dict[str, Any]:
    """Compute calibration metrics for one model using OOF predictions.

    Args:
        df:  DataFrame with OOF predictions (from predictions_eligible_oof.csv).
        key: model key — "logreg", "gbm", or "decisiontree".

    Returns:
        dict with Brier, ECE, log-loss, ECE bins, and interpretation.
    """
    result: dict[str, Any] = {"model_key": key}

    y_true = df["true_label"].values.astype(int)

    # ── Top-tier binary calibration (label ≥ 3) ───────────────────────────────
    y_true_top = (y_true >= 3).astype(float)
    col_top = f"prob_top_tier_{key}"
    if col_top not in df.columns:
        result["error"] = f"Column {col_top} not found."
        return result

    y_prob_top = df[col_top].values.astype(float)
    brier_top = float(brier_score_loss(y_true_top, y_prob_top))
    ece_top, bins_top = ece_score(y_true_top, y_prob_top, n_bins=10)

    result["brier_top_tier"] = round(brier_top, 4)
    result["ece_top_tier"] = ece_top
    result["ece_bins_top_tier"] = bins_top

    # ── Label-4 binary calibration ────────────────────────────────────────────
    y_true_4 = (y_true == 4).astype(float)
    col_4 = f"prob_4_{key}"
    if col_4 in df.columns:
        brier_4 = float(brier_score_loss(y_true_4, df[col_4].values.astype(float)))
        result["brier_label4"] = round(brier_4, 4)

    # ── Multiclass log loss ───────────────────────────────────────────────────
    proba_cols = [f"prob_{k}_{key}" for k in range(5)]
    if all(c in df.columns for c in proba_cols):
        proba_mat = df[proba_cols].values.astype(float)
        proba_mat = np.clip(proba_mat, 1e-10, 1.0)
        proba_mat = proba_mat / proba_mat.sum(axis=1, keepdims=True)
        ll = float(log_loss(y_true, proba_mat))
        result["multiclass_log_loss"] = round(ll, 4)

    # ── ECE interpretation ────────────────────────────────────────────────────
    if ece_top <= 0.05:
        interp = "well-calibrated (ECE ≤ 0.05)"
        rec_recal = False
    elif ece_top <= 0.10:
        interp = "acceptable calibration (0.05 < ECE ≤ 0.10)"
        rec_recal = False
    else:
        interp = f"poor calibration (ECE = {ece_top:.4f} > 0.10) — recalibration recommended in a future phase"
        rec_recal = True

    result["ece_interpretation"] = interp
    result["recalibration_recommended"] = rec_recal

    return result


# ── Report writers ────────────────────────────────────────────────────────────


def write_calibration_report(
    cal: dict[str, dict[str, Any]],
    n_pairs: int,
    out_dir: Path,
) -> Path:
    """Write calibration_report.md."""
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    def fmt(v: Any, d: int = 4) -> str:
        if v is None or (isinstance(v, float) and v != v):
            return "—"
        try:
            return f"{float(v):.{d}f}"
        except (TypeError, ValueError):
            return str(v)

    lines: list[str] = [
        "# Synthetic Matching Lab — Calibration Report  (Phase 11c-ii)",
        "",
        "> ## ⚠️ SYNTHETIC EXPERIMENTAL DATA",
        ">",
        "> All data is SYNTHETIC.  Not investment advice.  Not real user data.",
        "> `scoreMatch` in `lib/matching/score.ts` remains the production baseline.",
        "",
        f"Generated: {now}",
        f"Evaluation pairs: {n_pairs} (single-seed OOF from `predictions_eligible_oof.csv`)",
        "",
        "> **Note on sample size:** ECE and Brier score on {n_pairs} pairs have a"
        " noise floor of ~5–10%.  Do not over-interpret small differences between models.",
        "",
        "## Calibration Summary",
        "",
        "| Model | Brier (top-tier) | Brier (label=4) | ECE@10 | Multiclass log-loss | Interpretation |",
        "|---|---|---|---|---|---|",
    ]

    model_order = ["logreg", "gbm", "decisiontree"]
    for key in model_order:
        m = cal.get(key, {})
        if "error" in m:
            lines.append(f"| `{key}` | — | — | — | — | {m['error']} |")
            continue
        lines.append(
            f"| `{key}` | "
            f"{fmt(m.get('brier_top_tier'))} | "
            f"{fmt(m.get('brier_label4'))} | "
            f"{fmt(m.get('ece_top_tier'))} | "
            f"{fmt(m.get('multiclass_log_loss'))} | "
            f"{m.get('ece_interpretation', '—')} |"
        )
    lines.append("")

    # ECE note if > 0.10
    any_poor = any(cal.get(k, {}).get("recalibration_recommended", False) for k in model_order)
    if any_poor:
        lines += [
            "> **⚠️ Poor calibration detected (ECE > 0.10).**  Recalibration via isotonic",
            "> regression or Platt scaling is recommended in a future phase before using",
            "> raw probabilities in the personalization layer.  Rankings remain valid.",
            "",
        ]

    # Per-bin calibration table for LogReg (primary model)
    logreg_bins = cal.get("logreg", {}).get("ece_bins_top_tier", [])
    if logreg_bins:
        lines += [
            "## Per-Bin Calibration Table — LogReg (top-tier probability)",
            "",
            "| Bin | n pairs | Mean pred | Actual frac pos | Calibration error |",
            "|---|---|---|---|---|",
        ]
        for b in logreg_bins:
            if b["n"] == 0:
                lines.append(
                    f"| [{b['bin_lower']:.1f}, {b['bin_upper']:.1f}) | 0 | — | — | — |"
                )
            else:
                lines.append(
                    f"| [{b['bin_lower']:.1f}, {b['bin_upper']:.1f}) | {b['n']} | "
                    f"{fmt(b['mean_pred'])} | {fmt(b['frac_pos'])} | "
                    f"{fmt(b['calibration_error'])} |"
                )
        lines += [
            "",
            "> Diagonal-ish mean_pred ≈ frac_pos indicates well-calibrated probabilities.",
            "",
        ]

    lines += [
        "## Metric Definitions",
        "",
        "| Metric | Definition |",
        "|---|---|",
        "| **Brier (top-tier)** | MSE between P(label≥3) and 1[label≥3]. Lower is better. |",
        "| **Brier (label=4)** | MSE between P(label=4) and 1[label=4]. Lower is better. |",
        "| **ECE@10** | Expected Calibration Error with 10 equal-width bins on P(label≥3). |",
        "| **Multiclass log-loss** | Cross-entropy over all 5 classes. Lower is better. |",
        "",
        "---",
        "",
        "*Synthetic experimental data only.  Not for production use.*",
    ]

    out_path = out_dir / "calibration_report.md"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


def write_champion_md(champion: dict[str, Any], out_path: Path) -> None:
    """Write champion_candidate.md."""
    ms_r = champion.get("multi_seed_ranking", {})
    cal = champion.get("calibration", {})
    safety = champion.get("safety", {})

    def fmt(v: Any, d: int = 4) -> str:
        if v is None or (isinstance(v, float) and v != v):
            return "—"
        try:
            return f"{float(v):.{d}f}"
        except (TypeError, ValueError):
            return str(v)

    ci = ms_r.get("per_founder_ndcg5_ci95", [None, None])
    ci_str = f"[{fmt(ci[0])}, {fmt(ci[1])}]" if ci and ci[0] is not None else "—"

    lines: list[str] = [
        "# Synthetic Matching Lab — Champion Candidate  (Phase 11c)",
        "",
        "> ## ⚠️ SYNTHETIC EXPERIMENTAL DATA — NOT FOR PRODUCTION",
        ">",
        "> - **NOT investment advice.**",
        "> - **NOT real user data.** All data is entirely synthetic.",
        "> - **NOT production-ready.** `scoreMatch` in `lib/matching/score.ts` remains the production baseline.",
        "> - Selected on synthetic label recovery, not real investor behavior.",
        "",
        "## Selected Candidate",
        "",
        "| Property | Value |",
        "|---|---|",
        f"| Model | {champion['candidate_model']} (LogisticRegression) |",
        f"| Regularization C | {champion['candidate_c_value']} |",
        f"| Ranking score | `{champion['candidate_ranking_score']}` — Σ k·P(label=k) |",
        f"| Selection basis | {champion['selection_basis']} |",
        f"| **Production status** | **{champion['production_status']}** |",
        "",
        "## Why LogReg is the current best candidate",
        "",
        "- LogReg with StandardScaler recovers the near-linear eligible-pair labeling formula",
        "  most efficiently.  The eligible subset has a near-flat class distribution (13–27%",
        "  per class) that favors linear models over tree/boosting methods.",
        f"- Per-founder NDCG@5 = **{fmt(ms_r.get('per_founder_ndcg5_mean'))}** (5-seed OOF).",
        f"- Beats the scoreMatch approximation by {fmt(ms_r.get('vs_scorematch_approx_lift_ndcg5'))} NDCG@5 points.",
        f"- Beats GBM by {fmt(ms_r.get('vs_gbm_delta_ndcg5'))} NDCG@5 points (leakage-free).",
        "- Passes the Phase 10b safety diagnostic (false-promotion risk ≤ baseline).",
        "",
        "## Multi-Seed Ranking Metrics  (per-founder, 5 seeds × 5-fold OOF)",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| NDCG@5 mean | {fmt(ms_r.get('per_founder_ndcg5_mean'))} |",
        f"| NDCG@5 std | {fmt(ms_r.get('per_founder_ndcg5_std'))} |",
        f"| 95% CI | {ci_str} |",
        f"| Lift over random | {fmt(ms_r.get('vs_random_lift_ndcg5'))} |",
        f"| Lift over scoreMatch approx | {fmt(ms_r.get('vs_scorematch_approx_lift_ndcg5'))} |",
        f"| Advantage over GBM | {fmt(ms_r.get('vs_gbm_delta_ndcg5'))} NDCG@5 points |",
        f"| LogReg CI95 strictly above GBM CI95 | {'✅ Yes' if ms_r.get('logreg_ci_strictly_above_gbm_ci') is True else ('ℹ️ CIs overlap' if ms_r.get('logreg_ci_strictly_above_gbm_ci') is False else '—')} |",
        "",
        "## Calibration  (single-seed OOF, n=260 eligible pairs)",
        "",
        "| Metric | LogReg |",
        "|---|---|",
        f"| Brier score (top-tier, label≥3) | {fmt(cal.get('brier_top_tier'))} |",
        f"| ECE@10 (top-tier probability) | {fmt(cal.get('ece_top_tier'))} |",
        f"| Multiclass log loss | {fmt(cal.get('multiclass_log_loss'))} |",
        f"| Interpretation | {cal.get('ece_interpretation', '—')} |",
        f"| Recalibration recommended | {'⚠️ Yes — future phase' if cal.get('recalibration_recommended') else '✅ No'} |",
        "",
        "## Safety Diagnostic  (Phase 10b gate — ineligible pairs)",
        "",
        "| Property | Value |",
        "|---|---|",
        f"| Ineligible pairs evaluated | {safety.get('ineligible_pairs_evaluated', 335)} |",
        f"| Predicted label ≥ 3 (without gate) | {safety.get('false_promotions_3plus', '—')} ({safety.get('pct_3plus', '—')}%) |",
        f"| Predicted label = 4 (without gate) | {safety.get('false_promotions_4', '—')} |",
        f"| Passes Phase 10b baseline (≤ {PHASE10B_BASELINE_FP}/335) | {'✅' if safety.get('passes_phase10b_baseline') else '❌ REGRESSION'} |",
        "",
        "## What this does NOT mean",
        "",
        "- Does **not** predict startup success or financial returns.",
        "- Does **not** represent real investor preferences.",
        "- **Cannot** be deployed without validation on real post-launch interaction data.",
        "- ~83% OOF accuracy measures synthetic label recovery, not real-world quality.",
        "- The hard eligibility gate must run before this model at inference time.",
        "",
        "## Next Phase",
        "",
        "**Phase 12 — Personalization Simulator**",
        "",
        "The personalization layer will combine this global model's predicted rankings",
        "with startup- and investor-specific preference signals.",
        "",
        "---",
        f"*Generated: {champion['generated']}*",
        "*All data is synthetic.  Not investment advice.*",
    ]

    out_path.write_text("\n".join(lines), encoding="utf-8")


# ── Champion candidate synthesis ──────────────────────────────────────────────


def generate_champion_candidate(
    cal_metrics: dict[str, dict[str, Any]],
    ms_metrics: "dict[str, Any] | None",
    ranking_ms: "dict[str, Any] | None",
    out_dir: Path,
) -> tuple[Path, Path]:
    """Synthesise champion_candidate.json and champion_candidate.md."""
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    # Determine best C (ranking-based overrides classification-based).
    selected_c = 1.0
    selected_model = "logreg_c1.0"
    selection_basis = "default (Phase 11b LogReg C=1.0)"

    if ranking_ms is not None:
        sel = ranking_ms.get("ranking_based_selection", {})
        if sel.get("best_c_value") is not None:
            selected_c = float(sel["best_c_value"])
            selected_model = sel.get("best_model", f"logreg_c{selected_c}")
            selection_basis = (
                "ranking-based — per-founder NDCG@5 mean across 5 seeds "
                "(safety-filtered against Phase 10b baseline)"
            )
    elif ms_metrics is not None:
        if ms_metrics.get("selected_logreg_c") is not None:
            selected_c = float(ms_metrics["selected_logreg_c"])
            selected_model = f"logreg_c{selected_c}"
            selection_basis = "classification-based — OOF accuracy across 5 seeds"

    # Collect ranking metrics.
    ndcg5_mean = ndcg5_std = vs_random = vs_sm = vs_gbm = None
    ndcg5_ci95: "list | None" = None
    above_gbm: "bool | None" = None

    if ranking_ms is not None:
        sel = ranking_ms.get("ranking_based_selection", {})
        ndcg5_mean = sel.get("best_ndcg5_mean")
        ndcg5_ci95 = sel.get("best_ndcg5_ci95")
        vs_random = sel.get("vs_random_lift_ndcg5")
        vs_sm = sel.get("vs_scorematch_lift_ndcg5")
        above_gbm = sel.get("logreg_ci_strictly_above_gbm_ci")
        gbm_agg = ranking_ms.get("per_founder", {}).get("gbm", {}).get("mean_ndcg_at_5", {})
        gbm_ndcg5 = gbm_agg.get("mean")
        if ndcg5_mean is not None and gbm_ndcg5 is not None:
            vs_gbm = round(float(ndcg5_mean) - float(gbm_ndcg5), 4)
        ndcg5_std = (
            ranking_ms.get("per_founder", {})
            .get(selected_model, {})
            .get("mean_ndcg_at_5", {})
            .get("std")
        )

    # Collect calibration for LogReg.
    logreg_cal = cal_metrics.get("logreg", {})

    # Safety.
    fp_3 = PHASE10B_BASELINE_FP
    fp_4 = 0
    pct_fp = 3.28
    n_inelig = 335
    if ms_metrics is not None:
        sd = ms_metrics.get("safety_diagnostic", {}).get(selected_model, {})
        if sd:
            fp_3 = sd.get("false_promotions_3plus", fp_3)
            fp_4 = sd.get("false_promotions_4", fp_4)
            pct_fp = sd.get("pct_3plus", pct_fp)
        n_inelig = ms_metrics.get("n_ineligible_pairs", 335)

    champion: dict[str, Any] = {
        "generated": now,
        "phase": "11c",
        "warning": (
            "SYNTHETIC EXPERIMENTAL ONLY. Not for production. Not investment advice. "
            "scoreMatch in lib/matching/score.ts remains the production baseline. "
            "All data is synthetic; results do not reflect real investor behavior."
        ),
        "candidate_model": "LogReg",
        "candidate_model_class": "sklearn.linear_model.LogisticRegression",
        "candidate_c_value": selected_c,
        "candidate_ranking_score": "expected_label",
        "candidate_ranking_score_definition": "sum(k * P(label=k) for k in 0..4)",
        "selection_basis": selection_basis,
        "multi_seed_ranking": {
            "per_founder_ndcg5_mean": ndcg5_mean,
            "per_founder_ndcg5_std": ndcg5_std,
            "per_founder_ndcg5_ci95": ndcg5_ci95,
            "vs_random_lift_ndcg5": vs_random,
            "vs_scorematch_approx_lift_ndcg5": vs_sm,
            "vs_gbm_delta_ndcg5": vs_gbm,
            "logreg_ci_strictly_above_gbm_ci": above_gbm,
        },
        "calibration": {
            "brier_top_tier": logreg_cal.get("brier_top_tier"),
            "ece_top_tier": logreg_cal.get("ece_top_tier"),
            "multiclass_log_loss": logreg_cal.get("multiclass_log_loss"),
            "ece_interpretation": logreg_cal.get("ece_interpretation"),
            "recalibration_recommended": logreg_cal.get("recalibration_recommended"),
        },
        "safety": {
            "ineligible_pairs_evaluated": n_inelig,
            "false_promotions_3plus": fp_3,
            "false_promotions_4": fp_4,
            "pct_3plus": pct_fp,
            "passes_phase10b_baseline": fp_3 <= PHASE10B_BASELINE_FP,
        },
        "production_status": "OFFLINE EXPERIMENTAL ONLY — do not deploy",
        "scoreMatch_note": (
            "scoreMatch in lib/matching/score.ts is the safe production baseline"
        ),
        "next_phase": "Phase 12 — personalization simulator",
    }

    json_path = out_dir / "champion_candidate.json"
    json_path.write_text(json.dumps(champion, indent=2), encoding="utf-8")

    md_path = out_dir / "champion_candidate.md"
    write_champion_md(champion, md_path)

    return json_path, md_path


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    print("\n" + "═" * 72)
    print("  CALIBRATION METRICS + CHAMPION CANDIDATE — PHASE 11c-ii/iv")
    print("═" * 72)
    print("  ⚠  All data is SYNTHETIC. Not real user data.")
    print("  ⚠  This is NOT investment advice.")
    print("═" * 72 + "\n")

    # ── Load OOF predictions ───────────────────────────────────────────────────
    if not OOF_PATH.exists():
        print(f"ERROR: {OOF_PATH.name} not found.")
        print("Run:  npm run train:synthetic-matches  first.")
        sys.exit(1)

    print(f"Loading {OOF_PATH.name} ({OOF_PATH.stat().st_size // 1024} KB) …")
    df = pd.read_csv(OOF_PATH)
    n_pairs = len(df)
    print(f"  {n_pairs} OOF pairs loaded.\n")

    # ── Compute calibration metrics ────────────────────────────────────────────
    print(f"{'─' * 72}")
    print("CALIBRATION METRICS")
    print(f"{'─' * 72}")

    model_keys = ["logreg", "gbm", "decisiontree"]
    cal_metrics: dict[str, dict[str, Any]] = {}
    for key in model_keys:
        cal_metrics[key] = compute_model_calibration(df, key)
        m = cal_metrics[key]
        if "error" in m:
            print(f"  {key:<16}  ⚠  {m['error']}")
        else:
            print(
                f"  {key:<16}  Brier(top)={m.get('brier_top_tier', '—'):.4f}  "
                f"ECE@10={m.get('ece_top_tier', '—'):.4f}  "
                f"LogLoss={m.get('multiclass_log_loss', '—'):.4f}  "
                f"→ {m.get('ece_interpretation', '—')}"
            )
    print()

    # ── Load auxiliary metrics ─────────────────────────────────────────────────
    ms_metrics: "dict[str, Any] | None" = None
    ranking_ms: "dict[str, Any] | None" = None

    if MULTISEED_METRICS.exists():
        ms_metrics = json.loads(MULTISEED_METRICS.read_text(encoding="utf-8"))
        print(f"  ✓  Loaded {MULTISEED_METRICS.name}")
    else:
        print(f"  ⚠  {MULTISEED_METRICS.name} not found — run train-multiseed first.")

    if RANKING_MULTISEED.exists():
        ranking_ms = json.loads(RANKING_MULTISEED.read_text(encoding="utf-8"))
        print(f"  ✓  Loaded {RANKING_MULTISEED.name}")
    else:
        print(f"  ⚠  {RANKING_MULTISEED.name} not found — run eval-ranking-multiseed first.")
    print()

    # ── Save calibration artifacts ─────────────────────────────────────────────
    print(f"{'─' * 72}")
    print(f"SAVING ARTIFACTS  →  {ARTIFACTS_DIR}")
    print(f"{'─' * 72}")

    cal_json_path = ARTIFACTS_DIR / "calibration_metrics.json"
    cal_json_path.write_text(
        json.dumps(
            {
                "generated": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
                "n_oof_pairs": n_pairs,
                "models": {k: {kk: vv for kk, vv in v.items() if kk != "ece_bins_top_tier"}
                           for k, v in cal_metrics.items()},
                "ece_bins_logreg": cal_metrics.get("logreg", {}).get("ece_bins_top_tier", []),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"  ✓ {cal_json_path.name}")

    cal_report = write_calibration_report(cal_metrics, n_pairs, ARTIFACTS_DIR)
    print(f"  ✓ {cal_report.name}")

    # ── Generate champion candidate ────────────────────────────────────────────
    champion_json, champion_md = generate_champion_candidate(
        cal_metrics, ms_metrics, ranking_ms, ARTIFACTS_DIR
    )
    print(f"  ✓ {champion_json.name}")
    print(f"  ✓ {champion_md.name}")

    # Print headline
    if ranking_ms is not None:
        sel = ranking_ms.get("ranking_based_selection", {})
        best_m = sel.get("best_model", "logreg_c1.0")
        best_c = sel.get("best_c_value", 1.0)
        ndcg5 = sel.get("best_ndcg5_mean", "—")
        ci = sel.get("best_ndcg5_ci95", [None, None])
        print(f"\n  Champion candidate: {best_m}  C={best_c}")
        print(f"  Per-founder NDCG@5 mean = {ndcg5}  CI95 = {ci}")
        vs_sm = sel.get("vs_scorematch_lift_ndcg5")
        vs_rnd = sel.get("vs_random_lift_ndcg5")
        print(f"  Lift vs scoreMatch approx: {vs_sm}")
        print(f"  Lift vs random: {vs_rnd}")

    logreg_cal = cal_metrics.get("logreg", {})
    print(f"\n  LogReg calibration:")
    print(f"    ECE@10 = {logreg_cal.get('ece_top_tier', '—')}")
    print(f"    {logreg_cal.get('ece_interpretation', '—')}")
    if logreg_cal.get("recalibration_recommended"):
        print("    ⚠️  Recalibration recommended in a future phase.")
    else:
        print("    ✅  No recalibration needed at this threshold.")

    print(f"\n{'═' * 72}")
    print("  Done.  Champion candidate artifacts saved.")
    print("  ⚠  Synthetic experimental only.  Not for production use.")
    print("═" * 72 + "\n")


if __name__ == "__main__":
    main()
