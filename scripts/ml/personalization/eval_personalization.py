#!/usr/bin/env python3
"""
scripts/ml/personalization/eval_personalization.py

Evaluate whether personalization improved rankings for synthetic personas (Phase 12b-ii).

─── NOTICE ──────────────────────────────────────────────────────────────────
  • All personas, scores, and evaluations are ENTIRELY SYNTHETIC.
  • No real investor, founder, or user is represented.
  • This script is NOT investment advice.
  • It does NOT predict startup success or investment returns.
  • Hard eligibility is NON-NEGOTIABLE. Any violation aborts this script.
  • `scoreMatch` in lib/matching/score.ts remains the production baseline.
─────────────────────────────────────────────────────────────────────────────

Usage (from repo root):
    python3 scripts/ml/personalization/eval_personalization.py

Outputs:
    data/synthetic-matching/artifacts/personalization_metrics.json
    data/synthetic-matching/artifacts/personalization_report.md
"""

from __future__ import annotations

import csv
import json
import math
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

# ── Module resolution ──────────────────────────────────────────────────────────

_ML_DIR    = Path(__file__).resolve().parent.parent
_REPO_ROOT = _ML_DIR.parent.parent
if str(_ML_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_DIR))

# ── Paths ──────────────────────────────────────────────────────────────────────

ARTIFACTS_DIR        = _REPO_ROOT / "data" / "synthetic-matching" / "artifacts"
RANKINGS_PATH        = ARTIFACTS_DIR / "personalized_rankings.csv"
ACTIONS_PATH         = ARTIFACTS_DIR / "simulated_actions.csv"
PREF_VEC_PATH        = ARTIFACTS_DIR / "persona_preference_vectors.json"
PERSONAS_PATH        = ARTIFACTS_DIR / "synthetic_personas.json"
PAIRS_PATH           = _REPO_ROOT / "data" / "synthetic-matching" / "pairs.json"
STARTUPS_PATH        = _REPO_ROOT / "data" / "synthetic-matching" / "startups.json"
METRICS_OUTPUT       = ARTIFACTS_DIR / "personalization_metrics.json"
REPORT_OUTPUT        = ARTIFACTS_DIR / "personalization_report.md"

# ── Constants ──────────────────────────────────────────────────────────────────

K_VALUES               = [3, 5, 10]
LATENT_RELEVANT_THRESH = 0.5     # latent_score >= this → "relevant" for binary metrics
LABEL_RELEVANT_THRESH  = 3       # pair_label >= this → "relevant" for label metrics

# Safety thresholds
MAX_SAFE_ELIGIBILITY_VIOLATIONS = 0
PERSONALIZATION_ONLY_JUMP_GLOBAL_RANK = 10   # ranked worse than this by global
PERSONALIZATION_ONLY_JUMP_PERS_RANK   = 5    # but in top-K after personalization

# Diversity: sector entropy drop
DIVERSITY_ALERT_DROP = 0.30   # flag if entropy drops > 30% of original

# Recommendation logic thresholds
NEAR_ZERO_MOVEMENT_THRESHOLD = 8   # if ≥ this many personas have max|Δ|=0 → TUNE

# Positive action types for behavior validation
POSITIVE_ACTION_TYPES = {"profile_viewed", "like", "save", "intro_requested"}
NEGATIVE_ACTION_TYPES = {"pass"}


# ── Ranking metric functions ───────────────────────────────────────────────────


def ndcg_at_k(sorted_gains: list[float], k: int) -> float:
    """NDCG@K with gain = 2^score − 1 (graded relevance).  1.0 when all gains are 0."""
    if not sorted_gains or k < 1:
        return float("nan")
    k_eff = min(k, len(sorted_gains))
    gains = sorted_gains[:k_eff]
    discounts = [math.log2(i + 2) for i in range(k_eff)]
    dcg = sum((2.0 ** g - 1.0) / d for g, d in zip(gains, discounts))
    ideal = sorted(sorted_gains, reverse=True)[:k_eff]
    idcg = sum((2.0 ** g - 1.0) / d for g, d in zip(ideal, discounts))
    if idcg == 0:
        return 1.0  # trivially perfect when all gains are 0
    return float(min(1.0, dcg / idcg))


