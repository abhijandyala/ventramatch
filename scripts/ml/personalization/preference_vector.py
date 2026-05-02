#!/usr/bin/env python3
"""
scripts/ml/personalization/preference_vector.py

Build persona preference vectors from simulated actions (Phase 12a-iii).

─── NOTICE ──────────────────────────────────────────────────────────────────
  • All personas, actions, and preference vectors are ENTIRELY SYNTHETIC.
  • No real investor, founder, or user is represented.
  • This script is NOT investment advice.
  • It does NOT predict startup success or investment returns.
  • It NEVER reads latent_preferences from synthetic_personas.json.
    Preference vectors are learned entirely from the simulated action stream.
  • `scoreMatch` in lib/matching/score.ts remains the production baseline.
─────────────────────────────────────────────────────────────────────────────

Preference vector structure
────────────────────────────
For each persona:

  Categorical preferences (positive and negative, each dimension 0–1):
    positive_sectors / negative_sectors
    positive_stages  / negative_stages
    positive_customer_types / negative_customer_types
    positive_business_models / negative_business_models
    positive_geographies / negative_geographies

  Semantic centroids (384-dim unit vectors or null):
    positive_semantic_centroid   — L2-normalised weighted mean of saved/liked/intro embeddings.
    negative_semantic_centroid   — L2-normalised weighted mean of passed embeddings.
    Null when fewer than 3 weighted actions contribute to the centroid.

  Behavior confidence (logistic curve in [0, 0.40]):
    behaviour_confidence = 0.40 / (1 + exp(-(n_weighted - 15) / 5))

  Per-dimension confidence (also logistic, same curve applied to per-dim count):
    sector_confidence, stage_confidence, customer_type_confidence,
    business_model_confidence, geography_confidence, semantic_confidence

Action learning weights
────────────────────────
  profile_viewed    +0.2  (positive signal)
  like              +0.5
  save              +0.7
  intro_requested   +1.0
  pass              +1.0  (negative signal)
  shown              0.0  (no signal)

Usage (from repo root):
    python3 scripts/ml/personalization/preference_vector.py

Output:
    data/synthetic-matching/artifacts/persona_preference_vectors.json
"""

from __future__ import annotations

import csv
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional

# ── Module resolution ──────────────────────────────────────────────────────────

_ML_DIR = Path(__file__).resolve().parent.parent      # scripts/ml
_REPO_ROOT = _ML_DIR.parent.parent                    # VentraMatch root
if str(_ML_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_DIR))

from personalization.persona_models import Persona  # noqa: E402

# ── Paths ──────────────────────────────────────────────────────────────────────

ARTIFACTS_DIR   = _REPO_ROOT / "data" / "synthetic-matching" / "artifacts"
DATA_DIR        = _REPO_ROOT / "data" / "synthetic-matching"

PERSONAS_PATH   = ARTIFACTS_DIR / "synthetic_personas.json"
ACTIONS_PATH    = ARTIFACTS_DIR / "simulated_actions.csv"
STARTUPS_PATH   = DATA_DIR / "startups.json"
EMBEDDINGS_PATH = DATA_DIR / "embeddings" / "startups.json"
OUTPUT_PATH     = ARTIFACTS_DIR / "persona_preference_vectors.json"

# ── Constants ──────────────────────────────────────────────────────────────────

# Learning weights per action type.
ACTION_WEIGHTS: dict[str, float] = {
    "shown":            0.0,
    "profile_viewed":   0.2,
    "like":             0.5,
    "save":             0.7,
    "intro_requested":  1.0,
    "pass":             1.0,    # negative weight — see NEGATIVE_ACTIONS
}

POSITIVE_ACTIONS = {"profile_viewed", "like", "save", "intro_requested"}
NEGATIVE_ACTIONS = {"pass"}

# Semantic centroid: minimum weighted-action count before a centroid is built.
CENTROID_MIN_WEIGHT = 3.0

