#!/usr/bin/env python3
"""
scripts/ml/compute_embeddings.py

Compute local text embeddings for synthetic startup and investor profiles.

─── NOTICE ──────────────────────────────────────────────────────────────────
  • All input data is SYNTHETIC. No real user data is processed.
  • This script is NOT investment advice.
  • These embeddings represent text similarity for profile-fit matching only.
  • They do NOT predict startup success or investment returns.
  • All output is offline and experimental. Do not deploy to production.
─────────────────────────────────────────────────────────────────────────────

Model: sentence-transformers/all-MiniLM-L6-v2
  - 384-dim sentence embeddings
  - ~80 MB download on first run (cached in ~/.cache/huggingface/)
  - Vectors are L2-normalized so dot product == cosine similarity
  - Fully offline after download; no API key required

Startup text composition:
  one_liner + " " + problem + " " + solution + " Team: " + founder_background

Investor text composition:
  investment_thesis

Output:
  data/synthetic-matching/embeddings/startups.json
  data/synthetic-matching/embeddings/investors.json
  data/synthetic-matching/embeddings/_metadata.json

Usage (from repo root):
    python3 scripts/ml/compute_embeddings.py
    npm run embeddings:synthetic-matches

Requires Python 3.9+  (uses `from __future__ import annotations`)
"""

from __future__ import annotations

import json
import math
import sys
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
    import torch
    _TORCH_VERSION = torch.__version__
except ImportError:
    _MISSING.append("torch")
    _TORCH_VERSION = "unavailable"

try:
    from sentence_transformers import SentenceTransformer
    import sentence_transformers as _st
    _ST_VERSION = _st.__version__
except ImportError:
    _MISSING.append("sentence-transformers")
    SentenceTransformer = None  # type: ignore[assignment, misc]
    _ST_VERSION = "unavailable"

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
STARTUPS_PATH = REPO_ROOT / "data" / "synthetic-matching" / "startups.json"
INVESTORS_PATH = REPO_ROOT / "data" / "synthetic-matching" / "investors.json"
EMBEDDINGS_DIR = REPO_ROOT / "data" / "synthetic-matching" / "embeddings"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EXPECTED_DIM = 384

# Text field compositions — documented in _metadata.json for reproducibility.
STARTUP_FIELDS_USED = "one_liner + ' ' + problem + ' ' + solution + ' Team: ' + founder_background"
INVESTOR_FIELDS_USED = "investment_thesis"

# Norm tolerance: unit vectors should have norm within ε of 1.0.
NORM_TOLERANCE = 1e-4

# ── Text composition ──────────────────────────────────────────────────────────


def build_startup_text(startup: dict[str, Any]) -> str:
    """
    Concatenate the startup's key descriptive text fields into a single string
    for embedding. Order: pitch first (one_liner, problem, solution), then team
    context (founder_background).

    This text is NOT used for any investment recommendation. It is used only for
    computing text similarity between synthetic profiles.
    """
    parts = [
        startup.get("one_liner", "").strip(),
        startup.get("problem", "").strip(),
        startup.get("solution", "").strip(),
    ]
    fb = startup.get("founder_background", "").strip()
    if fb:
        parts.append("Team: " + fb)
    return " ".join(p for p in parts if p)


def build_investor_text(investor: dict[str, Any]) -> str:
    """
    Use the investor's investment thesis as the embedding text.
    The thesis field is already a substantive description of the investor's focus.
    """
    return investor.get("investment_thesis", "").strip()


# ── Validation ────────────────────────────────────────────────────────────────


def validate_embeddings(
    id_to_vec: dict[str, list[float]],
    expected_n: int,
    label: str,
) -> None:
    """Validate that all profiles have embeddings with the correct dimension and norm."""
    errors: list[str] = []

    if len(id_to_vec) != expected_n:
        errors.append(
            f"{label}: expected {expected_n} embeddings, got {len(id_to_vec)}"
        )

    for profile_id, vec in id_to_vec.items():
        if len(vec) != EXPECTED_DIM:
            errors.append(
                f"{label} {profile_id}: dim {len(vec)} ≠ expected {EXPECTED_DIM}"
            )
        norm = math.sqrt(sum(v * v for v in vec))
        if abs(norm - 1.0) > NORM_TOLERANCE:
            errors.append(
                f"{label} {profile_id}: norm {norm:.6f} deviates from 1.0 by > {NORM_TOLERANCE}"
            )

    if errors:
        print("VALIDATION FAILED:")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)

    print(
        f"  ✓ {label}: {len(id_to_vec)} embeddings, dim={EXPECTED_DIM}, all norms ≈ 1.0"
    )


# ── Main ──────────────────────────────────────────────────────────────────────