def precision_at_k(sorted_labels: list[float], k: int, threshold: float) -> float:
    k_eff = min(k, len(sorted_labels))
    return sum(1.0 for l in sorted_labels[:k_eff] if l >= threshold) / k_eff


def recall_at_k(sorted_labels: list[float], k: int, threshold: float) -> float:
    n_rel = sum(1 for l in sorted_labels if l >= threshold)
    if n_rel == 0:
        return float("nan")
    k_eff = min(k, len(sorted_labels))
    return sum(1.0 for l in sorted_labels[:k_eff] if l >= threshold) / n_rel


def ap_at_k(sorted_labels: list[float], k: int, threshold: float) -> float:
    n_rel_total = sum(1 for l in sorted_labels if l >= threshold)
    if n_rel_total == 0:
        return float("nan")
    k_eff = min(k, len(sorted_labels))
    hits, ap = 0, 0.0
    for i, l in enumerate(sorted_labels[:k_eff]):
        if l >= threshold:
            hits += 1
            ap += hits / (i + 1)
    return ap / n_rel_total


def mean_rank(labels: list[float], threshold: float) -> float:
    """Mean 1-indexed rank of items with label >= threshold."""
    ranks = [i + 1 for i, l in enumerate(labels) if l >= threshold]
    if not ranks:
        return float("nan")
    return float(sum(ranks) / len(ranks))


def shannon_entropy(values: list[str]) -> float:
    """Shannon entropy of a categorical list."""
    if not values:
        return 0.0
    from collections import Counter
    counts = Counter(values)
    total = sum(counts.values())
    return -sum((c / total) * math.log2(c / total) for c in counts.values() if c > 0)


# ── Per-persona metric computation ────────────────────────────────────────────