# Expected MiniLM embedding dimension (sanity-checked at load time).
EXPECTED_DIM = 384

# Behavior confidence logistic curve parameters.
CONFIDENCE_MAX      = 0.40
CONFIDENCE_MIDPOINT = 15.0
CONFIDENCE_SLOPE    = 5.0


# ── Behavior confidence ────────────────────────────────────────────────────────


def logistic_confidence(n_weighted: float) -> float:
    """Convert total weighted actions to a behavior confidence in [0, CONFIDENCE_MAX].

    Uses the logistic curve:
        confidence = CONFIDENCE_MAX / (1 + exp(-(n - midpoint) / slope))

    At n=0:  confidence ≈ 0.01  (almost no signal)
    At n=15: confidence ≈ 0.20  (half of max)
    At n=30: confidence ≈ 0.36  (strong signal)
    At n=50: confidence ≈ 0.40  (near-max — cap)
    """
    exponent = -(n_weighted - CONFIDENCE_MIDPOINT) / CONFIDENCE_SLOPE
    return CONFIDENCE_MAX / (1.0 + math.exp(exponent))


# ── Vector normalization ───────────────────────────────────────────────────────


def l2_normalize(vec: list[float]) -> Optional[list[float]]:
    """Return L2-normalised version of vec, or None if the norm is near zero."""
    norm = math.sqrt(sum(x * x for x in vec))
    if norm < 1e-9:
        return None
    inv = 1.0 / norm
    return [x * inv for x in vec]


def check_finite(vec: list[float], label: str) -> bool:
    """Return True if all values are finite; print a warning otherwise."""
    for v in vec:
        if not math.isfinite(v):
            print(f"  ⚠  Non-finite value in {label}: {v}")
            return False
    return True


# ── Categorical preference accumulator ────────────────────────────────────────


class CategoryAccumulator:
    """Accumulate weighted positive and negative signals across a dimension.

    Each call to add() contributes `weight` to all values in the
    `values` list (e.g., all sectors a startup belongs to).

    After all actions are ingested, to_preference_map() returns a dict
    mapping each encountered value to a normalised weight in [0, 1].
    """

    def __init__(self) -> None:
        self._pos: dict[str, float] = defaultdict(float)
        self._neg: dict[str, float] = defaultdict(float)

    def add_positive(self, values: list[str], weight: float) -> None:
        for v in values:
            if v:
                self._pos[v] += weight

    def add_negative(self, values: list[str], weight: float) -> None:
        for v in values:
            if v:
                self._neg[v] += weight

    def _normalise(self, raw: dict[str, float]) -> dict[str, float]:
        """Normalise so the maximum value is 1.0.  Returns empty dict if empty."""
        if not raw:
            return {}
        mx = max(raw.values())
        if mx < 1e-9:
            return {}
        return {k: round(v / mx, 4) for k, v in sorted(raw.items(), key=lambda x: -x[1])}

    def positive_map(self) -> dict[str, float]:
        return self._normalise(self._pos)

    def negative_map(self) -> dict[str, float]:
        return self._normalise(self._neg)

    def total_positive_weight(self) -> float:
        return sum(self._pos.values())

    def total_negative_weight(self) -> float:
        return sum(self._neg.values())


# ── Semantic centroid builder ──────────────────────────────────────────────────


class CentroidBuilder:
    """Accumulate weighted embeddings for one centroid (positive or negative)."""

    def __init__(self, dim: int) -> None:
        self._dim = dim
        self._accumulator: list[float] = [0.0] * dim
        self._total_weight: float = 0.0
        self._count: int = 0

    def add(self, embedding: list[float], weight: float) -> None:
        if len(embedding) != self._dim:
            return   # skip malformed embeddings silently
        for i in range(self._dim):
            self._accumulator[i] += embedding[i] * weight
        self._total_weight += weight
        self._count += 1

    def build(self) -> Optional[list[float]]:
        """Return L2-normalised centroid vector, or None if insufficient weight."""
        if self._total_weight < CENTROID_MIN_WEIGHT:
            return None
        mean_vec = [x / self._total_weight for x in self._accumulator]
        return l2_normalize(mean_vec)

    @property
    def total_weight(self) -> float:
        return self._total_weight

    @property
    def count(self) -> int:
        return self._count


