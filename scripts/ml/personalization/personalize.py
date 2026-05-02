#!/usr/bin/env python3
"""
scripts/ml/personalization/personalize.py

Compute personalization scores and blended rankings per persona (Phase 12b-i).

─── NOTICE ──────────────────────────────────────────────────────────────────
  • All personas, scores, and rankings are ENTIRELY SYNTHETIC.
  • No real investor, founder, or user is represented.
  • This script is NOT investment advice.
  • It does NOT predict startup success or investment returns.
  • Hard eligibility is NON-NEGOTIABLE: ineligible pairs are never scored.
    The script raises an error if any ineligible pair is about to be processed.
  • Personalization cannot override hard eligibility.
  • `scoreMatch` in lib/matching/score.ts remains the production baseline.
─────────────────────────────────────────────────────────────────────────────

Blending formula
────────────────
  global_norm          = expected_label_logreg_c2.0 / 4.0   ∈ [0, 1]
  personalization_score∈ [-0.95, 0.95]  (lead_follow skipped → max 0.95)
  final_score          = global_norm + behavior_confidence × 0.5 × personalization_score

  • global model stays dominant at all confidence levels.
  • cold-start users (conf ≈ 0.03) shift rankings by < 1.5% of the score range.
  • most active users (conf ≈ 0.18) shift rankings by at most ~8.5%.

Dimension weights
─────────────────
  sector        0.25
  stage         0.15
  customer_type 0.15
  business_model0.10
  geography     0.10
  lead_follow   0.05  ← reserved; set to 0 in Phase 12b-i (no per-pair lead data)
  semantic      0.20
  ─────────────
  Total active  0.95  (lead_follow skipped)

Usage (from repo root):
    python3 scripts/ml/personalization/personalize.py

Output:
    data/synthetic-matching/artifacts/personalized_rankings.csv
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

_ML_DIR    = Path(__file__).resolve().parent.parent
_REPO_ROOT = _ML_DIR.parent.parent
if str(_ML_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_DIR))

from personalization.persona_models import Persona  # noqa: E402

# ── Paths ──────────────────────────────────────────────────────────────────────

ARTIFACTS_DIR      = _REPO_ROOT / "data" / "synthetic-matching" / "artifacts"
DATA_DIR           = _REPO_ROOT / "data" / "synthetic-matching"

PREF_VEC_PATH      = ARTIFACTS_DIR / "persona_preference_vectors.json"
ACTIONS_PATH       = ARTIFACTS_DIR / "simulated_actions.csv"
CHAMPION_PATH      = ARTIFACTS_DIR / "champion_candidate.json"
PAIRS_PATH         = DATA_DIR / "pairs.json"
STARTUPS_PATH      = DATA_DIR / "startups.json"
EMBEDDINGS_PATH    = DATA_DIR / "embeddings" / "startups.json"
OUTPUT_PATH        = ARTIFACTS_DIR / "personalized_rankings.csv"

# Preferred global score source — multiseed OOF; fallback to single-seed OOF.
MULTISEED_PATH = ARTIFACTS_DIR / "predictions_eligible_oof_multiseed.csv"
SINGLESEED_PATH = ARTIFACTS_DIR / "predictions_eligible_oof.csv"

# ── Constants ──────────────────────────────────────────────────────────────────

CHAMPION_MODEL       = "logreg_c2.0"
EXPECTED_LABEL_MAX   = 4.0          # label range [0, 4]; used to normalize

MIN_ANCHOR_POOL_SIZE = 5            # mirror of simulate_actions.py

# Dimension weights (must sum to 1.0; lead_follow reserved → 0 this phase)
DIM_WEIGHTS: dict[str, float] = {
    "sector":         0.25,
    "stage":          0.15,
    "customer_type":  0.15,
    "business_model": 0.10,
    "geography":      0.10,
    "lead_follow":    0.05,   # reserved — always 0 in Phase 12b-i
    "semantic":       0.20,
}
assert abs(sum(DIM_WEIGHTS.values()) - 1.0) < 1e-9

# CSV column order for the output file.
OUTPUT_COLUMNS: list[str] = [
    "persona_id", "persona_name", "target_id", "target_kind",
    "anchored_investor_id", "pool_type",
    "eligible_for_model_ranking", "hard_filter_reasons",
    "global_expected_label", "global_norm",
    "behavior_confidence",
    "sector_personalization", "stage_personalization",
    "customer_type_personalization", "business_model_personalization",
    "geography_personalization", "lead_follow_personalization",
    "semantic_personalization",
    "personalization_score",
    "final_score",
    "original_global_rank", "personalized_rank", "rank_delta",
    "pair_label", "pair_label_name",
    "latent_score",    # ← AUDIT ONLY; personalization model must not use this
]


# ── Scoring helpers ────────────────────────────────────────────────────────────


def clamp(value: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def dot(a: list[float], b: list[float]) -> float:
    """Dot product (= cosine similarity when both vectors are L2-normalised)."""
    return sum(ai * bi for ai, bi in zip(a, b))


def sector_score(startup: dict, pref: dict) -> float:
    """Net positive sector signal for this startup under the persona's preferences."""
    sectors = startup.get("sectors", [])
    if not sectors:
        return 0.0
    pos_map: dict = pref.get("positive_sectors", {})
    neg_map: dict = pref.get("negative_sectors", {})
    pos = sum(pos_map.get(s, 0.0) for s in sectors) / len(sectors) if sectors else 0.0
    neg = sum(neg_map.get(s, 0.0) for s in sectors) / len(sectors) if sectors else 0.0
    return clamp(pos - neg)