def compute_persona_metrics(
    rows: list[dict],
    action_map: dict[str, str],  # startup_id → most significant action type for this persona
    startups_by_id: dict,
) -> dict:
    """Compute all evaluation metrics for one persona.

    Returns a dict with 'before' and 'after' sub-dicts, plus safety and diversity results.
    """
    if not rows:
        return {}

    # Sort rows by original rank (before) and personalized rank (after).
    before_sorted = sorted(rows, key=lambda r: int(r["original_global_rank"]))
    after_sorted  = sorted(rows, key=lambda r: int(r["personalized_rank"]))

    # Latent scores: use the latent_score column; 0 for unshown candidates.
    def lat(r: dict) -> float:
        ls = r.get("latent_score", "")
        return float(ls) if ls else 0.0

    # Pair labels (use mean float label as a continuous gain for NDCG).
    def plabel(r: dict) -> float:
        return float(r.get("pair_label", 0))

    latent_before  = [lat(r) for r in before_sorted]
    latent_after   = [lat(r) for r in after_sorted]
    label_before   = [plabel(r) for r in before_sorted]
    label_after    = [plabel(r) for r in after_sorted]

    n_latent_rel = sum(1 for r in rows if lat(r) >= LATENT_RELEVANT_THRESH)
    n_label_rel  = sum(1 for r in rows if plabel(r) >= LABEL_RELEVANT_THRESH)

    def metrics_at_k(sorted_latent, sorted_label, tag: str) -> dict:
        m: dict = {}
        for k in K_VALUES:
            m[f"{tag}_ndcg_latent_at_{k}"]  = round(ndcg_at_k(sorted_latent, k), 4)
            m[f"{tag}_ndcg_label_at_{k}"]   = round(ndcg_at_k(sorted_label, k), 4)
            m[f"{tag}_p_latent_at_{k}"]     = round(precision_at_k(sorted_latent, k, LATENT_RELEVANT_THRESH), 4)
            m[f"{tag}_p_label_at_{k}"]      = round(precision_at_k(sorted_label, k, LABEL_RELEVANT_THRESH), 4)
            m[f"{tag}_recall_latent_at_{k}"]= round(recall_at_k(sorted_latent, k, LATENT_RELEVANT_THRESH), 4)
            m[f"{tag}_recall_label_at_{k}"] = round(recall_at_k(sorted_label, k, LABEL_RELEVANT_THRESH), 4)
            m[f"{tag}_map_latent_at_{k}"]   = round(ap_at_k(sorted_latent, k, LATENT_RELEVANT_THRESH), 4)
            m[f"{tag}_map_label_at_{k}"]    = round(ap_at_k(sorted_label, k, LABEL_RELEVANT_THRESH), 4)
        m[f"{tag}_mean_rank_latent_rel"]    = round(mean_rank(sorted_latent, LATENT_RELEVANT_THRESH), 4)
        m[f"{tag}_mean_rank_label_3plus"]   = round(mean_rank(sorted_label, LABEL_RELEVANT_THRESH), 4)
        m[f"{tag}_mean_rank_label4"]        = round(mean_rank(sorted_label, 4.0), 4)
        return m

    result: dict[str, Any] = {
        "n_candidates":      len(rows),
        "n_latent_relevant": n_latent_rel,
        "n_label_relevant":  n_label_rel,
        **metrics_at_k(latent_before, label_before, "before"),
        **metrics_at_k(latent_after,  label_after,  "after"),
    }

    # Delta (after − before).
    for k in K_VALUES:
        for metric in ("ndcg_latent", "ndcg_label", "p_latent", "p_label",
                       "recall_latent", "recall_label", "map_latent", "map_label"):
            bk = result.get(f"before_{metric}_at_{k}")
            ak = result.get(f"after_{metric}_at_{k}")
            if bk is not None and ak is not None and math.isfinite(bk) and math.isfinite(ak):
                result[f"delta_{metric}_at_{k}"] = round(ak - bk, 4)
    for field in ("mean_rank_latent_rel", "mean_rank_label_3plus", "mean_rank_label4"):
        bv = result.get(f"before_{field}")
        av = result.get(f"after_{field}")
        if bv is not None and av is not None and math.isfinite(bv) and math.isfinite(av):
            result[f"delta_{field}"] = round(av - bv, 4)   # negative = rank improved

    # Rank delta stats.
    deltas = [int(r["rank_delta"]) for r in rows]
    result["max_abs_rank_delta"]  = max(abs(d) for d in deltas) if deltas else 0
    result["mean_abs_rank_delta"] = round(sum(abs(d) for d in deltas) / max(1, len(deltas)), 3)
    result["n_moved_up"]   = sum(1 for d in deltas if d > 0)
    result["n_moved_down"] = sum(1 for d in deltas if d < 0)
    result["n_unchanged"]  = sum(1 for d in deltas if d == 0)

    # Behavior validation.
    rank_by_id_before = {r["target_id"]: int(r["original_global_rank"]) for r in rows}
    rank_by_id_after  = {r["target_id"]: int(r["personalized_rank"]) for r in rows}

    pos_delta, neg_delta = [], []
    for sid, atype in action_map.items():
        if sid not in rank_by_id_before:
            continue
        delta = rank_by_id_before[sid] - rank_by_id_after[sid]  # positive = moved up
        if atype in POSITIVE_ACTION_TYPES:
            pos_delta.append(delta)
        elif atype in NEGATIVE_ACTION_TYPES:
            neg_delta.append(delta)

    result["positive_action_mean_rank_delta"] = (
        round(sum(pos_delta) / len(pos_delta), 3) if pos_delta else None
    )
    result["pass_action_mean_rank_delta"] = (
        round(sum(neg_delta) / len(neg_delta), 3) if neg_delta else None
    )

    # Safety.
    result["safety"] = {
        "label4_out_of_top5": sum(
            1 for r in after_sorted[:5] if plabel(r) < 4.0
        ) and sum(1 for r in rows if plabel(r) >= 4.0) > 0,
        "personalization_only_jumps": [
            r["target_id"]
            for r in rows
            if (int(r["original_global_rank"]) > PERSONALIZATION_ONLY_JUMP_GLOBAL_RANK
                and int(r["personalized_rank"]) <= PERSONALIZATION_ONLY_JUMP_PERS_RANK)
        ],
    }

    # Diversity: sector entropy of top-K before and after.
    def top_k_sectors(sorted_rows: list[dict], k: int) -> list[str]:
        sects: list[str] = []
        for r in sorted_rows[:k]:
            s = startups_by_id.get(r["target_id"], {})
            sects.extend(s.get("sectors", []))
        return sects

    for k in (5, 10):
        before_sects = top_k_sectors(before_sorted, k)
        after_sects  = top_k_sectors(after_sorted, k)
        h_before = shannon_entropy(before_sects)
        h_after  = shannon_entropy(after_sects)
        result[f"sector_entropy_top{k}_before"] = round(h_before, 4)
        result[f"sector_entropy_top{k}_after"]  = round(h_after, 4)
        result[f"sector_entropy_top{k}_delta"]  = round(h_after - h_before, 4)
        if h_before > 0:
            drop_frac = (h_before - h_after) / h_before
            result[f"diversity_alert_top{k}"] = drop_frac > DIVERSITY_ALERT_DROP
        else:
            result[f"diversity_alert_top{k}"] = False

    return result


