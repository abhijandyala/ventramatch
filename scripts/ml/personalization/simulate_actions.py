#!/usr/bin/env python3
"""
scripts/ml/personalization/simulate_actions.py

Simulate investor-side user actions for the 12 synthetic personas (Phase 12a-ii).

─── NOTICE ──────────────────────────────────────────────────────────────────
  • All personas and actions are ENTIRELY SYNTHETIC.
  • No real investor, founder, or user is represented.
  • This script is NOT investment advice.
  • It does NOT predict startup success or investment returns.
  • Latent preferences drive action generation here ONLY.
    They must NEVER be read by personalize.py or eval_personalization.py.
  • `scoreMatch` in lib/matching/score.ts remains the production baseline.
─────────────────────────────────────────────────────────────────────────────

Action semantics
────────────────
  shown            Always recorded. Zero learning weight. Represents "this
                   candidate appeared in the feed" — the baseline impression.

  profile_viewed   Weakly positive curiosity signal. Persona clicked through
                   to read more but has not yet acted decisively.

  save             Strong positive intent. Persona wants to revisit.

  like             Strong positive intent. Persona signals interest.

  pass             Strong negative signal. Persona explicitly rejected.

  intro_requested  Strongest positive intent. Persona requests an introduction.

⚠️  latent_score in simulated_actions.csv is FOR AUDIT/DEBUG ONLY.
    The personalization model in personalize.py must NOT read this column.
    It is present only so reviewers can verify that actions are plausible
    given each persona's stated preferences.

Usage (from repo root):
    python3 scripts/ml/personalization/simulate_actions.py

Output:
    data/synthetic-matching/artifacts/simulated_actions.csv
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any, Optional

# ── Module resolution ──────────────────────────────────────────────────────────

_ML_DIR = Path(__file__).resolve().parent.parent      # scripts/ml
_REPO_ROOT = _ML_DIR.parent.parent                    # VentraMatch
if str(_ML_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_DIR))

from personalization.persona_models import Persona  # noqa: E402

# ── Paths ──────────────────────────────────────────────────────────────────────

ARTIFACTS_DIR  = _REPO_ROOT / "data" / "synthetic-matching" / "artifacts"
DATA_DIR       = _REPO_ROOT / "data" / "synthetic-matching"

PERSONAS_PATH  = ARTIFACTS_DIR / "synthetic_personas.json"
PAIRS_PATH     = DATA_DIR / "pairs.json"
STARTUPS_PATH  = DATA_DIR / "startups.json"
OUTPUT_PATH    = ARTIFACTS_DIR / "simulated_actions.csv"

# ── Constants ──────────────────────────────────────────────────────────────────

# Minimum number of eligible pairs in an anchor pool before we fall back to
# the full eligible set.  Anchors with fewer pairs cannot support realistic
# simulation of n_actions_simulated shown candidates.
MIN_ANCHOR_POOL_SIZE = 5

# Sampling strategy for shown candidates.
# Negative-latent candidates (latent_score < 0) are the primary source of pass actions.
# Without forcing some into the shown pool, label-weighted sampling almost never selects
# them (they correlate with low pair labels too), leading to near-zero pass rates.
#   NEGATIVE_FORCED_FRACTION  — up to this share of shown slots is reserved for
#       negative-latent candidates (most-negative first).  Capped so positives still
#       dominate the shown set.
#   PASS_PROB_BASE            — minimum pass probability for any candidate whose
#       noisy latent score is < 0 (prevents near-zero negatives from slipping by).
#   PASS_PROB_COEFF           — coefficient on the score-proportional pass term.
NEGATIVE_FORCED_FRACTION: float = 0.45
# Latent score threshold below which a candidate is considered "low-scoring"
# for forced-inclusion purposes.  Using 0.25 instead of 0.0 widens the pool
# to include lukewarm candidates (0.0–0.25), giving all personas some
# low-enthusiasm candidates to react to even when all eligible startups
# have weakly positive mandate fit.
LOW_SCORE_THRESHOLD: float = 0.25
# Lukewarm pass rate: small probability of passing on a candidate whose
# noisy latent score falls in [0, LOW_SCORE_THRESHOLD).  Mirrors real
# user behaviour — users occasionally skip mediocre matches to see
# what else is available.
LUKEWARM_PASS_RATE: float = 0.12
# Fatigue pass rate: small base probability of passing any shown candidate,
# even one with a positive latent score.  Models real user behaviour —
# investors skip good matches due to time pressure, recency bias, or
# already having found a better candidate.  Ensures every persona generates
# at least some pass signal regardless of pool composition.
FATIGUE_PASS_RATE: float = 0.08
PASS_PROB_BASE: float = 0.30
PASS_PROB_COEFF: float = 0.65

# Traction tier ordering (weakest → strongest).
TRACTION_ORDER: list[str] = [
    "no_traction", "waitlist", "design_partners", "pilots",
    "paying_customers", "mrr", "arr", "enterprise_contracts",
]

# CSV columns written to simulated_actions.csv.
# latent_score is marked debug-only in the file header.
CSV_COLUMNS: list[str] = [
    "persona_id",
    "persona_name",
    "action_type",
    "target_id",
    "target_kind",
    "anchored_investor_id",
    "timestamp_seq",
    # ── DEBUG COLUMN — personalization model must not use this ──
    "latent_score",
    # ───────────────────────────────────────────────────────────
    "eligible_for_model_ranking",
    "hard_filter_reasons",
    "pair_label",
    "pair_label_name",
    "semantic_similarity_score",
    "sector_overlap_score",
    "stage_match_score",
    "check_size_score",
]


# ── Latent score ───────────────────────────────────────────────────────────────


def compute_latent_score(
    startup: dict[str, Any],
    prefs: Any,  # LatentPreferences instance
    pair_label: int,
) -> float:
    """Compute ground-truth latent preference score for (persona, startup).

    ⚠️  Uses latent_preferences.  MUST NOT be called from personalize.py or
    eval_personalization.py — those scripts only see the action stream.

    Args:
        startup:    Startup profile dict from startups.json.
        prefs:      LatentPreferences from the persona.
        pair_label: Highest eligible-pair label for this startup (0–4).
                    Used as a small global prior so neutral cases are not
                    purely random.

    Returns:
        Score in [-1.0, 1.0].  Positive = persona would prefer this startup.
    """
    score = 0.0

    # ── Sector matching (dominant signal) ─────────────────────────────────────
    startup_sectors: list[str] = startup.get("sectors", [])
    pos_hits = sum(1 for s in startup_sectors if s in prefs.preferred_sectors)
    neg_hits = sum(1 for s in startup_sectors if s in prefs.avoided_sectors)
    score += min(0.50, pos_hits * 0.30)
    score -= min(0.50, neg_hits * 0.40)

    # ── Stage match / miss ────────────────────────────────────────────────────
    # Missing a preferred stage is a meaningful negative signal for stage-focused
    # investors — it is not just an absence of a bonus.
    if prefs.preferred_stages:
        if startup.get("stage") in prefs.preferred_stages:
            score += 0.20
        else:
            score -= 0.18   # stage miss: moderately negative

    # ── Customer type ─────────────────────────────────────────────────────────
    if startup.get("customer_type") in prefs.preferred_customer_types:
        score += 0.15

    # ── Business model ────────────────────────────────────────────────────────
    if startup.get("business_model") in prefs.preferred_business_models:
        score += 0.10

    # ── Geography ─────────────────────────────────────────────────────────────
    if prefs.preferred_geographies:
        location = startup.get("location", "").lower()
        if any(g.lower() in location for g in prefs.preferred_geographies):
            score += 0.10

    # ── Traction bar ──────────────────────────────────────────────────────────
    # Meeting the bar → small positive.  Falling 2+ tiers below the minimum
    # → moderate negative (the persona would notice the traction gap).
    startup_traction = startup.get("traction", "no_traction")
    min_traction = prefs.preferred_traction_min
    if startup_traction in TRACTION_ORDER and min_traction in TRACTION_ORDER:
        s_idx = TRACTION_ORDER.index(startup_traction)
        m_idx = TRACTION_ORDER.index(min_traction)
        if s_idx >= m_idx:
            score += 0.08
        elif m_idx - s_idx >= 2:    # meaningfully below the bar
            score -= 0.10

    # ── Small global prior from pair label ────────────────────────────────────
    # label 4 → +0.08, label 3 → +0.04, label 2 → 0,
    # label 1 → -0.04, label 0 → -0.08
    score += (pair_label - 2) * 0.04

    return max(-1.0, min(1.0, score))


def apply_noise(
    score: float,
    noise_level: float,
    rng: "random.Random",
) -> float:
    """With probability noise_level, replace score with a uniform random value.

    This simulates a user acting against their preferences on a given candidate —
    e.g., passing on a great match because of fatigue, or liking a weak match
    because of recency bias.

    A random replacement (rather than a simple sign-flip) produces a more
    realistic noise distribution that the personalization layer cannot easily
    learn to correct.
    """
    import random
    if rng.random() < noise_level:
        return rng.uniform(-1.0, 1.0)
    return score


# ── Candidate pool construction ────────────────────────────────────────────────


def build_candidate_pool(
    persona: Persona,
    eligible_pairs: list[dict[str, Any]],
    startups_by_id: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], str]:
    """Build the candidate startup pool for one persona.

    For anchored personas: prefer eligible pairs where investor_id = anchor.
    Falls back to all eligible pairs when the anchor pool is too small.

    For each unique startup_id, keeps the pair with the HIGHEST label as the
    representative feature row.  This ensures the feature columns in the output
    CSV reflect the most favourable known investor–startup relationship, giving
    downstream preference learning the richest available signal.

    Injects '_persona_prefs' into each candidate dict (stripped before CSV output).

    Returns:
        (candidates, pool_source_description)
    """
    anchor_pool: list[dict[str, Any]] = []
    if persona.anchored_investor_id:
        anchor_pool = [
            p for p in eligible_pairs
            if p["investor_id"] == persona.anchored_investor_id
        ]

    if len(anchor_pool) >= MIN_ANCHOR_POOL_SIZE:
        source_pool = anchor_pool
        pool_desc = f"anchor {persona.anchored_investor_id} ({len(anchor_pool)} eligible pairs)"
    else:
        source_pool = eligible_pairs
        if persona.anchored_investor_id and anchor_pool:
            print(
                f"  ⚠  {persona.id}: anchor pool has {len(anchor_pool)} pairs "
                f"(< {MIN_ANCHOR_POOL_SIZE}) → falling back to all eligible "
                f"({len(eligible_pairs)} pairs)"
            )
        elif persona.anchored_investor_id:
            print(
                f"  ⚠  {persona.id}: anchor {persona.anchored_investor_id} has 0 eligible pairs "
                f"→ falling back to all eligible ({len(eligible_pairs)} pairs)"
            )
        pool_desc = f"all eligible ({len(eligible_pairs)} pairs)"

    # Keep best-label representative pair per startup.
    best_per_startup: dict[str, dict[str, Any]] = {}
    for pair in source_pool:
        sid = pair["startup_id"]
        if sid not in best_per_startup or pair["label"] > best_per_startup[sid]["label"]:
            best_per_startup[sid] = pair

    candidates = list(best_per_startup.values())

    # Inject persona preferences and pre-compute noise-free latent scores.
    # _pre_latent_score drives the stratified sampling split (see
    # sample_shown_candidates): negatives are force-included so pass behavior
    # is represented even though label-weighted sampling would rarely pick them.
    for c in candidates:
        c["_persona_prefs"] = persona.latent_preferences
        startup = startups_by_id.get(c["startup_id"], {})
        c["_pre_latent_score"] = compute_latent_score(
            startup, persona.latent_preferences, c["label"]
        )

    return candidates, pool_desc


def sample_shown_candidates(
    candidates: list[dict[str, Any]],
    n_actions: int,
    rng: "random.Random",
) -> list[dict[str, Any]]:
    """Sample n_actions unique startups using a stratified exploit/explore split.

    The shown pool is split into two parts so that pass-generating behavior
    is reliably represented even though label-weighted sampling would almost
    never select negative-latent candidates on its own:

    Negative pool (force-included, up to NEGATIVE_FORCED_FRACTION of shown):
        Candidates whose _pre_latent_score < 0, ordered most-negative first.
        These are the primary source of pass actions.

    Positive pool (label-weighted, remaining slots):
        Candidates with _pre_latent_score ≥ 0, sampled via Efraimidis-Spirakis.
        These are the primary source of save/like/intro_requested actions.

    The combined list is shuffled before returning so action order is random.
    Caps at pool size if pool is smaller than n_actions.
    """
    n = min(n_actions, len(candidates))

    # Partition into "low-scoring" (below LOW_SCORE_THRESHOLD) and "high-scoring".
    # Using LOW_SCORE_THRESHOLD > 0 ensures that even when all candidates have
    # weakly positive mandate fit, the bottom slice still enters the forced pool
    # and can generate lukewarm-pass behaviour (see LUKEWARM_PASS_RATE).
    neg_pool = sorted(
        [c for c in candidates if c.get("_pre_latent_score", 0.0) < LOW_SCORE_THRESHOLD],
        key=lambda c: c["_pre_latent_score"],   # most-negative / least-positive first
    )
    pos_pool = [c for c in candidates if c.get("_pre_latent_score", 0.0) >= LOW_SCORE_THRESHOLD]

    # Force-include negative candidates (capped at NEGATIVE_FORCED_FRACTION).
    max_neg = max(1, int(round(n * NEGATIVE_FORCED_FRACTION)))
    forced_neg = neg_pool[:min(max_neg, len(neg_pool))]
    n_pos_slots = n - len(forced_neg)

    # Fill remaining slots with label-weighted candidates not already forced.
    # Draw from ALL remaining candidates (not just above LOW_SCORE_THRESHOLD)
    # so we never leave positive slots unfilled when the high-score pool is small.
    forced_ids = {c["startup_id"] for c in forced_neg}
    pos_eligible = [c for c in candidates if c["startup_id"] not in forced_ids]
    if not pos_eligible:
        pos_eligible = candidates   # degenerate fallback (all were forced)

    n_pos = min(n_pos_slots, len(pos_eligible))
    pos_weights = [max(0.1, c["label"] + 1) for c in pos_eligible]

    # Efraimidis-Spirakis: key = u^(1/w); take n_pos largest.
    pos_keys = [rng.random() ** (1.0 / max(0.01, w)) for w in pos_weights]
    pos_order = sorted(range(len(pos_eligible)), key=lambda i: pos_keys[i], reverse=True)
    pos_sampled = [pos_eligible[i] for i in pos_order[:n_pos]]

    combined = forced_neg + pos_sampled
    rng.shuffle(combined)
    return combined


# ── Action generation ──────────────────────────────────────────────────────────


def generate_actions_for_persona(
    persona: Persona,
    sampled_pairs: list[dict[str, Any]],
    startups_by_id: dict[str, dict[str, Any]],
    rng: "random.Random",
) -> list[dict[str, Any]]:
    """Generate the full action stream for one persona.

    For each shown candidate, the sequence is:
      1. shown          (always)
      2. profile_viewed (Bernoulli ~20–40% depending on latent score)
      3. primary action (multinomial: pass / like / save / intro_requested / none)

    Action probabilities scale monotonically with the noisy latent score:
      - High score  → save / like / intro_requested are more probable
      - Low score   → pass is more probable
      - Near zero   → no primary action (neutral, just shown/viewed)

    Noise injection: before computing action probabilities, apply_noise may
    replace the latent score with a random value, simulating a user ignoring
    their preferences for a given candidate.
    """
    import random

    prefs = persona.latent_preferences
    rows: list[dict[str, Any]] = []
    seq = 1

    for pair in sampled_pairs:
        startup = startups_by_id[pair["startup_id"]]

        raw_score = compute_latent_score(
            startup,
            pair["_persona_prefs"],
            pair["label"],
        )
        noisy_score = apply_noise(raw_score, prefs.noise_level, rng)

        # Shared fields for all events on this candidate.
        base: dict[str, Any] = {
            "persona_id": persona.id,
            "persona_name": persona.name,
            "target_id": pair["startup_id"],
            "target_kind": "startup",
            "anchored_investor_id": persona.anchored_investor_id,
            # ── Debug-only column; personalize.py must NOT read this ──
            "latent_score": round(raw_score, 4),
            # ─────────────────────────────────────────────────────────
            "eligible_for_model_ranking": pair["eligible_for_model_ranking"],
            "hard_filter_reasons": json.dumps(pair.get("hard_filter_reasons", [])),
            "pair_label": pair["label"],
            "pair_label_name": pair["label_name"],
            "semantic_similarity_score": pair["features"].get("semantic_similarity_score"),
            "sector_overlap_score": pair["features"].get("sector_overlap_score"),
            "stage_match_score": pair["features"].get("stage_match_score"),
            "check_size_score": pair["features"].get("check_size_score"),
        }

        # 1. shown — always.
        rows.append({**base, "action_type": "shown", "timestamp_seq": seq})
        seq += 1

        # 2. profile_viewed — weakly positive Bernoulli.
        p_viewed = 0.20 + 0.20 * max(0.0, noisy_score)
        if rng.random() < p_viewed:
            rows.append({**base, "action_type": "profile_viewed", "timestamp_seq": seq})
            seq += 1

        # 3. Primary action — multinomial draw.
        p_intro = max(0.0, (noisy_score - 0.50) * 0.20)   # only for very high scores
        p_save  = max(0.0, noisy_score * 0.25)
        p_like  = max(0.0, noisy_score * 0.30)
        # Pass probability:
        # - Negative noisy score: PASS_PROB_BASE floor + score-scaled term.
        # - Lukewarm zone [0, LOW_SCORE_THRESHOLD): LUKEWARM_PASS_RATE — mirrors
        #   real user behaviour of skipping mediocre-but-not-bad candidates.
        # - Above LOW_SCORE_THRESHOLD: no pass (user engages positively).
        if noisy_score < 0.0:
            p_pass = max(PASS_PROB_BASE, -noisy_score * PASS_PROB_COEFF)
        elif noisy_score < LOW_SCORE_THRESHOLD:
            p_pass = LUKEWARM_PASS_RATE       # lukewarm: meaningful skip rate
        else:
            p_pass = FATIGUE_PASS_RATE        # good candidate: small fatigue skip
        total_p = p_intro + p_save + p_like + p_pass

        if total_p > 1e-4:
            r = rng.random()
            if r < p_intro:
                action: Optional[str] = "intro_requested"
            elif r < p_intro + p_save:
                action = "save"
            elif r < p_intro + p_save + p_like:
                action = "like"
            elif r < p_intro + p_save + p_like + p_pass:
                action = "pass"
            else:
                action = None

            if action is not None:
                rows.append({**base, "action_type": action, "timestamp_seq": seq})
                seq += 1

    return rows


# ── Validation ─────────────────────────────────────────────────────────────────


def validate_output(
    all_rows: list[dict[str, Any]],
    personas: list[Persona],
) -> list[str]:
    """Run post-generation validation checks.  Returns list of warning strings."""
    warnings: list[str] = []

    persona_ids = {p.id for p in personas}
    shown_counts = {p.id: 0 for p in personas}
    ineligible_rows = []

    for row in all_rows:
        pid = row["persona_id"]
        if row["action_type"] == "shown":
            shown_counts[pid] = shown_counts.get(pid, 0) + 1
        if not row["eligible_for_model_ranking"]:
            ineligible_rows.append(row)
        if row["target_kind"] != "startup":
            warnings.append(
                f"target_kind != 'startup' in row: {row['persona_id']} / {row['target_id']}"
            )

    # Every persona must have at least one shown action.
    for p in personas:
        if shown_counts.get(p.id, 0) == 0:
            warnings.append(f"CRITICAL: {p.id} has 0 shown actions.")

    # No ineligible pair should appear.
    if ineligible_rows:
        warnings.append(
            f"CRITICAL: {len(ineligible_rows)} ineligible pairs found in output."
        )

    # Cold-start persona should have ~5 shown rows.
    cold_start_ids = [p.id for p in personas if p.n_actions_simulated <= 8]
    for pid in cold_start_ids:
        n_shown = shown_counts.get(pid, 0)
        if n_shown > 10:
            warnings.append(
                f"Cold-start persona {pid} has {n_shown} shown rows (expected ≤ 10)."
            )

    return warnings


# ── Summary printing ───────────────────────────────────────────────────────────


def print_summary(
    all_rows: list[dict[str, Any]],
    personas: list[Persona],
    pool_descs: dict[str, str],
) -> None:
    """Print per-persona and aggregate summaries."""
    from collections import Counter

    action_counter: Counter = Counter(row["action_type"] for row in all_rows)

    print(f"\n{'─' * 72}")
    print("ACTION SUMMARY")
    print(f"{'─' * 72}")
    print(f"  Total action rows  : {len(all_rows)}")
    print(f"  Action distribution:")
    for action_type in ["shown", "profile_viewed", "save", "like", "pass", "intro_requested"]:
        count = action_counter.get(action_type, 0)
        pct = count / max(1, len(all_rows)) * 100
        print(f"    {action_type:<20}  {count:>5}  ({pct:5.1f}%)")
    print()

    print(f"  {'Persona ID':<14} {'Name':<42} {'Shown':>6} {'Pos':>5} {'Pass':>5} {'AvgLat':>7}  Pool")
    print("  " + "─" * 96)
    for persona in personas:
        persona_rows = [r for r in all_rows if r["persona_id"] == persona.id]
        shown = sum(1 for r in persona_rows if r["action_type"] == "shown")
        pos = sum(
            1 for r in persona_rows
            if r["action_type"] in ("save", "like", "intro_requested")
        )
        passes = sum(1 for r in persona_rows if r["action_type"] == "pass")
        scores = [r["latent_score"] for r in persona_rows if r["action_type"] == "shown"]
        avg_lat = sum(scores) / max(1, len(scores))
        pool = pool_descs.get(persona.id, "?")
        print(
            f"  {persona.id:<14} {persona.name:<42} {shown:>6} {pos:>5} {passes:>5} "
            f"{avg_lat:>+7.3f}  {pool}"
        )
    print()


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    import random

    print("\n" + "═" * 72)
    print("  SYNTHETIC ACTION SIMULATION — PHASE 12a-ii")
    print("═" * 72)
    print("  ⚠  All personas and actions are SYNTHETIC. Not real user data.")
    print("  ⚠  This is NOT investment advice.")
    print("  ⚠  latent_score in output is for audit only — never use in model.")
    print("═" * 72 + "\n")

    # ── Load inputs ────────────────────────────────────────────────────────────
    for path in (PERSONAS_PATH, PAIRS_PATH, STARTUPS_PATH):
        if not path.exists():
            print(f"ERROR: {path} not found.")
            if path == PERSONAS_PATH:
                print("Run: python3 scripts/ml/personalization/generate_personas.py")
            elif path == PAIRS_PATH:
                print("Run: npm run generate:synthetic-matches")
            sys.exit(1)

    print(f"Loading {PERSONAS_PATH.name} …")
    personas_data = json.loads(PERSONAS_PATH.read_text(encoding="utf-8"))
    personas = [Persona.from_dict(d) for d in personas_data["personas"]]
    print(f"  {len(personas)} personas loaded.\n")

    print(f"Loading {PAIRS_PATH.name} …")
    all_pairs: list[dict[str, Any]] = json.loads(PAIRS_PATH.read_text(encoding="utf-8"))
    eligible_pairs = [p for p in all_pairs if p["eligible_for_model_ranking"]]
    print(f"  {len(all_pairs)} total pairs → {len(eligible_pairs)} eligible.\n")

    print(f"Loading {STARTUPS_PATH.name} …")
    startups_list: list[dict[str, Any]] = json.loads(STARTUPS_PATH.read_text(encoding="utf-8"))
    startups_by_id = {s["id"]: s for s in startups_list}
    print(f"  {len(startups_by_id)} startups loaded.\n")

    # ── Simulate per persona ───────────────────────────────────────────────────
    print(f"{'─' * 72}")
    print("SIMULATING ACTIONS PER PERSONA")
    print(f"{'─' * 72}")

    all_rows: list[dict[str, Any]] = []
    pool_descs: dict[str, str] = {}

    for persona in personas:
        # Deterministic seed derived from persona ID (hash so order-independent).
        seed_bytes = hashlib.sha256(persona.id.encode()).digest()[:4]
        persona_seed = int.from_bytes(seed_bytes, "big")
        rng = random.Random(persona_seed)

        # Build candidate pool (pre-computes _pre_latent_score for stratified sampling).
        candidates, pool_desc = build_candidate_pool(persona, eligible_pairs, startups_by_id)
        pool_descs[persona.id] = pool_desc

        # Sample shown candidates (weighted by pair label).
        sampled = sample_shown_candidates(candidates, persona.n_actions_simulated, rng)
        actual_n = len(sampled)

        print(
            f"  {persona.id}  {persona.name:<42}  "
            f"pool={len(candidates)}  requested={persona.n_actions_simulated}  "
            f"shown={actual_n}"
        )

        # Generate actions.
        rows = generate_actions_for_persona(persona, sampled, startups_by_id, rng)
        all_rows.extend(rows)

    print()

    # ── Validate ───────────────────────────────────────────────────────────────
    print(f"{'─' * 72}")
    print("VALIDATION")
    print(f"{'─' * 72}")
    warnings = validate_output(all_rows, personas)
    if warnings:
        for w in warnings:
            print(f"  ⚠  {w}")
    else:
        print("  ✓  All validation checks passed.")
    print()

    # ── Print summary ──────────────────────────────────────────────────────────
    print_summary(all_rows, personas, pool_descs)

    # ── Write CSV ──────────────────────────────────────────────────────────────
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as fh:
        # Write a prominent notice as the first comment row so any CSV reader
        # opening the file sees the disclaimer immediately.
        fh.write(
            "# SYNTHETIC EXPERIMENTAL DATA ONLY — NOT investment advice — "
            "NOT real user data.\n"
            "# latent_score column is for audit/debug only. "
            "The personalization model must NOT read it.\n"
        )
        writer = csv.DictWriter(fh, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"{'─' * 72}")
    print(f"  ✓  Wrote {len(all_rows)} rows to:")
    print(f"     {OUTPUT_PATH}")
    print(f"{'─' * 72}")
    print(f"\n{'═' * 72}")
    print("  Done.  Simulated actions generated.")
    print("  ⚠  Offline experimental only.  Not for production use.")
    print(f"{'═' * 72}\n")


if __name__ == "__main__":
    main()