def stage_score(startup: dict, pref: dict) -> float:
    stage = startup.get("stage", "")
    pos = pref.get("positive_stages", {}).get(stage, 0.0)
    neg = pref.get("negative_stages", {}).get(stage, 0.0)
    return clamp(pos - neg)


def customer_type_score(startup: dict, pref: dict) -> float:
    ct = startup.get("customer_type", "")
    pos = pref.get("positive_customer_types", {}).get(ct, 0.0)
    neg = pref.get("negative_customer_types", {}).get(ct, 0.0)
    return clamp(pos - neg)


def business_model_score(startup: dict, pref: dict) -> float:
    bm = startup.get("business_model", "")
    pos = pref.get("positive_business_models", {}).get(bm, 0.0)
    neg = pref.get("negative_business_models", {}).get(bm, 0.0)
    return clamp(pos - neg)


def geography_score(startup: dict, pref: dict) -> float:
    """Substring-match the startup's location against the persona's learned geographies."""
    location = startup.get("location", "").lower()
    if not location:
        return 0.0

    def _best_match(geo_map: dict) -> float:
        best = 0.0
        for key, weight in geo_map.items():
            kl = key.lower()
            if kl in location or location in kl:
                best = max(best, weight)
        return best

    pos = _best_match(pref.get("positive_geographies", {}))
    neg = _best_match(pref.get("negative_geographies", {}))
    return clamp(pos - neg)


def semantic_score(embedding: Optional[list[float]], pref: dict) -> float:
    """Cosine similarity against positive and negative centroids."""
    if embedding is None:
        return 0.0

    pos_vec: Optional[list] = pref.get("positive_semantic_centroid")
    neg_vec: Optional[list] = pref.get("negative_semantic_centroid")

    if pos_vec and neg_vec:
        return clamp(dot(embedding, pos_vec) - dot(embedding, neg_vec))
    elif pos_vec:
        return clamp(max(0.0, dot(embedding, pos_vec)))
    else:
        return 0.0