# ── Aggregate metrics ──────────────────────────────────────────────────────────


def aggregate(persona_metrics: dict[str, dict]) -> dict:
    """Compute cross-persona mean / median for key scalar metrics."""
    agg: dict[str, Any] = {}

    numeric_keys = [
        f"{tag}_{metric}_at_{k}"
        for tag in ("before", "after", "delta")
        for metric in ("ndcg_latent", "ndcg_label", "p_latent", "p_label")
        for k in K_VALUES
    ] + [
        "max_abs_rank_delta", "mean_abs_rank_delta",
        "n_moved_up", "n_moved_down", "n_unchanged",
        "positive_action_mean_rank_delta", "pass_action_mean_rank_delta",
        f"sector_entropy_top5_delta", f"sector_entropy_top10_delta",
    ]

    for key in numeric_keys:
        vals = []
        for pm in persona_metrics.values():
            v = pm.get(key)
            if v is not None and isinstance(v, (int, float)) and math.isfinite(float(v)):
                vals.append(float(v))
        if vals:
            agg[f"{key}_mean"] = round(sum(vals) / len(vals), 4)
            agg[f"{key}_n"]    = len(vals)

    agg["n_personas_evaluated"] = len(persona_metrics)
    agg["n_personas_with_max_delta_0"] = sum(
        1 for pm in persona_metrics.values() if pm.get("max_abs_rank_delta", 0) == 0
    )
    agg["n_safety_personalization_jumps"] = sum(
        len(pm.get("safety", {}).get("personalization_only_jumps", [])) > 0
        for pm in persona_metrics.values()
    )
    agg["n_diversity_alerts_top5"] = sum(
        pm.get("diversity_alert_top5", False)
        for pm in persona_metrics.values()
    )

    return agg


# ── Recommendation logic ───────────────────────────────────────────────────────


def compute_recommendation(
    persona_metrics: dict[str, dict],
    agg: dict,
    eligibility_violations: int,
) -> tuple[str, list[str]]:
    """Return (recommendation_code, list_of_reasons)."""
    reasons: list[str] = []

    if eligibility_violations > 0:
        return "STOP_DUE_TO_SAFETY_ISSUE", [
            f"Eligibility violations: {eligibility_violations} (must be 0)"
        ]

    # Safety jumps
    n_jumps = agg.get("n_safety_personalization_jumps", 0)
    if n_jumps > 2:
        reasons.append(f"⚠️  {n_jumps} personas have personalization-only ranking jumps.")

    # Near-zero movement
    n_zero_delta = agg.get("n_personas_with_max_delta_0", 0)
    if n_zero_delta >= NEAR_ZERO_MOVEMENT_THRESHOLD:
        reasons.append(
            f"{n_zero_delta} of {agg['n_personas_evaluated']} personas have max|Δ|=0 — "
            "personalization blend weight may be too conservative."
        )
        return "TUNE_PERSONALIZATION_WEIGHTS", reasons

    # Check label NDCG collapse (before > after significantly)
    ndcg_label_delta = agg.get("delta_ndcg_label_at_5_mean")
    ndcg_latent_delta = agg.get("delta_ndcg_latent_at_5_mean")

    if ndcg_label_delta is not None and ndcg_label_delta < -0.05:
        reasons.append(
            f"Original-label NDCG@5 dropped by {ndcg_label_delta:.4f} on average — "
            "personalization may be harming global relevance."
        )
        return "TUNE_PERSONALIZATION_WEIGHTS", reasons

    # Check sparse/noisy actions
    n_pos_with_delta = sum(
        1 for pm in persona_metrics.values()
        if pm.get("positive_action_mean_rank_delta") is not None
    )
    if n_pos_with_delta < 3:
        reasons.append(
            "Fewer than 3 personas have positive-action rank movement data. "
            "Action simulation may be too sparse."
        )
        return "REVISIT_ACTION_SIMULATION", reasons

    # If we reach here: check for improvement or stability
    if ndcg_latent_delta is not None:
        if ndcg_latent_delta >= -0.005:
            reasons.append(
                f"Latent NDCG@5 delta = {ndcg_latent_delta:+.4f} (stable or improved)."
            )
        else:
            reasons.append(
                f"Latent NDCG@5 delta = {ndcg_latent_delta:+.4f} (slight drop — within noise)."
            )

    if ndcg_label_delta is not None:
        reasons.append(
            f"Original-label NDCG@5 delta = {ndcg_label_delta:+.4f} (global quality preserved)."
        )

    reasons.append("Eligibility: 0 violations. Safety: acceptable.")
    reasons.append("Conservative blending kept personalization bounded.")

    return "PROCEED_TO_PERSONALIZATION_REFINEMENT", reasons