# ── Per-dimension confidence ───────────────────────────────────────────────────


def dim_confidence(total_dim_weight: float) -> float:
    """Logistic confidence for a single dimension."""
    return round(logistic_confidence(total_dim_weight), 4)


# ── Core builder ───────────────────────────────────────────────────────────────


def build_preference_vector(
    persona: Persona,
    actions: list[dict[str, Any]],
    startups_by_id: dict[str, dict[str, Any]],
    embeddings: dict[str, list[float]],
) -> dict[str, Any]:
    """Build a preference vector for one persona from its action stream.

    ⚠️  This function reads ONLY the action stream — it never reads
    persona.latent_preferences.  Phase 12b (personalize.py) must follow the
    same constraint so the simulation is not tautological.

    Args:
        persona:         The Persona object (for id, name, anchor only).
        actions:         Rows from simulated_actions.csv for this persona.
        startups_by_id:  Startup profiles keyed by startup_id.
        embeddings:      MiniLM embeddings keyed by startup_id.

    Returns:
        A serialisable dict suitable for persona_preference_vectors.json.
    """
    # ── Counters for the audit block ──────────────────────────────────────────
    n_shown = n_pos = n_pass = n_intro = n_save = n_like = n_viewed = 0

    # ── Accumulators ──────────────────────────────────────────────────────────
    sectors_acc       = CategoryAccumulator()
    stages_acc        = CategoryAccumulator()
    customer_acc      = CategoryAccumulator()
    biz_model_acc     = CategoryAccumulator()
    geo_acc           = CategoryAccumulator()

    pos_centroid = CentroidBuilder(EXPECTED_DIM)
    neg_centroid = CentroidBuilder(EXPECTED_DIM)

    total_pos_weight: float = 0.0
    total_neg_weight: float = 0.0

    for row in actions:
        action_type = row["action_type"]
        target_id   = row["target_id"]
        startup     = startups_by_id.get(target_id, {})
        embedding   = embeddings.get(target_id)

        # Audit counts
        if action_type == "shown":
            n_shown += 1
            continue    # shown carries no learning signal

        if action_type not in ACTION_WEIGHTS:
            continue   # unknown action type — skip silently

        weight = ACTION_WEIGHTS[action_type]

        # Update per-action audit counts.
        if action_type == "profile_viewed": n_viewed += 1
        elif action_type == "like":         n_like   += 1
        elif action_type == "save":         n_save   += 1
        elif action_type == "intro_requested": n_intro += 1
        elif action_type == "pass":         n_pass   += 1

        # ── Positive signal ───────────────────────────────────────────────────
        if action_type in POSITIVE_ACTIONS:
            n_pos += 1
            total_pos_weight += weight

            sectors_acc.add_positive(startup.get("sectors", []), weight)
            stages_acc.add_positive(
                [startup.get("stage")] if startup.get("stage") else [], weight
            )
            customer_acc.add_positive(
                [startup.get("customer_type")] if startup.get("customer_type") else [], weight
            )
            biz_model_acc.add_positive(
                [startup.get("business_model")] if startup.get("business_model") else [], weight
            )
            # Geography: store the location string as-is for now.
            # Phase 12b will do substring matching against preferred_geographies.
            loc = startup.get("location", "").strip()
            if loc:
                geo_acc.add_positive([loc], weight)

            if embedding:
                pos_centroid.add(embedding, weight)

        # ── Negative signal ───────────────────────────────────────────────────
        elif action_type in NEGATIVE_ACTIONS:
            total_neg_weight += weight

            sectors_acc.add_negative(startup.get("sectors", []), weight)
            stages_acc.add_negative(
                [startup.get("stage")] if startup.get("stage") else [], weight
            )
            customer_acc.add_negative(
                [startup.get("customer_type")] if startup.get("customer_type") else [], weight
            )
            biz_model_acc.add_negative(
                [startup.get("business_model")] if startup.get("business_model") else [], weight
            )
            loc = startup.get("location", "").strip()
            if loc:
                geo_acc.add_negative([loc], weight)

            if embedding:
                neg_centroid.add(embedding, weight)

    # ── Aggregate weighted actions ─────────────────────────────────────────────
    total_weighted = total_pos_weight + total_neg_weight

    # ── Behavior confidence ────────────────────────────────────────────────────
    conf = round(logistic_confidence(total_weighted), 4)

    # ── Per-dimension confidence ───────────────────────────────────────────────
    # Computed on the total weight (positive + negative) that contributed signal
    # to each dimension.  Dimensions with little interaction stay near 0.
    sector_pos_w   = sectors_acc.total_positive_weight()
    sector_neg_w   = sectors_acc.total_negative_weight()
    stage_pos_w    = stages_acc.total_positive_weight()
    stage_neg_w    = stages_acc.total_negative_weight()
    ctype_pos_w    = customer_acc.total_positive_weight()
    ctype_neg_w    = customer_acc.total_negative_weight()
    biz_pos_w      = biz_model_acc.total_positive_weight()
    biz_neg_w      = biz_model_acc.total_negative_weight()
    geo_pos_w      = geo_acc.total_positive_weight()
    geo_neg_w      = geo_acc.total_negative_weight()

    sector_conf    = dim_confidence(sector_pos_w + sector_neg_w)
    stage_conf     = dim_confidence(stage_pos_w + stage_neg_w)
    ctype_conf     = dim_confidence(ctype_pos_w + ctype_neg_w)
    biz_conf       = dim_confidence(biz_pos_w + biz_neg_w)
    geo_conf       = dim_confidence(geo_pos_w + geo_neg_w)
    sem_conf       = dim_confidence(pos_centroid.total_weight + neg_centroid.total_weight)

    # ── Build centroids ────────────────────────────────────────────────────────
    pos_vec = pos_centroid.build()
    neg_vec = neg_centroid.build()

    return {
        # Identity
        "persona_id":           persona.id,
        "persona_name":         persona.name,
        "anchored_investor_id": persona.anchored_investor_id,

        # Categorical preference maps (normalised to [0, 1])
        "positive_sectors":        sectors_acc.positive_map(),
        "negative_sectors":        sectors_acc.negative_map(),
        "positive_stages":         stages_acc.positive_map(),
        "negative_stages":         stages_acc.negative_map(),
        "positive_customer_types": customer_acc.positive_map(),
        "negative_customer_types": customer_acc.negative_map(),
        "positive_business_models": biz_model_acc.positive_map(),
        "negative_business_models": biz_model_acc.negative_map(),
        "positive_geographies":    geo_acc.positive_map(),
        "negative_geographies":    geo_acc.negative_map(),

        # Semantic centroids
        "positive_semantic_centroid":    pos_vec,
        "negative_semantic_centroid":    neg_vec,
        "positive_centroid_available":   pos_vec is not None,
        "negative_centroid_available":   neg_vec is not None,
        "positive_centroid_weight":      round(pos_centroid.total_weight, 4),
        "negative_centroid_weight":      round(neg_centroid.total_weight, 4),
        "positive_centroid_count":       pos_centroid.count,
        "negative_centroid_count":       neg_centroid.count,

        # Confidence
        "behavior_confidence": conf,
        "total_weighted_actions": round(total_weighted, 4),
        "sector_confidence":       sector_conf,
        "stage_confidence":        stage_conf,
        "customer_type_confidence": ctype_conf,
        "business_model_confidence": biz_conf,
        "geography_confidence":    geo_conf,
        "semantic_confidence":     sem_conf,

        # Audit summary
        "action_summary": {
            "shown_count":           n_shown,
            "positive_action_count": n_pos,
            "pass_count":            n_pass,
            "intro_requested_count": n_intro,
            "save_count":            n_save,
            "like_count":            n_like,
            "profile_viewed_count":  n_viewed,
            "total_weighted_actions": round(total_weighted, 4),
            "total_positive_weight": round(total_pos_weight, 4),
            "total_negative_weight": round(total_neg_weight, 4),
        },
    }


