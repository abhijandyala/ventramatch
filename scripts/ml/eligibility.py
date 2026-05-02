#!/usr/bin/env python3
"""
scripts/ml/eligibility.py

Python mirror of lib/matching/eligibility.ts (Phase 10).

─── SOURCE OF TRUTH ──────────────────────────────────────────────────────────
  lib/matching/eligibility.ts is the CANONICAL definition of all hard
  eligibility constants and logic.  This file is a Python mirror for use by
  the ML training pipeline only.

  If any constant changes in the TypeScript module, it MUST be updated here
  in the same commit.  The two files must stay byte-for-byte equivalent on
  threshold values.  A mismatch will be detected and reported by
  train_synthetic_matching.py at load time.
──────────────────────────────────────────────────────────────────────────────

NOTICE: This module is part of the synthetic matching pipeline only.
  • All data it operates on is entirely SYNTHETIC.
  • It does NOT touch scoreMatch in lib/matching/score.ts.
  • It does NOT touch the production feed in lib/feed/query.ts.
  • It is NEVER wired into any production path.
  • Nothing it produces is investment advice.
  • Nothing it produces predicts startup success or investment returns.

PURPOSE
───────
Hard eligibility separates two conceptually distinct operations in the future
global matching model:

  1. Hard eligibility gate (this module) — determines whether a pair is even
     safe/reasonable to rank at all.  These are POLICY rules, not learned
     preferences.  They encode hard investor mandate constraints that must be
     respected unconditionally.

  2. Model ranking — applies only to eligible pairs.  A classifier learns
     relative preference signals across eligible pairs.  Ineligible pairs
     must be filtered before the model ever sees a pair at inference time.

Hard constraints are NOT the same as the label caps in
scripts/generate-synthetic-match-pairs.ts.  Label caps reduce the label
ceiling of a pair.  Eligibility removes the pair from the ranking pool
entirely.  The two mechanisms co-exist; see lib/matching/eligibility.ts for
the full explanation.
"""

from __future__ import annotations

from typing import Any

# ── Hard eligibility thresholds ───────────────────────────────────────────────
# Mirror of HARD_ELIGIBILITY_THRESHOLDS in lib/matching/eligibility.ts.
# These are POLICY constants — do NOT tune them like model hyperparameters.

ANTI_THESIS_MAX: float = 0.5
"""anti_thesis_conflict_score >= this → ineligible.
Mirrors ANTI_THESIS_CAP in generate-synthetic-match-pairs.ts (label cap) and
HARD_ELIGIBILITY_THRESHOLDS.ANTI_THESIS_MAX in eligibility.ts (policy gate)."""

STAGE_MIN: float = 0.0
"""stage_match_score === STAGE_MIN (exactly 0) → ineligible.
Adjacent-stage pairs (score = 0.5) remain eligible for ranking."""

CHECK_SIZE_MIN: float = 0.25
"""check_size_score < this → ineligible.
Mirrors CHECK_SIZE_CAP in generate-synthetic-match-pairs.ts."""

# ── Hard filter reason codes ───────────────────────────────────────────────────
# Mirror of HardFilterReason union type in lib/matching/eligibility.ts.

HARD_FILTER_REASONS: tuple[str, ...] = (
    "anti_thesis_conflict",
    "stage_mismatch",
    "check_size_mismatch",
)


def evaluate_eligibility(features: dict[str, Any]) -> dict[str, Any]:
    """Evaluate whether a startup–investor feature pair is eligible for model
    ranking.

    Mirrors evaluateEligibility in lib/matching/eligibility.ts exactly.
    Applies hard policy constraints only — does NOT assign or modify labels.

    Args:
        features: dict of feature_name → numeric value, as stored under the
                  "features" key in pairs.json, or as a flat dict of a
                  DataFrame row.  Missing keys are treated as 0.0.

    Returns:
        {
            "eligible_for_model_ranking": bool,
            "hard_filter_reasons": list[str],  # empty when eligible
        }
    """
    reasons: list[str] = []

    anti = float(features.get("anti_thesis_conflict_score") or 0.0)
    stage = float(features.get("stage_match_score") or 0.0)
    check = float(features.get("check_size_score") or 0.0)

    if anti >= ANTI_THESIS_MAX:
        reasons.append("anti_thesis_conflict")

    # Strict equality: only exactly-zero stage score triggers this gate.
    # Adjacent-stage pairs (score = 0.5) remain eligible.
    if stage == STAGE_MIN:
        reasons.append("stage_mismatch")

    if check < CHECK_SIZE_MIN:
        reasons.append("check_size_mismatch")

    return {
        "eligible_for_model_ranking": len(reasons) == 0,
        "hard_filter_reasons": reasons,
    }