def compute_all_dim_scores(
    startup: dict,
    embedding: Optional[list[float]],
    pref: dict,
) -> dict[str, float]:
    """Compute all personalisation dimension scores for one candidate."""
    return {
        "sector":         sector_score(startup, pref),
        "stage":          stage_score(startup, pref),
        "customer_type":  customer_type_score(startup, pref),
        "business_model": business_model_score(startup, pref),
        "geography":      geography_score(startup, pref),
        "lead_follow":    0.0,      # reserved — Phase 12b-i
        "semantic":       semantic_score(embedding, pref),
    }


def aggregate_personalization_score(dim_scores: dict[str, float]) -> float:
    """Weighted sum of dimension scores → total personalisation score."""
    total = sum(DIM_WEIGHTS[k] * dim_scores[k] for k in DIM_WEIGHTS)
    return clamp(total, -1.0, 1.0)


def blend(global_norm: float, pers_score: float, confidence: float) -> float:
    """Conservative blend: global model dominates; personalisation is a small correction."""
    return global_norm + confidence * 0.5 * pers_score


# ── Candidate pool construction ────────────────────────────────────────────────


def build_candidate_pool(
    persona: Persona,
    eligible_pairs: list[dict],
    global_by_pair: dict,   # (startup_id, investor_id) → {mean_expected_label, mean_label, ...}
    global_by_startup: dict,  # startup_id → same aggregated from all investors
) -> tuple[list[dict], str]:
    """Build the ranked candidate list for one persona.

    Returns (candidates, pool_type) where pool_type is one of:
      "anchor"                — anchored persona with sufficient anchor pool.
      "fallback_all_eligible" — anchored persona that fell back (anchor pool too small).
      "virtual"               — no anchor investor specified.

    Each candidate dict contains:
      startup_id, hard_filter_reasons, pair_label, pair_label_name,
      global_expected_label, global_norm, investor_id (or None for virtual)
    """
    anchor_id = persona.anchored_investor_id
    anchor_pairs = (
        [p for p in eligible_pairs if p["investor_id"] == anchor_id]
        if anchor_id else []
    )

    if len(anchor_pairs) >= MIN_ANCHOR_POOL_SIZE:
        pool_type = "anchor"
        use_pairs = anchor_pairs
    else:
        pool_type = "virtual" if not anchor_id else "fallback_all_eligible"
        use_pairs = eligible_pairs

    # De-duplicate by startup_id, keeping the highest-label pair per startup.
    best: dict[str, dict] = {}
    for p in use_pairs:
        sid = p["startup_id"]
        if sid not in best or p["label"] > best[sid]["label"]:
            best[sid] = p

    candidates: list[dict] = []
    for sid, pair in best.items():
        if pool_type == "anchor":
            # Use the specific (startup, anchor) global score.
            key = (sid, anchor_id)
            scores = global_by_pair.get(key, {})
            inv_id = anchor_id
        else:
            # Use the mean global score across all investors.
            scores = global_by_startup.get(sid, {})
            inv_id = None   # no specific investor in fallback/virtual view

        g_expected = scores.get("mean_expected_label", 2.0)
        candidates.append({
            "startup_id":        sid,
            "investor_id":       inv_id,
            "hard_filter_reasons": pair.get("hard_filter_reasons", []),
            "pair_label":        scores.get("mean_label", pair.get("label", 2)),
            "pair_label_name":   pair.get("label_name", ""),
            "global_expected_label": g_expected,
            "global_norm":       g_expected / EXPECTED_LABEL_MAX,
        })

    return candidates, pool_type


# ── Per-persona ranking ────────────────────────────────────────────────────────