# ── Validation ─────────────────────────────────────────────────────────────────


def validate_vectors(
    vectors: list[dict[str, Any]],
    personas: list[Persona],
    emb_dim: int,
) -> list[str]:
    """Return list of validation warning strings.  Empty = all passed."""
    warnings: list[str] = []
    persona_ids = {p.id for p in personas}

    if len(vectors) != 12:
        warnings.append(f"Expected 12 vectors; got {len(vectors)}")

    vec_ids = {v["persona_id"] for v in vectors}
    if vec_ids != persona_ids:
        missing = persona_ids - vec_ids
        extra   = vec_ids - persona_ids
        if missing:
            warnings.append(f"Missing preference vectors for: {sorted(missing)}")
        if extra:
            warnings.append(f"Extra preference vectors for: {sorted(extra)}")

    for v in vectors:
        pid = v["persona_id"]

        # Confidence range
        conf = v["behavior_confidence"]
        if not (0.0 <= conf <= CONFIDENCE_MAX + 1e-6):
            warnings.append(f"{pid}: behavior_confidence {conf} out of [0, {CONFIDENCE_MAX}]")

        # Centroid dimension
        for key in ("positive_semantic_centroid", "negative_semantic_centroid"):
            centroid = v.get(key)
            if centroid is not None:
                if len(centroid) != emb_dim:
                    warnings.append(
                        f"{pid}: {key} has dim {len(centroid)}, expected {emb_dim}"
                    )
                if not check_finite(centroid, f"{pid}.{key}"):
                    warnings.append(f"{pid}: {key} contains non-finite values")

        # No NaN in scalar fields
        for key in ("behavior_confidence", "total_weighted_actions",
                    "sector_confidence", "stage_confidence",
                    "customer_type_confidence", "business_model_confidence",
                    "geography_confidence", "semantic_confidence"):
            val = v.get(key, 0.0)
            if not math.isfinite(float(val)):
                warnings.append(f"{pid}: {key} = {val} (non-finite)")

    # Cold-start persona should have low confidence (< 0.10)
    cold = next((v for v in vectors if v["persona_id"] == "persona_012"), None)
    if cold and cold["behavior_confidence"] >= 0.10:
        warnings.append(
            f"persona_012 (cold-start) has behavior_confidence "
            f"{cold['behavior_confidence']} — expected < 0.10"
        )

    # The persona with the highest actual weighted actions should have the highest
    # confidence (monotonicity check).  Uses actual weighted actions rather than
    # n_actions_simulated, since pool size caps may limit action counts.
    if len(vectors) >= 2:
        sorted_by_w = sorted(vectors, key=lambda v: v["total_weighted_actions"], reverse=True)
        top_persona  = sorted_by_w[0]
        cold_persona = sorted_by_w[-1]
        if top_persona["behavior_confidence"] <= cold_persona["behavior_confidence"]:
            warnings.append(
                f"Confidence monotonicity violated: "
                f"{top_persona['persona_id']} (w={top_persona['total_weighted_actions']}) "
                f"has conf={top_persona['behavior_confidence']} ≤ "
                f"{cold_persona['persona_id']} (w={cold_persona['total_weighted_actions']}) "
                f"conf={cold_persona['behavior_confidence']}"
            )

    return warnings


