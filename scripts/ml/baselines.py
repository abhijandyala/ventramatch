#!/usr/bin/env python3
"""
scripts/ml/baselines.py

Baseline ranking scorers for the synthetic matching lab (Phase 11a).

Two baselines are implemented:

  1. random — assigns deterministically random scores (seed=42).  Used as a
     floor: any model with real signal must beat this.

  2. scorematch_approx — an OFFLINE approximation of the production scoreMatch
     heuristic in lib/matching/score.ts, computed from the synthetic feature set
     in lib/matching/features.ts.

     IMPORTANT: This is NOT a direct call to scoreMatch.  The adapter:
       - Uses the same weight constants as scoreMatch v1.1 (verified in
         lib/matching/score.ts WEIGHTS object: sector=0.28, stage=0.23,
         check=0.20, geography=0.14, traction=0.10, process=0.05).
       - Applies those weights to the offline features computed by
         computeMatchFeatures in lib/matching/features.ts, which are already
         stored in pairs.json.

     Known differences from production scoreMatch:
       a. sector_overlap_score is fractional (0–1 across all startup sectors);
          production uses a binary 0/1 per sectorMatches().
       b. traction_strength_score maps to a coarse tier enum; production uses
          structured startup_traction_signals rows with per-kind thresholds.
       c. lead_follow_score approximates "process"; production uses
          investor_check_bands + startup_round_details.lead_status.
       d. anti_thesis_conflict_score is excluded from the baseline score.
          Production scoreMatch v1.1 has no explicit anti-thesis penalty in its
          formula; it applies hard caps via applyLabelCaps, not a negative weight.

     These differences are acceptable for a ranking baseline — we are asking
     "approximately how would the production heuristic order these pairs?" not
     "will this score match the exact production score?"

     This module never imports app/, db/, or route code.
     It is never deployed to production.

NOTICE:
  - All data processed here is entirely SYNTHETIC.
  - This module is NOT investment advice.
  - It does NOT predict startup success or investment returns.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    import pandas as pd

# ── scoreMatch weight constants ───────────────────────────────────────────────
# Mirror of WEIGHTS in lib/matching/score.ts (v1.1).
# If those weights change in production, update this dict in the same commit.

SCOREMATCH_WEIGHTS: dict[str, float] = {
    "sector_overlap_score": 0.28,
    "stage_match_score": 0.23,
    "check_size_score": 0.20,
    "geography_score": 0.14,
    "traction_strength_score": 0.10,
    "lead_follow_score": 0.05,
}

# Weights sum to 1.00 (sanity check — verified against score.ts WEIGHTS).
assert abs(sum(SCOREMATCH_WEIGHTS.values()) - 1.0) < 1e-9, (
    "SCOREMATCH_WEIGHTS do not sum to 1.0 — check lib/matching/score.ts"
)


# ── Random baseline ────────────────────────────────────────────────────────────


def random_scores(n: int, random_state: int = 42) -> "np.ndarray":
    """Return n deterministically random floats in [0, 1).

    The RNG is re-seeded on every call so scores are reproducible regardless of
    call order in the evaluation pipeline.

    Args:
        n:            Number of scores to generate.
        random_state: Seed for reproducibility.

    Returns:
        numpy array of floats, shape (n,).
    """
    rng = np.random.default_rng(random_state)
    return rng.random(n)


# ── scoreMatch offline approximation ─────────────────────────────────────────


def scorematch_approx_scores(df: "pd.DataFrame") -> "np.ndarray":
    """Compute offline scoreMatch-approximate scores for each row in df.

    See module-level docstring for a full description of how this differs from
    the production scoreMatch function.

    Scores are clipped to [0.0, 1.0].  Higher score = stronger predicted fit.
    Suitable for use as a ranking signal.

    Args:
        df: DataFrame whose columns include the keys of SCOREMATCH_WEIGHTS.
            Missing feature columns are treated as 0.0 (no contribution).

    Returns:
        numpy array of float scores, shape (len(df),).
    """
    score = np.zeros(len(df), dtype=float)
    for feat, weight in SCOREMATCH_WEIGHTS.items():
        if feat in df.columns:
            score += df[feat].fillna(0.0).to_numpy() * weight
    return np.clip(score, 0.0, 1.0)
