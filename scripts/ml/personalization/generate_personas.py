#!/usr/bin/env python3
"""
scripts/ml/personalization/generate_personas.py

Generate 12 synthetic investor-side personas for the Phase 12 personalization
simulator.

─── NOTICE ──────────────────────────────────────────────────────────────────
  • All personas are ENTIRELY SYNTHETIC CONSTRUCTS.
  • No real investor, founder, or user is represented.
  • This script is NOT investment advice.
  • It does NOT predict startup success or investment returns.
  • Latent preferences are used ONLY to drive synthetic action simulation.
    They are never available to the personalization model.
  • `scoreMatch` in lib/matching/score.ts remains the production baseline.
─────────────────────────────────────────────────────────────────────────────

Persona taxonomy (12 investor-side personas)
────────────────────────────────────────────
  #   Archetype                              Anchor investor
  01  AI/ML + DevTools specialist            investor_001 (Threshold Ventures)
  02  Healthcare / clinical-workflow SaaS    investor_003 (Meridian Health Partners)
  03  Fintech specialist                     investor_002 (Firefly Capital)
  04  Climate + industrial deeptech          investor_004 (Verdant Climate Partners)
  05  Cybersecurity + AppSec specialist      investor_008 (Sentinel Security Partners)
  06  Consumer + marketplace specialist      investor_005 (Prism Consumer)
  07  Web3 / crypto thesis                   investor_015 (Latitude Capital)
  08  Later-stage growth investor            investor_016 (Evergreen Growth Partners)
  09  Geography-focused (Asia/Pacific)       investor_011 (Tokyo Bridge Capital)
  10  Enterprise SaaS + data infra           investor_006 (Ironwood Enterprise Capital)
  11  Noisy/conflicting (high noise)         investor_009 (Independent Angel)  ← high noise
  12  Low-action cold-start investor         None (virtual, no anchor)          ← few actions

Usage (from repo root):
    python3 scripts/ml/personalization/generate_personas.py

Output:
    data/synthetic-matching/artifacts/synthetic_personas.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow running from repo root or from within scripts/ml/personalization/.
_ML_DIR = Path(__file__).resolve().parent.parent   # scripts/ml
_REPO_ROOT = _ML_DIR.parent.parent                  # VentraMatch root
if str(_ML_DIR) not in sys.path:
    sys.path.insert(0, str(_ML_DIR))

from personalization.persona_models import LatentPreferences, Persona  # noqa: E402

# ── Output path ────────────────────────────────────────────────────────────────

ARTIFACTS_DIR = _REPO_ROOT / "data" / "synthetic-matching" / "artifacts"
OUTPUT_PATH = ARTIFACTS_DIR / "synthetic_personas.json"


# ── Persona definitions ────────────────────────────────────────────────────────


def _build_personas() -> list[Persona]:
    """Return the canonical list of 12 synthetic investor-side personas.

    Design principles:
      - Each persona anchors to a specific investor from investors.json where
        semantically appropriate.
      - Latent preferences are consistent with the anchor investor's mandate
        but are not mechanically derived from it — they represent the
        simulated user's *expressed* behavior, which may differ from the
        written mandate.
      - Noise levels are set deliberately:
          • Normal personas: 0.10 – 0.18
          • Conflicting/noisy personas: 0.28 – 0.32
          • Cold-start persona: 0.15 (noise level is irrelevant at 5 actions)
      - n_actions_simulated values span the full confidence-curve range:
          • Cold-start: 5
          • Normal: 25 – 35
          • High-activity: 45 – 60
    """
    return [
        # ── 01: AI/ML + DevTools specialist ─────────────────────────────────
        Persona(
            id="persona_001",
            name="AI/ML Pre-Seed Specialist",
            side="investor",
            anchored_investor_id="investor_001",  # Threshold Ventures
            latent_preferences=LatentPreferences(
                preferred_sectors=["AI / ML", "DevTools", "Data infra"],
                avoided_sectors=["Consumer", "Media", "Gaming", "Web3 / Crypto"],
                preferred_stages=["idea", "pre_seed"],
                preferred_customer_types=["developer", "enterprise"],
                preferred_business_models=["subscription", "developer_tools", "api"],
                preferred_geographies=["San Francisco", "New York", "United States"],
                lead_or_follow="follow",
                preferred_traction_min="waitlist",
                noise_level=0.12,
            ),
            n_actions_simulated=35,
            notes=(
                "Mirrors a stage-focused early-tech specialist anchored to Threshold Ventures. "
                "Strongly prefers developer-facing AI and infrastructure. "
                "Low noise: very consistent behavior that the personalization layer should "
                "recover reliably. Useful as a positive-control persona."
            ),
        ),

        # ── 02: Healthcare / clinical-workflow SaaS ──────────────────────────
        Persona(
            id="persona_002",
            name="Healthcare SaaS Investor",
            side="investor",
            anchored_investor_id="investor_003",  # Meridian Health Partners
            latent_preferences=LatentPreferences(
                preferred_sectors=["Healthtech", "Biotech", "SaaS"],
                avoided_sectors=["Web3 / Crypto", "Gaming", "Defense", "Consumer"],
                preferred_stages=["seed", "series_a"],
                preferred_customer_types=["enterprise", "government"],
                preferred_business_models=["subscription", "enterprise_license", "saas"],
                preferred_geographies=["United States", "Boston", "San Francisco"],
                lead_or_follow="lead",
                preferred_traction_min="design_partners",
                noise_level=0.10,
            ),
            n_actions_simulated=30,
            notes=(
                "Healthcare SaaS buyer, anchored to Meridian Health Partners. "
                "Demands clinical or enterprise traction signals before engaging. "
                "Very low noise — clean domain focus makes this a low-variance persona "
                "that tests whether the semantic centroid picks up clinical vocabulary."
            ),
        ),

        # ── 03: Fintech specialist ────────────────────────────────────────────
        Persona(
            id="persona_003",
            name="Fintech Seed Investor",
            side="investor",
            anchored_investor_id="investor_002",  # Firefly Capital
            latent_preferences=LatentPreferences(
                preferred_sectors=["Fintech", "SaaS", "Marketplace"],
                avoided_sectors=["Biotech", "Defense", "Hardware", "Robotics"],
                preferred_stages=["pre_seed", "seed"],
                preferred_customer_types=["consumer", "smb", "enterprise"],
                preferred_business_models=["subscription", "marketplace", "transaction_fee"],
                preferred_geographies=["New York", "United States", "Latin America"],
                lead_or_follow="lead",
                preferred_traction_min="pilots",
                noise_level=0.14,
            ),
            n_actions_simulated=28,
            notes=(
                "Fintech generalist (B2C and B2B), anchored to Firefly Capital. "
                "Broad customer-type preference reflects the fintech spectrum. "
                "Moderate noise simulates occasional opportunistic investments "
                "outside the core mandate."
            ),
        ),

        # ── 04: Climate + industrial deeptech ────────────────────────────────
        Persona(
            id="persona_004",
            name="Climate/Industrial Deeptech Investor",
            side="investor",
            anchored_investor_id="investor_004",  # Verdant Climate Partners
            latent_preferences=LatentPreferences(
                preferred_sectors=["Climate / Cleantech", "Industrial", "Hardware", "Robotics"],
                avoided_sectors=["Consumer", "Media", "EdTech", "Web3 / Crypto"],
                preferred_stages=["idea", "pre_seed", "seed"],
                preferred_customer_types=["enterprise", "government"],
                preferred_business_models=["hardware_saas", "enterprise_license", "project_based"],
                preferred_geographies=["United States", "Europe"],
                lead_or_follow="lead",
                preferred_traction_min="pilots",
                noise_level=0.15,
            ),
            n_actions_simulated=25,
            notes=(
                "Climate + hard-tech thesis, anchored to Verdant Climate Partners. "
                "Prefers hardware-enabled businesses with clear enterprise or government "
                "off-take. Lower n_actions reflects the niche domain — fewer relevant "
                "startups in the pool. Tests whether the semantic centroid picks up "
                "industrial/environmental vocabulary."
            ),
        ),

        # ── 05: Cybersecurity + AppSec specialist ─────────────────────────────
        Persona(
            id="persona_005",
            name="Cybersecurity Specialist",
            side="investor",
            anchored_investor_id="investor_008",  # Sentinel Security Partners
            latent_preferences=LatentPreferences(
                preferred_sectors=["Cybersecurity", "DevTools", "AI / ML"],
                avoided_sectors=["Consumer", "Media", "Gaming", "Climate / Cleantech"],
                preferred_stages=["seed", "series_a"],
                preferred_customer_types=["enterprise", "developer"],
                preferred_business_models=["subscription", "enterprise_license", "api"],
                preferred_geographies=["San Francisco", "Washington DC", "United States"],
                lead_or_follow="lead",
                preferred_traction_min="paying_customers",
                noise_level=0.12,
            ),
            n_actions_simulated=32,
            notes=(
                "AppSec/infra security specialist, anchored to Sentinel Security Partners. "
                "Requires paying customers before engaging — high traction bar. "
                "Tests whether higher traction signal requirements are learned correctly "
                "from action patterns."
            ),
        ),

        # ── 06: Consumer + marketplace specialist ────────────────────────────
        Persona(
            id="persona_006",
            name="Consumer/Marketplace Investor",
            side="investor",
            anchored_investor_id="investor_005",  # Prism Consumer
            latent_preferences=LatentPreferences(
                preferred_sectors=["Consumer", "Marketplace", "EdTech", "Media"],
                avoided_sectors=["Cybersecurity", "Defense", "Biotech", "Hardware", "Robotics"],
                preferred_stages=["seed"],
                preferred_customer_types=["consumer", "marketplace"],
                preferred_business_models=["marketplace", "subscription", "advertising"],
                preferred_geographies=["United States", "San Francisco", "New York"],
                lead_or_follow="follow",
                preferred_traction_min="waitlist",
                noise_level=0.18,
            ),
            n_actions_simulated=30,
            notes=(
                "Consumer-first seed investor, anchored to Prism Consumer. "
                "Slightly higher noise (0.18) reflects consumer investing's opportunistic "
                "nature — viral metrics can override mandate. Prefers earlier traction signals "
                "than enterprise investors. Tests consumer vs enterprise semantic centroid "
                "divergence."
            ),
        ),

        # ── 07: Web3 / crypto thesis ──────────────────────────────────────────
        Persona(
            id="persona_007",
            name="Web3/Crypto Thesis Investor",
            side="investor",
            anchored_investor_id="investor_015",  # Latitude Capital
            latent_preferences=LatentPreferences(
                preferred_sectors=["Web3 / Crypto", "DevTools", "Deep Tech"],
                avoided_sectors=["Healthtech", "Biotech", "Industrial", "Climate / Cleantech"],
                preferred_stages=["idea", "pre_seed", "seed"],
                preferred_customer_types=["developer", "consumer"],
                preferred_business_models=["token_model", "protocol", "developer_tools"],
                preferred_geographies=[],  # geography-agnostic — global web3 focus
                lead_or_follow="lead",
                preferred_traction_min="no_traction",
                noise_level=0.16,
            ),
            n_actions_simulated=25,
            notes=(
                "Web3/crypto mandate investor, anchored to Latitude Capital. "
                "Geography-agnostic (empty preferred_geographies — tests the zero-geo case). "
                "Low traction bar reflects the pre-revenue nature of protocol investments. "
                "Useful for testing eligibility-gate interaction: Web3 startups with "
                "anti-thesis conflicts from other investors are still reachable for this persona."
            ),
        ),

        # ── 08: Later-stage growth investor ──────────────────────────────────
        Persona(
            id="persona_008",
            name="Late-Stage Growth Investor",
            side="investor",
            anchored_investor_id="investor_016",  # Evergreen Growth Partners
            latent_preferences=LatentPreferences(
                preferred_sectors=["SaaS", "AI / ML", "Fintech", "Data infra", "Cybersecurity"],
                avoided_sectors=["Consumer", "Gaming", "Media", "Web3 / Crypto"],
                preferred_stages=["series_b_plus"],
                preferred_customer_types=["enterprise"],
                preferred_business_models=["subscription", "enterprise_license"],
                preferred_geographies=["United States", "Europe"],
                lead_or_follow="follow",
                preferred_traction_min="arr",
                noise_level=0.10,
            ),
            n_actions_simulated=45,
            notes=(
                "Late-stage growth capital, anchored to Evergreen Growth Partners. "
                "Very high traction bar (ARR required) and single-stage focus (Series B+). "
                "Low noise — institutional mandates are typically more rigid. "
                "Tests whether stage filtering is learned correctly: this persona should "
                "consistently pass on early-stage startups even if sectors match. "
                "High n_actions (45) because large institutional investors see more deal flow."
            ),
        ),

        # ── 09: Geography-focused (Asia/Pacific) ──────────────────────────────
        Persona(
            id="persona_009",
            name="Asia-Pacific Geography Specialist",
            side="investor",
            anchored_investor_id="investor_011",  # Tokyo Bridge Capital
            latent_preferences=LatentPreferences(
                preferred_sectors=["AI / ML", "SaaS", "Fintech", "Robotics", "Data infra"],
                avoided_sectors=["Consumer", "Web3 / Crypto", "Gaming"],
                preferred_stages=["seed", "series_a"],
                preferred_customer_types=["enterprise", "smb"],
                preferred_business_models=["subscription", "enterprise_license"],
                preferred_geographies=["Japan", "Korea", "Asia", "Singapore", "Southeast Asia"],
                lead_or_follow="follow",
                preferred_traction_min="pilots",
                noise_level=0.15,
            ),
            n_actions_simulated=28,
            notes=(
                "Asia-Pacific geography specialist, anchored to Tokyo Bridge Capital. "
                "Geography preference is the primary differentiator — almost all synthetic "
                "startups are US-based, so geography signal is sparse. "
                "Tests whether a near-zero geography signal leads to graceful fallback "
                "to sector/stage matching. Key test for dimension-level confidence: "
                "geography confidence should stay near zero while sector confidence grows."
            ),
        ),

        # ── 10: Enterprise SaaS + data infra ─────────────────────────────────
        Persona(
            id="persona_010",
            name="Enterprise SaaS/Data Investor",
            side="investor",
            anchored_investor_id="investor_006",  # Ironwood Enterprise Capital
            latent_preferences=LatentPreferences(
                preferred_sectors=["SaaS", "AI / ML", "Data infra", "DevTools"],
                avoided_sectors=["Consumer", "Media", "Gaming", "Web3 / Crypto", "Biotech"],
                preferred_stages=["seed", "series_a"],
                preferred_customer_types=["enterprise"],
                preferred_business_models=["subscription", "enterprise_license", "seats"],
                preferred_geographies=["San Francisco", "New York", "United States"],
                lead_or_follow="lead",
                preferred_traction_min="design_partners",
                noise_level=0.12,
            ),
            n_actions_simulated=40,
            notes=(
                "Enterprise SaaS + data infrastructure, anchored to Ironwood Enterprise Capital. "
                "Very focused on enterprise customer type — strictly avoids consumer. "
                "Tests whether customer-type preference is learned without sector contamination: "
                "an AI startup targeting consumers should not score well for this persona even "
                "though AI / ML is in preferred_sectors."
            ),
        ),

        # ── 11: Noisy/conflicting persona (HIGH NOISE) ───────────────────────
        Persona(
            id="persona_011",
            name="Generalist Opportunistic Angel",
            side="investor",
            anchored_investor_id="investor_009",  # Independent Angel
            latent_preferences=LatentPreferences(
                preferred_sectors=["AI / ML", "SaaS", "Marketplace", "Fintech"],
                # Intentional conflict: Consumer appears in both preferred and avoided.
                # This tests whether the learner is robust to contradictory signals.
                avoided_sectors=["Consumer", "Biotech", "Hardware", "Robotics"],
                preferred_stages=["idea", "pre_seed", "seed"],
                preferred_customer_types=["consumer", "smb", "enterprise"],  # all types
                preferred_business_models=["subscription", "marketplace", "advertising"],
                preferred_geographies=["United States"],
                lead_or_follow="either",
                preferred_traction_min="no_traction",
                noise_level=0.30,  # HIGH NOISE — the conflicting/opportunistic persona
            ),
            n_actions_simulated=55,
            notes=(
                "High-noise generalist angel, anchored to Independent Angel. "
                "noise_level=0.30: 30% of actions are random flips that ignore latent preferences. "
                "Intentionally broad sector mandate with Consumer in both preferred AND avoided — "
                "simulates an investor whose stated mandate conflicts with revealed behavior. "
                "High n_actions (55) so the learner has enough signal to partially overcome noise. "
                "Key test: can the system still learn any useful signal at 30% noise? "
                "Expected outcome: low personalization confidence, weak but non-zero lift."
            ),
        ),

        # ── 12: Low-action cold-start investor (COLD START + HIGH NOISE) ──────
        Persona(
            id="persona_012",
            name="Cold-Start Noisy First-Timer",
            side="investor",
            anchored_investor_id=None,  # Virtual — no anchor investor
            latent_preferences=LatentPreferences(
                preferred_sectors=["SaaS", "AI / ML"],
                avoided_sectors=["Web3 / Crypto", "Hardware"],
                preferred_stages=["seed"],
                preferred_customer_types=["enterprise"],
                preferred_business_models=["subscription"],
                preferred_geographies=["United States"],
                lead_or_follow="follow",
                preferred_traction_min="paying_customers",
                noise_level=0.28,  # HIGH NOISE — double adversarial: cold-start + noisy
            ),
            n_actions_simulated=5,  # COLD START — only 5 impressions
            notes=(
                "Double-adversarial test: cold-start (5 actions) AND high noise (28%). "
                "No anchor investor: candidate pool drawn from all 35 synthetic startups. "
                "n_actions_simulated=5 means at most 1–2 positive and 1 negative acted-on events. "
                "With 28% noise, ~1 of those 4 events will be a random flip. "
                "Primary test: behavior_confidence must stay near 0.0 regardless of noise level. "
                "Final ranking must fall back almost entirely to the global LogReg model. "
                "Any strong personalization signal at 5 actions is a confidence-curve bug. "
                "Secondary test: personalization layer must be robust to extremely sparse + "
                "noisy signal without producing instability (no NaN/Inf in scores)."
            ),
        ),
    ]


# ── Validation ─────────────────────────────────────────────────────────────────


def validate_personas(personas: list[Persona]) -> None:
    """Run all required validations.  Raises ValueError on failure."""
    # Count
    if len(personas) != 12:
        raise ValueError(f"Expected exactly 12 personas; got {len(personas)}")

    ids = [p.id for p in personas]
    if len(ids) != len(set(ids)):
        dupes = [pid for pid in ids if ids.count(pid) > 1]
        raise ValueError(f"Duplicate persona IDs: {sorted(set(dupes))}")

    # Per-persona validation
    all_errors: list[str] = []
    for p in personas:
        if p.side != "investor":
            all_errors.append(f"{p.id}: side must be 'investor'; got '{p.side}'")
        errors = p.validate()
        for err in errors:
            all_errors.append(f"{p.id}: {err}")

    # Special constraints from the spec
    high_noise = [p for p in personas if p.latent_preferences.noise_level >= 0.25]
    if len(high_noise) < 2:
        all_errors.append(
            f"At least 2 high-noise personas (noise_level ≥ 0.25) required; "
            f"found {len(high_noise)}: {[p.id for p in high_noise]}"
        )

    cold_start = [p for p in personas if p.n_actions_simulated <= 8]
    if len(cold_start) < 1:
        all_errors.append(
            f"At least 1 cold-start persona (n_actions_simulated ≤ 8) required; "
            f"found {len(cold_start)}"
        )

    later_stage = [
        p for p in personas
        if "series_b_plus" in p.latent_preferences.preferred_stages
    ]
    if len(later_stage) < 1:
        all_errors.append(
            "At least 1 later-stage persona (series_b_plus in preferred_stages) required"
        )

    geo_focus = [
        p for p in personas
        if p.latent_preferences.preferred_geographies
        and not any(g in ["United States", "San Francisco", "New York", "Boston"]
                    for g in p.latent_preferences.preferred_geographies[:1])
    ]
    if len(geo_focus) < 1:
        all_errors.append(
            "At least 1 non-US geography-focused persona required"
        )

    if all_errors:
        msg = "\n".join(f"  • {e}" for e in all_errors)
        raise ValueError(f"Persona validation failed:\n{msg}")


# ── Serialization ──────────────────────────────────────────────────────────────


def personas_to_json(personas: list[Persona]) -> dict:
    """Serialize personas to the canonical JSON schema for synthetic_personas.json."""
    return {
        "schema_version": "1.0",
        "notice": (
            "SYNTHETIC EXPERIMENTAL ONLY. All personas are fictional constructs. "
            "No real investor, founder, or user is represented. "
            "Not investment advice. Does not predict startup success. "
            "Latent preferences are used only for action simulation — "
            "they are never available to the personalization model. "
            "scoreMatch in lib/matching/score.ts remains the production baseline."
        ),
        "phase": "12a-i",
        "n_personas": len(personas),
        "personas": [p.to_dict() for p in personas],
    }


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    print("\n" + "═" * 72)
    print("  SYNTHETIC PERSONA GENERATION — PHASE 12a-i")
    print("═" * 72)
    print("  ⚠  All personas are SYNTHETIC. No real users represented.")
    print("  ⚠  This is NOT investment advice.")
    print("═" * 72 + "\n")

    # Build personas (deterministic — no randomness in this script).
    personas = _build_personas()

    # Validate before writing.
    print("  Validating personas …")
    validate_personas(personas)
    print(f"  ✓  All {len(personas)} personas passed validation.\n")

    # Print summary.
    print(f"  {'ID':<14} {'Name':<44} {'Anchor':<18} {'Noise':>6} {'Actions':>8}")
    print("  " + "─" * 94)
    for p in personas:
        anchor = p.anchored_investor_id or "(virtual)"
        print(
            f"  {p.id:<14} {p.name:<44} {anchor:<18} "
            f"{p.latent_preferences.noise_level:>6.2f} {p.n_actions_simulated:>8}"
        )
    print()

    # Write output.
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    data = personas_to_json(personas)
    OUTPUT_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"  ✓  Wrote {len(personas)} personas to:")
    print(f"     {OUTPUT_PATH}\n")
    print(f"{'═' * 72}")
    print("  Done.  Synthetic personas generated.")
    print("  ⚠  Offline experimental only.  Not for production use.")
    print(f"{'═' * 72}\n")


if __name__ == "__main__":
    main()