# ── Summary printing ───────────────────────────────────────────────────────────


def print_summary(vectors: list[dict[str, Any]]) -> None:
    print(f"\n{'─' * 72}")
    print("PREFERENCE VECTOR SUMMARY")
    print(f"{'─' * 72}")
    print(
        f"  {'ID':<14} {'Name':<42} {'Conf':>6} "
        f"{'WtAct':>7} {'+Ctr':>5} {'-Ctr':>5} {'Pass':>5}"
    )
    print("  " + "─" * 84)
    for v in vectors:
        pos_ok = "✓" if v["positive_centroid_available"] else "✗"
        neg_ok = "✓" if v["negative_centroid_available"] else "✗"
        print(
            f"  {v['persona_id']:<14} {v['persona_name']:<42} "
            f"{v['behavior_confidence']:>6.3f} "
            f"{v['total_weighted_actions']:>7.1f} "
            f"{pos_ok:>5} {neg_ok:>5} "
            f"{v['action_summary']['pass_count']:>5}"
        )
    print()

    print("  Top positive sectors by persona:")
    for v in vectors:
        top_pos = list(v["positive_sectors"].items())[:3]
        top_neg = list(v["negative_sectors"].items())[:2]
        if top_pos:
            pos_str = ", ".join(f"{k}({score:.2f})" for k, score in top_pos)
            neg_str = ", ".join(f"{k}({score:.2f})" for k, score in top_neg) or "—"
            print(f"  {v['persona_id']}: +[{pos_str}]  -[{neg_str}]")
    print()


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    print("\n" + "═" * 72)
    print("  PREFERENCE VECTOR GENERATION — PHASE 12a-iii")
    print("═" * 72)
    print("  ⚠  All data is SYNTHETIC. Not real user data.")
    print("  ⚠  This is NOT investment advice.")
    print("  ⚠  Preference vectors are learned from the action stream only.")
    print("     latent_preferences are NEVER read by this script.")
    print("═" * 72 + "\n")

    # ── Load inputs ────────────────────────────────────────────────────────────
    for path in (PERSONAS_PATH, ACTIONS_PATH, STARTUPS_PATH, EMBEDDINGS_PATH):
        if not path.exists():
            print(f"ERROR: {path} not found.")
            if path == PERSONAS_PATH:
                print("Run: python3 scripts/ml/personalization/generate_personas.py")
            elif path == ACTIONS_PATH:
                print("Run: python3 scripts/ml/personalization/simulate_actions.py")
            elif path == EMBEDDINGS_PATH:
                print("Run: npm run embeddings:synthetic-matches")
            sys.exit(1)

    print(f"Loading {PERSONAS_PATH.name} …")
    personas_data = json.loads(PERSONAS_PATH.read_text(encoding="utf-8"))
    personas = [Persona.from_dict(d) for d in personas_data["personas"]]
    print(f"  {len(personas)} personas loaded.\n")

    print(f"Loading {ACTIONS_PATH.name} …")
    all_actions: list[dict[str, Any]] = []
    with ACTIONS_PATH.open(encoding="utf-8") as fh:
        # Skip the two comment lines at the top.
        line1 = fh.readline()
        if not line1.startswith("#"):
            fh.seek(0)   # no comment lines — rewind
        else:
            line2 = fh.readline()
            if not line2.startswith("#"):
                fh.seek(len(line1))   # only one comment line
        reader = csv.DictReader(fh)
        for row in reader:
            all_actions.append(row)
    print(f"  {len(all_actions)} action rows loaded.")
    shown_count = sum(1 for r in all_actions if r["action_type"] == "shown")
    pass_count  = sum(1 for r in all_actions if r["action_type"] == "pass")
    print(f"  {shown_count} shown  |  {pass_count} passes  |  "
          f"{len(all_actions) - shown_count - pass_count} positive signal rows.\n")

    print(f"Loading {STARTUPS_PATH.name} …")
    startups_list = json.loads(STARTUPS_PATH.read_text(encoding="utf-8"))
    startups_by_id = {s["id"]: s for s in startups_list}
    print(f"  {len(startups_by_id)} startups loaded.\n")

    print(f"Loading {EMBEDDINGS_PATH.name} …")
    embeddings: dict[str, list[float]] = json.loads(
        EMBEDDINGS_PATH.read_text(encoding="utf-8")
    )
    emb_dim = len(next(iter(embeddings.values())))
    print(f"  {len(embeddings)} startup embeddings ({emb_dim}-dim).\n")

    if emb_dim != EXPECTED_DIM:
        print(f"  ⚠  Embedding dimension {emb_dim} ≠ expected {EXPECTED_DIM}.")

    # ── Group actions by persona ───────────────────────────────────────────────
    actions_by_persona: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in all_actions:
        actions_by_persona[row["persona_id"]].append(row)

    # ── Build preference vectors ───────────────────────────────────────────────
    print(f"{'─' * 72}")
    print("BUILDING PREFERENCE VECTORS")
    print(f"{'─' * 72}")

    vectors: list[dict[str, Any]] = []
    for persona in personas:
        persona_actions = actions_by_persona.get(persona.id, [])
        vec = build_preference_vector(
            persona, persona_actions, startups_by_id, embeddings
        )
        vectors.append(vec)
        print(
            f"  {persona.id}  conf={vec['behavior_confidence']:.3f}  "
            f"w={vec['total_weighted_actions']:.1f}  "
            f"+ctr={'✓' if vec['positive_centroid_available'] else '✗'}  "
            f"-ctr={'✓' if vec['negative_centroid_available'] else '✗'}  "
            f"pass={vec['action_summary']['pass_count']}"
        )
    print()

    # ── Validate ───────────────────────────────────────────────────────────────
    print(f"{'─' * 72}")
    print("VALIDATION")
    print(f"{'─' * 72}")
    warnings = validate_vectors(vectors, personas, emb_dim)
    if warnings:
        for w in warnings:
            print(f"  ⚠  {w}")
    else:
        print("  ✓  All validation checks passed.")
    print()

    # ── Print summary ──────────────────────────────────────────────────────────
    print_summary(vectors)

    # ── Write output ───────────────────────────────────────────────────────────
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    output = {
        "schema_version": "1.0",
        "notice": (
            "SYNTHETIC EXPERIMENTAL ONLY. All data is fictional. "
            "Not investment advice. Not real user data. "
            "latent_preferences were never read by this script — "
            "vectors are learned from the action stream only. "
            "scoreMatch in lib/matching/score.ts remains the production baseline."
        ),
        "phase": "12a-iii",
        "action_weights": ACTION_WEIGHTS,
        "confidence_curve": {
            "max_confidence": CONFIDENCE_MAX,
            "midpoint": CONFIDENCE_MIDPOINT,
            "slope": CONFIDENCE_SLOPE,
        },
        "centroid_min_weight": CENTROID_MIN_WEIGHT,
        "embedding_dim": emb_dim,
        "n_personas": len(vectors),
        "preference_vectors": vectors,
    }

    OUTPUT_PATH.write_text(
        json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"{'─' * 72}")
    print(f"  ✓  Wrote {len(vectors)} preference vectors to:")
    print(f"     {OUTPUT_PATH}")
    size_kb = OUTPUT_PATH.stat().st_size // 1024
    print(f"     ({size_kb} KB — centroid arrays dominate)")
    print(f"{'─' * 72}")
    print(f"\n{'═' * 72}")
    print("  Done.  Preference vectors generated.")
    print("  ⚠  Offline experimental only.  Not for production use.")
    print(f"{'═' * 72}\n")


if __name__ == "__main__":
    main()