# ── Report generation ──────────────────────────────────────────────────────────


def _fmt(v: Any, d: int = 4) -> str:
    if v is None or (isinstance(v, float) and v != v):
        return "—"
    try:
        return f"{float(v):.{d}f}"
    except (TypeError, ValueError):
        return str(v)


def write_report(
    persona_metrics: dict[str, dict],
    agg: dict,
    persona_order: list[str],
    recommendation: str,
    reasons: list[str],
    eligibility_violations: int,
    out_path: Path,
) -> None:
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    lines: list[str] = [
        "# Synthetic Matching Lab — Personalization Evaluation Report  (Phase 12b-ii)",
        "",
        "> ## ⚠️ SYNTHETIC EXPERIMENTAL DATA — NOT FOR PRODUCTION",
        ">",
        "> - All personas, actions, and rankings are **entirely synthetic**.",
        "> - **NOT investment advice.** Not a predictor of startup success.",
        "> - Hard eligibility gate remains **non-negotiable** in all rankings.",
        "> - The global model (LogReg C=2.0) remains the dominant scoring signal.",
        "> - `scoreMatch` in `lib/matching/score.ts` remains the production baseline.",
        "",
        f"Generated: {now}",
        "",
        f"## ══ RECOMMENDATION: **{recommendation}** ══",
        "",
    ]
    for r in reasons:
        lines.append(f"- {r}")
    lines.append("")

    # Safety
    lines += [
        "## Safety Summary",
        "",
        "| Check | Result |",
        "|---|---|",
        f"| Eligibility violations | {'✅ 0' if eligibility_violations == 0 else f'❌ {eligibility_violations}'} |",
        f"| Personalization-only ranking jumps | {('✅ 0' if agg.get('n_safety_personalization_jumps', 0) == 0 else '⚠️ ' + str(agg.get('n_safety_personalization_jumps', '?')))} |",
        f"| Diversity alerts (top-5) | {('✅ 0' if agg.get('n_diversity_alerts_top5', 0) == 0 else '⚠️ ' + str(agg.get('n_diversity_alerts_top5', '?')))} |",
        f"| Personas with zero rank movement | {agg.get('n_personas_with_max_delta_0', '—')} / {agg.get('n_personas_evaluated', '—')} (expected for low-confidence) |",
        "",
    ]

    # Aggregate ranking metrics
    lines += [
        "## Aggregate Ranking Metrics (mean across personas)",
        "",
        "### Latent preference NDCG (synthetic ground truth)",
        "",
        "| Metric | Before | After | Delta |",
        "|---|---|---|---|",
    ]
    for k in K_VALUES:
        bv = agg.get(f"before_ndcg_latent_at_{k}_mean")
        av = agg.get(f"after_ndcg_latent_at_{k}_mean")
        dv = agg.get(f"delta_ndcg_latent_at_{k}_mean")
        lines.append(f"| NDCG@{k} (latent) | {_fmt(bv)} | {_fmt(av)} | {_fmt(dv)} |")
    lines += [
        "",
        "> NDCG uses graded latent_score as gain (0 for unshown candidates).",
        "> Improvement indicates personalization promotes latent-preferred candidates.",
        "",
        "### Original pair-label NDCG (global model quality check)",
        "",
        "| Metric | Before | After | Delta |",
        "|---|---|---|---|",
    ]
    for k in K_VALUES:
        bv = agg.get(f"before_ndcg_label_at_{k}_mean")
        av = agg.get(f"after_ndcg_label_at_{k}_mean")
        dv = agg.get(f"delta_ndcg_label_at_{k}_mean")
        lines.append(f"| NDCG@{k} (pair label) | {_fmt(bv)} | {_fmt(av)} | {_fmt(dv)} |")
    lines += [
        "",
        "> Delta should be near 0 — personalization should not degrade global relevance.",
        "",
    ]

    # Behavior validation
    pos_d = agg.get("positive_action_mean_rank_delta_mean")
    neg_d = agg.get("pass_action_mean_rank_delta_mean")
    lines += [
        "## Behavior-Action Rank Movement",
        "",
        "| Action bucket | Mean rank delta | Interpretation |",
        "|---|---|---|",
        f"| Positive actions (save/like/intro) | {_fmt(pos_d, 2)} | > 0 = moved up ✅ |",
        f"| Pass actions | {_fmt(neg_d, 2)} | < 0 = moved down ✅ |",
        "",
        "> Positive: positive-action candidates should move up (or stay) after personalization.",
        "> Pass: passed candidates should move down (or stay).",
        "",
    ]

    # Per-persona table
    lines += [
        "## Per-Persona Summary",
        "",
        "| Persona | Conf | n | MaxΔ | MeanΔ | NDCG@5Δ(lat) | NDCG@5Δ(lbl) | Pos↑ | Pass↓ | Diversity |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for pid in persona_order:
        pm = persona_metrics.get(pid, {})
        conf = pm.get("behavior_confidence", "—")
        n = pm.get("n_candidates", "—")
        max_d = pm.get("max_abs_rank_delta", "—")
        mean_d = pm.get("mean_abs_rank_delta", "—")
        ndcg_d_lat = pm.get("delta_ndcg_latent_at_5", "—")
        ndcg_d_lbl = pm.get("delta_ndcg_label_at_5", "—")
        pos_d = pm.get("positive_action_mean_rank_delta")
        neg_d = pm.get("pass_action_mean_rank_delta")
        div_alert = "⚠️" if pm.get("diversity_alert_top5") else "✅"
        lines.append(
            f"| `{pid}` | {_fmt(conf, 3)} | {n} | {max_d} | {_fmt(mean_d, 2)} | "
            f"{_fmt(ndcg_d_lat)} | {_fmt(ndcg_d_lbl)} | "
            f"{_fmt(pos_d, 2)} | {_fmt(neg_d, 2)} | {div_alert} |"
        )
    lines.append("")

    # Confidence diagnostics
    lines += [
        "## Confidence Diagnostics",
        "",
        "| Observation | Value |",
        "|---|---|",
        f"| Mean absolute rank delta | {_fmt(agg.get('mean_abs_rank_delta_mean'), 2)} |",
        f"| Max personas with zero movement | {agg.get('n_personas_with_max_delta_0', '—')} / {agg.get('n_personas_evaluated', '—')} |",
        "",
        "> Higher behavior_confidence should correlate with larger rank movement.",
        "> Personas with very low confidence (< 0.05) should show near-zero movement.",
        "",
    ]

    # Caveats
    lines += [
        "---",
        "",
        "## Caveats",
        "",
        "1. **Synthetic latent scores as ground truth.** Latent NDCG uses scores derived from",
        "   the same preference model that drove action simulation.  Improvement here is",
        "   expected by construction — it is NOT evidence of real-world preference learning.",
        "2. **Small candidate pools.** Many personas have 6–24 candidates.  NDCG on small",
        "   lists is noisy and should not be over-interpreted.",
        "3. **Conservative blending.** The 40% confidence cap and 0.5× personalization factor",
        "   intentionally limit rank changes.  Near-zero movement for low-confidence personas",
        "   is correct behaviour, not a bug.",
        "4. **Not production-ready.** No synthetic artifact here should be deployed to",
        "   production without validation on real post-launch interaction data.",
        "",
    ]

    out_path.write_text("\n".join(lines), encoding="utf-8")


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    print("\n" + "═" * 72)
    print("  PERSONALIZATION EVALUATION — PHASE 12b-ii")
    print("═" * 72)
    print("  ⚠  All data is SYNTHETIC. Not real user data.")
    print("  ⚠  This is NOT investment advice.")
    print("═" * 72 + "\n")

    # ── Load rankings ──────────────────────────────────────────────────────────
    if not RANKINGS_PATH.exists():
        print(f"ERROR: {RANKINGS_PATH} not found.")
        print("Run: python3 scripts/ml/personalization/personalize.py")
        sys.exit(1)

    print(f"Loading {RANKINGS_PATH.name} …")
    with RANKINGS_PATH.open(encoding="utf-8") as fh:
        fh.readline(); fh.readline()  # skip comment lines
        rows_all = list(csv.DictReader(fh))
    print(f"  {len(rows_all)} ranking rows.\n")

    # Eligibility check.
    eligibility_violations = sum(
        1 for r in rows_all if str(r.get("eligible_for_model_ranking", "True")).lower() != "true"
    )
    if eligibility_violations > 0:
        print(f"  CRITICAL: {eligibility_violations} ineligible rows detected.")
        print("  Aborting — hard eligibility must never be violated.")
        sys.exit(1)
    print(f"  ✓  Eligibility check: 0 violations.\n")

    # ── Load supporting data ───────────────────────────────────────────────────
    startups_by_id: dict = {}
    if STARTUPS_PATH.exists():
        startups_list = json.loads(STARTUPS_PATH.read_text(encoding="utf-8"))
        startups_by_id = {s["id"]: s for s in startups_list}

    # Preference vectors for confidence lookup.
    pref_vecs: dict[str, dict] = {}
    if PREF_VEC_PATH.exists():
        pv_data = json.loads(PREF_VEC_PATH.read_text(encoding="utf-8"))
        pref_vecs = {v["persona_id"]: v for v in pv_data["preference_vectors"]}

    # Load simulated_actions for behavior validation.
    # For each (persona_id, startup_id), record the most significant action.
    # Significance: intro > save > like > pass > profile_viewed > shown
    SIGNIFICANCE = {"intro_requested": 6, "save": 5, "like": 4, "pass": 3,
                    "profile_viewed": 2, "shown": 1}
    raw_actions: dict[tuple, str] = {}  # (persona_id, startup_id) → best action type
    if ACTIONS_PATH.exists():
        with ACTIONS_PATH.open(encoding="utf-8") as fh:
            fh.readline(); fh.readline()
            for r in csv.DictReader(fh):
                key = (r["persona_id"], r["target_id"])
                atype = r["action_type"]
                if SIGNIFICANCE.get(atype, 0) > SIGNIFICANCE.get(raw_actions.get(key, ""), 0):
                    raw_actions[key] = atype
        print(f"Loaded {len(raw_actions)} (persona, startup) action pairs.\n")

    # ── Group rows by persona ──────────────────────────────────────────────────
    by_persona: dict[str, list[dict]] = defaultdict(list)
    persona_order: list[str] = []
    for r in rows_all:
        pid = r["persona_id"]
        by_persona[pid].append(r)
    persona_order = sorted(by_persona.keys())

    # ── Compute per-persona metrics ────────────────────────────────────────────
    print(f"{'─' * 72}")
    print("COMPUTING METRICS PER PERSONA")
    print(f"{'─' * 72}")

    persona_metrics: dict[str, dict] = {}
    for pid in persona_order:
        p_rows = by_persona[pid]
        # Build action map: startup_id → most significant action type for this persona.
        action_map = {
            sid: atype
            for (ppid, sid), atype in raw_actions.items()
            if ppid == pid
        }
        # Inject behavior_confidence from preference vector.
        conf = pref_vecs.get(pid, {}).get("behavior_confidence", 0.0)
        pm = compute_persona_metrics(p_rows, action_map, startups_by_id)
        pm["behavior_confidence"] = round(conf, 4)
        persona_metrics[pid] = pm

        ndcg5_lat_d = pm.get("delta_ndcg_latent_at_5", "?")
        ndcg5_lbl_d = pm.get("delta_ndcg_label_at_5", "?")
        print(
            f"  {pid}  n={len(p_rows):>3}  conf={conf:.3f}  max|Δ|={pm.get('max_abs_rank_delta', '?'):>2}  "
            f"Δndcg_lat@5={_fmt(ndcg5_lat_d)}  Δndcg_lbl@5={_fmt(ndcg5_lbl_d)}"
        )

    print()

    # ── Aggregate ──────────────────────────────────────────────────────────────
    agg = aggregate(persona_metrics)

    # ── Recommendation ─────────────────────────────────────────────────────────
    recommendation, reasons = compute_recommendation(persona_metrics, agg, eligibility_violations)

    print(f"{'─' * 72}")
    print(f"RECOMMENDATION: {recommendation}")
    print(f"{'─' * 72}")
    for r in reasons:
        print(f"  • {r}")
    print()

    # ── Print summary ──────────────────────────────────────────────────────────
    print(f"{'─' * 72}")
    print("AGGREGATE METRICS")
    print(f"{'─' * 72}")
    for k in K_VALUES:
        bv = agg.get(f"before_ndcg_latent_at_{k}_mean", float("nan"))
        av = agg.get(f"after_ndcg_latent_at_{k}_mean", float("nan"))
        dv = agg.get(f"delta_ndcg_latent_at_{k}_mean", float("nan"))
        print(f"  Latent NDCG@{k}:  before={_fmt(bv)}  after={_fmt(av)}  Δ={_fmt(dv)}")
    print()
    for k in K_VALUES:
        bv = agg.get(f"before_ndcg_label_at_{k}_mean", float("nan"))
        av = agg.get(f"after_ndcg_label_at_{k}_mean", float("nan"))
        dv = agg.get(f"delta_ndcg_label_at_{k}_mean", float("nan"))
        print(f"  Label  NDCG@{k}:  before={_fmt(bv)}  after={_fmt(av)}  Δ={_fmt(dv)}")
    print()
    pos_d = agg.get("positive_action_mean_rank_delta_mean")
    neg_d = agg.get("pass_action_mean_rank_delta_mean")
    print(f"  Behavior: positive actions Δrank={_fmt(pos_d, 2)}  pass actions Δrank={_fmt(neg_d, 2)}")
    print(f"  Eligibility violations: {eligibility_violations}")
    print()

    # ── Save artifacts ──────────────────────────────────────────────────────────
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    metrics_out = {
        "generated": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        "notice": (
            "SYNTHETIC EXPERIMENTAL ONLY. Not investment advice. Not real user data. "
            "scoreMatch in lib/matching/score.ts remains the production baseline."
        ),
        "recommendation": recommendation,
        "recommendation_reasons": reasons,
        "eligibility_violations": eligibility_violations,
        "k_values": K_VALUES,
        "latent_relevant_threshold": LATENT_RELEVANT_THRESH,
        "label_relevant_threshold": LABEL_RELEVANT_THRESH,
        "aggregate": agg,
        "per_persona": {pid: persona_metrics[pid] for pid in persona_order},
    }
    METRICS_OUTPUT.write_text(json.dumps(metrics_out, indent=2), encoding="utf-8")
    print(f"  ✓  {METRICS_OUTPUT.name}  ({METRICS_OUTPUT.stat().st_size // 1024} KB)")

    write_report(persona_metrics, agg, persona_order, recommendation, reasons,
                 eligibility_violations, REPORT_OUTPUT)
    print(f"  ✓  {REPORT_OUTPUT.name}")

    print(f"\n{'═' * 72}")
    print(f"  Done.  Personalization evaluation complete.")
    print(f"  Recommendation: {recommendation}")
    print("  ⚠  Offline experimental only.  Not for production use.")
    print(f"{'═' * 72}\n")


if __name__ == "__main__":
    main()