def rank_persona(
    persona: Persona,
    pref_vec: dict,
    candidates: list[dict],
    pool_type: str,
    startups_by_id: dict,
    embeddings: dict,
    latent_lookup: dict,   # (persona_id, startup_id) → latent_score (audit only)
) -> list[dict]:
    """Compute global rank, personalised rank, and all scores for one persona."""
    conf = pref_vec["behavior_confidence"]

    # Step 1: compute scores for all candidates.
    scored: list[dict] = []
    for cand in candidates:
        sid       = cand["startup_id"]
        startup   = startups_by_id.get(sid, {})
        embedding = embeddings.get(sid)

        # Safety check: must be eligible.
        hfr = cand["hard_filter_reasons"]
        if hfr:
            raise RuntimeError(
                f"ELIGIBILITY VIOLATION: {persona.id} / {sid} is ineligible "
                f"(hard_filter_reasons={hfr}). Personalization must never rank "
                "ineligible pairs."
            )

        dim_scores = compute_all_dim_scores(startup, embedding, pref_vec)
        pers       = aggregate_personalization_score(dim_scores)
        g_norm     = cand["global_norm"]
        final      = blend(g_norm, pers, conf)

        lat = latent_lookup.get((persona.id, sid))

        scored.append({
            "persona_id":                  persona.id,
            "persona_name":                persona.name,
            "target_id":                   sid,
            "target_kind":                 "startup",
            "anchored_investor_id":        persona.anchored_investor_id,
            "pool_type":                   pool_type,
            "eligible_for_model_ranking":  True,
            "hard_filter_reasons":         json.dumps([]),
            "global_expected_label":       round(cand["global_expected_label"], 4),
            "global_norm":                 round(g_norm, 4),
            "behavior_confidence":         round(conf, 4),
            "sector_personalization":      round(dim_scores["sector"], 4),
            "stage_personalization":       round(dim_scores["stage"], 4),
            "customer_type_personalization": round(dim_scores["customer_type"], 4),
            "business_model_personalization": round(dim_scores["business_model"], 4),
            "geography_personalization":   round(dim_scores["geography"], 4),
            "lead_follow_personalization": round(dim_scores["lead_follow"], 4),
            "semantic_personalization":    round(dim_scores["semantic"], 4),
            "personalization_score":       round(pers, 4),
            "final_score":                 round(final, 4),
            "pair_label":                  round(float(cand["pair_label"]), 2),
            "pair_label_name":             cand["pair_label_name"],
            "latent_score":                round(lat, 4) if lat is not None else "",
            # rank fields filled in below
            "original_global_rank":        0,
            "personalized_rank":           0,
            "rank_delta":                  0,
        })

    # Step 2: assign ranks (1 = best, higher = worse).
    scored.sort(key=lambda r: r["global_norm"], reverse=True)
    for i, row in enumerate(scored, start=1):
        row["original_global_rank"] = i

    scored.sort(key=lambda r: r["final_score"], reverse=True)
    for i, row in enumerate(scored, start=1):
        row["personalized_rank"] = i
        row["rank_delta"] = row["original_global_rank"] - row["personalized_rank"]

    return scored


# ── Validation ─────────────────────────────────────────────────────────────────


def validate_rankings(rows: list[dict], personas: list[Persona]) -> list[str]:
    """Return validation warning strings (empty = all passed)."""
    warnings: list[str] = []

    # No ineligible pair (already enforced in rank_persona; this is a belt-and-suspenders check).
    ineligible = [r for r in rows if not r["eligible_for_model_ranking"]]
    if ineligible:
        warnings.append(f"CRITICAL: {len(ineligible)} ineligible pairs in output.")

    # Every persona has at least one row.
    persona_ids = {p.id for p in personas}
    in_output   = {r["persona_id"] for r in rows}
    missing     = persona_ids - in_output
    if missing:
        warnings.append(f"Missing ranking rows for personas: {sorted(missing)}")

    # Finite scores; confidence in [0, 0.40].
    for r in rows:
        pid = r["persona_id"]
        for col in ("final_score", "global_norm", "personalization_score"):
            val = r.get(col, 0)
            if not math.isfinite(float(val)):
                warnings.append(f"{pid}/{r['target_id']}: {col} = {val} (non-finite)")
        conf = float(r.get("behavior_confidence", 0))
        if not (0.0 <= conf <= 0.40 + 1e-6):
            warnings.append(f"{pid}: behavior_confidence {conf} out of [0, 0.40]")
        pers = float(r.get("personalization_score", 0))
        if not (-1.0 - 1e-6 <= pers <= 1.0 + 1e-6):
            warnings.append(f"{pid}/{r['target_id']}: personalization_score {pers} out of [-1, 1]")

    # Cold-start persona should have very small absolute rank delta.
    cold = [r for r in rows if r["persona_id"] == "persona_012"]
    if cold:
        max_delta = max(abs(r["rank_delta"]) for r in cold)
        if max_delta > 3:
            warnings.append(
                f"persona_012 (cold-start) has max |rank_delta| = {max_delta} (expected ≤ 3)"
            )

    return warnings