def main() -> None:
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)

    print("\n" + "═" * 72)
    print("  SYNTHETIC EMBEDDING COMPUTATION — EXPERIMENTAL PIPELINE")
    print("═" * 72)
    print("  ⚠  All profiles are SYNTHETIC. Not real user data.")
    print("  ⚠  Embeddings are for profile-fit matching only. Not investment advice.")
    print("═" * 72 + "\n")

    # ── Load profiles ─────────────────────────────────────────────────────────
    if not STARTUPS_PATH.exists():
        print(f"ERROR: {STARTUPS_PATH} not found.")
        sys.exit(1)
    if not INVESTORS_PATH.exists():
        print(f"ERROR: {INVESTORS_PATH} not found.")
        sys.exit(1)

    startups: list[dict[str, Any]] = json.loads(STARTUPS_PATH.read_text(encoding="utf-8"))
    investors: list[dict[str, Any]] = json.loads(INVESTORS_PATH.read_text(encoding="utf-8"))
    print(f"Loaded {len(startups)} startups, {len(investors)} investors.\n")

    # ── Build texts ───────────────────────────────────────────────────────────
    startup_ids = [s["id"] for s in startups]
    investor_ids = [i["id"] for i in investors]

    startup_texts = [build_startup_text(s) for s in startups]
    investor_texts = [build_investor_text(i) for i in investors]

    # Log sample text lengths as a sanity check
    avg_s = sum(len(t) for t in startup_texts) / len(startup_texts)
    avg_i = sum(len(t) for t in investor_texts) / len(investor_texts)
    print(f"Startup text avg length:  {avg_s:.0f} chars")
    print(f"Investor text avg length: {avg_i:.0f} chars\n")

    # ── Load model ────────────────────────────────────────────────────────────
    print(f"Loading model: {MODEL_NAME}")
    print("  (First run downloads ~80 MB to ~/.cache/huggingface/ — subsequent runs use cache.)\n")

    model = SentenceTransformer(MODEL_NAME)

    # ── Encode ────────────────────────────────────────────────────────────────
    print("Encoding startup texts…")
    startup_vecs = model.encode(
        startup_texts,
        normalize_embeddings=True,
        show_progress_bar=True,
        batch_size=32,
    )  # shape: (35, 384)

    print("\nEncoding investor texts…")
    investor_vecs = model.encode(
        investor_texts,
        normalize_embeddings=True,
        show_progress_bar=True,
        batch_size=32,
    )  # shape: (17, 384)

    # ── Build dicts ───────────────────────────────────────────────────────────
    startup_map: dict[str, list[float]] = {
        sid: vecs.tolist()
        for sid, vecs in zip(startup_ids, startup_vecs)
    }
    investor_map: dict[str, list[float]] = {
        iid: vecs.tolist()
        for iid, vecs in zip(investor_ids, investor_vecs)
    }

    # ── Validate ──────────────────────────────────────────────────────────────
    print("\nValidating embeddings…")
    validate_embeddings(startup_map, len(startups), "startups")
    validate_embeddings(investor_map, len(investors), "investors")

    # ── Sample cosine similarity check ───────────────────────────────────────
    # Spot-check a few known-similar pairs to confirm embeddings are sensible.
    # (Purely for developer sanity — not a label or score assertion.)
    print("\nSpot-check cosine similarities (dot product of unit vectors):")
    spot_checks = [
        ("startup_004", "investor_008", "Redline AI + Sentinel Cyber (expect high ~0.5–0.7)"),
        ("startup_035", "investor_008", "MindfulBrew + Sentinel Cyber (expect low ~0.1–0.3)"),
        ("startup_016", "investor_004", "CarbonPulse + Verdant Climate (expect high ~0.4–0.7)"),
    ]
    for sid, iid, note in spot_checks:
        if sid in startup_map and iid in investor_map:
            sv = np.array(startup_map[sid])
            iv = np.array(investor_map[iid])
            sim = float(np.dot(sv, iv))
            print(f"  {note}")
            print(f"    cos_sim = {sim:.4f}")

    # ── Write files ───────────────────────────────────────────────────────────
    out_startups = EMBEDDINGS_DIR / "startups.json"
    out_investors = EMBEDDINGS_DIR / "investors.json"
    out_meta = EMBEDDINGS_DIR / "_metadata.json"

    out_startups.write_text(
        json.dumps(startup_map, separators=(",", ":"), indent=None),
        encoding="utf-8",
    )
    out_investors.write_text(
        json.dumps(investor_map, separators=(",", ":"), indent=None),
        encoding="utf-8",
    )

    metadata: dict[str, Any] = {
        "model_name": MODEL_NAME,
        "dim": EXPECTED_DIM,
        "normalized": True,
        "n_startups": len(startups),
        "n_investors": len(investors),
        "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sentence_transformers_version": _ST_VERSION,
        "torch_version": _TORCH_VERSION,
        "fields_used": {
            "startup": STARTUP_FIELDS_USED,
            "investor": INVESTOR_FIELDS_USED,
        },
        "notice": (
            "SYNTHETIC EXPERIMENTAL DATA ONLY. "
            "Embeddings encode synthetic profile text for profile-fit matching. "
            "They are NOT investment advice and do NOT predict startup success. "
            "Do not use in production without real post-launch data validation."
        ),
    }
    out_meta.write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )

    print(f"\n  ✓ Wrote {out_startups}")
    print(f"  ✓ Wrote {out_investors}")
    print(f"  ✓ Wrote {out_meta}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'═' * 72}")
    print("  Done. Regenerate whenever startups.json or investors.json changes.")
    print("  Next: npm run generate:synthetic-matches")
    print("  ⚠  Synthetic experimental only. Not for production use.")
    print("═" * 72 + "\n")


if __name__ == "__main__":
    main()