# ── Summary printing ───────────────────────────────────────────────────────────


def print_summary(rows: list[dict]) -> None:
    from collections import defaultdict

    by_persona: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_persona[r["persona_id"]].append(r)

    print(f"\n{'─' * 72}")
    print("PERSONALIZED RANKING SUMMARY")
    print(f"{'─' * 72}")
    print(
        f"  {'Persona':<14} {'Pool':>8} {'n':>4} {'Conf':>6} "
        f"{'MeanΔ':>7} {'MaxΔ':>6} {'MaxUp':>7} {'MaxDn':>7}"
    )
    print("  " + "─" * 68)

    for pid in sorted(by_persona.keys()):
        p_rows = by_persona[pid]
        deltas = [r["rank_delta"] for r in p_rows]
        mean_abs = sum(abs(d) for d in deltas) / max(1, len(deltas))
        max_abs  = max(abs(d) for d in deltas)
        max_up   = max(deltas)
        max_dn   = min(deltas)
        pool = p_rows[0]["pool_type"][:8] if p_rows else "?"
        conf = p_rows[0]["behavior_confidence"] if p_rows else 0
        print(
            f"  {pid:<14} {pool:>8} {len(p_rows):>4} {conf:>6.3f} "
            f"{mean_abs:>7.2f} {max_abs:>6} {max_up:>+7} {max_dn:>+7}"
        )
    print()

    # Show top 3 movers per persona.
    for pid in sorted(by_persona.keys()):
        p_rows = by_persona[pid]
        moved = sorted(p_rows, key=lambda r: r["rank_delta"], reverse=True)
        moved_up = [r for r in moved if r["rank_delta"] > 0][:3]
        moved_dn = sorted(p_rows, key=lambda r: r["rank_delta"])[:3]
        moved_dn = [r for r in moved_dn if r["rank_delta"] < 0][:3]
        parts = []
        for r in moved_up:
            parts.append(
                f"↑ {r['target_id']} ({r['original_global_rank']}→{r['personalized_rank']}, "
                f"Δ={r['rank_delta']:+d})"
            )
        for r in moved_dn:
            parts.append(
                f"↓ {r['target_id']} ({r['original_global_rank']}→{r['personalized_rank']}, "
                f"Δ={r['rank_delta']:+d})"
            )
        if parts:
            print(f"  {pid}: {' | '.join(parts)}")
    print()


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    print("\n" + "═" * 72)
    print("  PERSONALIZED RANKING COMPUTATION — PHASE 12b-i")
    print("═" * 72)
    print("  ⚠  All data is SYNTHETIC. Not real user data.")
    print("  ⚠  This is NOT investment advice.")
    print("  ⚠  Hard eligibility is NON-NEGOTIABLE — the script aborts on violation.")
    print("═" * 72 + "\n")

    # ── Verify champion model ──────────────────────────────────────────────────
    if not CHAMPION_PATH.exists():
        print(f"ERROR: {CHAMPION_PATH} not found.")
        print("Run: npm run eval-calibration:synthetic-matches")
        sys.exit(1)

    champion = json.loads(CHAMPION_PATH.read_text(encoding="utf-8"))
    champ_c    = champion.get("candidate_c_value", "unknown")
    champ_score = champion.get("candidate_ranking_score", "unknown")
    print(f"Champion model: LogReg C={champ_c}  score={champ_score}")
    print(f"  Phase 12b-i uses: {CHAMPION_MODEL}  expected_label\n")

    # ── Load inputs ────────────────────────────────────────────────────────────
    for path in (PREF_VEC_PATH, PAIRS_PATH, STARTUPS_PATH, EMBEDDINGS_PATH):
        if not path.exists():
            print(f"ERROR: {path} not found.")
            sys.exit(1)

    print(f"Loading {PREF_VEC_PATH.name} …")
    pv_data     = json.loads(PREF_VEC_PATH.read_text(encoding="utf-8"))
    pref_vecs   = {v["persona_id"]: v for v in pv_data["preference_vectors"]}
    personas    = [Persona.from_dict({"id": v["persona_id"], "name": v["persona_name"],
                                      "side": "investor",
                                      "anchored_investor_id": v["anchored_investor_id"],
                                      "latent_preferences": {"noise_level": 0.0},
                                      "n_actions_simulated": 1})
                   for v in pv_data["preference_vectors"]]
    print(f"  {len(pref_vecs)} preference vectors loaded.\n")

    print(f"Loading {PAIRS_PATH.name} …")
    all_pairs    = json.loads(PAIRS_PATH.read_text(encoding="utf-8"))
    eligible_pairs = [p for p in all_pairs if p["eligible_for_model_ranking"]]
    print(f"  {len(eligible_pairs)} eligible pairs.\n")

    print(f"Loading {STARTUPS_PATH.name} …")
    startups_list  = json.loads(STARTUPS_PATH.read_text(encoding="utf-8"))
    startups_by_id = {s["id"]: s for s in startups_list}
    print(f"  {len(startups_by_id)} startups.\n")

    print(f"Loading {EMBEDDINGS_PATH.name} …")
    embeddings = json.loads(EMBEDDINGS_PATH.read_text(encoding="utf-8"))
    print(f"  {len(embeddings)} startup embeddings ({len(next(iter(embeddings.values())))}-dim).\n")

    # ── Load latent score lookup (audit only) ──────────────────────────────────
    latent_lookup: dict[tuple, float] = {}
    if ACTIONS_PATH.exists():
        with ACTIONS_PATH.open(encoding="utf-8") as fh:
            # skip comment lines
            line = fh.readline()
            if not line.startswith("#"):
                fh.seek(0)
            else:
                line2 = fh.readline()
                if not line2.startswith("#"):
                    fh.seek(len(line))
            for row in csv.DictReader(fh):
                if row["action_type"] == "shown":
                    try:
                        latent_lookup[(row["persona_id"], row["target_id"])] = float(row["latent_score"])
                    except (ValueError, KeyError):
                        pass
        print(f"Loaded {len(latent_lookup)} latent_score audit entries from simulated_actions.csv.\n")

    # ── Load and aggregate global scores ──────────────────────────────────────
    src_path = MULTISEED_PATH if MULTISEED_PATH.exists() else (
        SINGLESEED_PATH if SINGLESEED_PATH.exists() else None
    )
    if src_path is None:
        print("ERROR: No OOF predictions file found.")
        print(f"Expected: {MULTISEED_PATH} or {SINGLESEED_PATH}")
        sys.exit(1)

    print(f"Loading global scores from {src_path.name} …")
    import csv as csvmod

    pair_acc: dict[tuple, list[float]]  = defaultdict(list)
    pair_lbl: dict[tuple, list[float]]  = defaultdict(list)

    with src_path.open(encoding="utf-8") as fh:
        reader = csvmod.DictReader(fh)
        for row in reader:
            model_col = row.get("model_name", "")
            if src_path == MULTISEED_PATH and model_col != CHAMPION_MODEL:
                continue   # filter to champion model in multiseed file
            # single-seed OOF doesn't have model_name; use all rows
            try:
                e_label = float(row["expected_label_logreg" if src_path == SINGLESEED_PATH
                                    else "expected_label"])
                startup  = row["startup_id"]
                investor = row["investor_id"]
                label    = float(row.get("true_label", row.get("pair_label", 2)))
                pair_acc[(startup, investor)].append(e_label)
                pair_lbl[(startup, investor)].append(label)
            except (KeyError, ValueError):
                continue

    # Build (startup_id, investor_id) → {mean_expected_label, mean_label}
    global_by_pair: dict[tuple, dict] = {}
    for (sid, iid), vals in pair_acc.items():
        global_by_pair[(sid, iid)] = {
            "mean_expected_label": sum(vals) / len(vals),
            "mean_label":          sum(pair_lbl[(sid, iid)]) / len(pair_lbl[(sid, iid)]),
        }

    # Build startup_id → aggregated across all investors (for fallback/virtual)
    startup_acc: dict[str, list[float]] = defaultdict(list)
    startup_lbl: dict[str, list[float]] = defaultdict(list)
    for (sid, iid), agg in global_by_pair.items():
        startup_acc[sid].append(agg["mean_expected_label"])
        startup_lbl[sid].append(agg["mean_label"])

    global_by_startup: dict[str, dict] = {
        sid: {
            "mean_expected_label": sum(vals) / len(vals),
            "mean_label":          sum(startup_lbl[sid]) / len(startup_lbl[sid]),
        }
        for sid, vals in startup_acc.items()
    }

    print(f"  Global scores: {len(global_by_pair)} (startup, investor) pairs; "
          f"{len(global_by_startup)} unique startups.\n")

    # ── Compute rankings per persona ──────────────────────────────────────────
    print(f"{'─' * 72}")
    print("COMPUTING PERSONALIZED RANKINGS")
    print(f"{'─' * 72}")

    all_rows: list[dict] = []
    for persona in personas:
        pref = pref_vecs.get(persona.id)
        if pref is None:
            print(f"  ⚠  {persona.id}: no preference vector — skipping.")
            continue

        candidates, pool_type = build_candidate_pool(
            persona, eligible_pairs, global_by_pair, global_by_startup
        )
        rows = rank_persona(
            persona, pref, candidates, pool_type,
            startups_by_id, embeddings, latent_lookup,
        )
        all_rows.extend(rows)

        max_d = max(abs(r["rank_delta"]) for r in rows) if rows else 0
        print(
            f"  {persona.id}  pool={pool_type[:8]}  n={len(rows):>3}  "
            f"conf={pref['behavior_confidence']:.3f}  max|Δ|={max_d}"
        )

    print()

    # ── Validate ───────────────────────────────────────────────────────────────
    print(f"{'─' * 72}")
    print("VALIDATION")
    print(f"{'─' * 72}")
    warnings = validate_rankings(all_rows, personas)
    if warnings:
        for w in warnings:
            print(f"  ⚠  {w}")
    else:
        print("  ✓  All validation checks passed.")
    print()

    # ── Print summary ──────────────────────────────────────────────────────────
    print_summary(all_rows)

    # ── Write output ───────────────────────────────────────────────────────────
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as fh:
        fh.write(
            "# SYNTHETIC EXPERIMENTAL DATA — NOT investment advice — NOT real user data.\n"
            "# latent_score column is for audit only. "
            "Personalization model must NOT read it.\n"
        )
        writer = csv.DictWriter(fh, fieldnames=OUTPUT_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)

    elig_violations = sum(1 for r in all_rows if not r["eligible_for_model_ranking"])
    print(f"{'─' * 72}")
    print(f"  ✓  Wrote {len(all_rows)} rows to:")
    print(f"     {OUTPUT_PATH}")
    print(f"  Eligibility violations: {elig_violations}  (must be 0)")
    print(f"{'─' * 72}")
    print(f"\n{'═' * 72}")
    print("  Done.  Personalized rankings computed.")
    print("  ⚠  Offline experimental only.  Not for production use.")
    print(f"{'═' * 72}\n")


if __name__ == "__main__":
    main()
