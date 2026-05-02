"""
scripts/ml/personalization/persona_models.py

Data structures for synthetic investor-side personalization personas.

─── CRITICAL NOTICE ─────────────────────────────────────────────────────────
  • All personas here are ENTIRELY SYNTHETIC CONSTRUCTS.
  • No real investor, founder, or user is represented.
  • Latent preferences exist only to drive synthetic action simulation.
    They are NEVER available to the personalization model at inference time.
  • This module is NOT investment advice.
  • It does NOT predict startup success, fundability, or investment returns.
  • It is NEVER imported by production code.
  • `scoreMatch` in lib/matching/score.ts is the production baseline.
─────────────────────────────────────────────────────────────────────────────

Design rules
────────────
  1. `LatentPreferences` is the only place ground-truth persona preferences are
     stored.  Phase 12a (simulate_actions.py) reads it to produce a realistic
     action stream.  Phase 12b (personalize.py and eval_personalization.py)
     must NEVER read LatentPreferences directly — they receive only the action
     stream as input, just as a real model would.

  2. `noise_level` controls how often the simulator ignores the latent
     preferences when generating an action.  0.0 = always acts on preferences
     (unrealistic); 0.15 = 15% chance of acting against preferences (default).
     Higher values test robustness and prevent overfitting to clean signals.

  3. `n_actions_simulated` is the total number of "shown" impressions given to
     this persona.  Acted-on events (saves, likes, passes, etc.) are a subset.
     A low value (≈5) simulates a cold-start user with almost no signal.

  4. All string literals in `preferred_sectors`, `avoided_sectors`, etc. must
     match the canonical sector/stage/customer_type values defined in
     lib/matching/features.ts and lib/profile/sectors.ts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# ── Allowable values (mirroring lib/matching/features.ts) ────────────────────

VALID_STAGES = {"idea", "pre_seed", "seed", "series_a", "series_b_plus"}

VALID_LEAD_FOLLOW = {"lead", "follow", "either"}

VALID_TRACTION_TIERS = {
    "no_traction",
    "waitlist",
    "design_partners",
    "pilots",
    "paying_customers",
    "mrr",
    "arr",
    "enterprise_contracts",
}

VALID_CUSTOMER_TYPES = {
    "consumer",
    "smb",
    "enterprise",
    "developer",
    "government",
    "marketplace",
    "other",
}

VALID_SIDES = {"investor", "founder"}


# ── Data classes ──────────────────────────────────────────────────────────────


@dataclass
class LatentPreferences:
    """Ground-truth investor preferences used ONLY by the action simulator.

    ⚠️  This object is NEVER passed to the personalization model.
    It exists solely to generate realistic synthetic behavior.

    In the real product there is no equivalent object — preferences must be
    inferred purely from observed interactions.  The strict read-boundary
    between LatentPreferences and personalize.py enforces this constraint.

    Fields
    ──────
    preferred_sectors : list[str]
        Canonical sector labels the persona is predisposed to engage positively.
        Empty list = no sector bias.

    avoided_sectors : list[str]
        Sectors the persona is predisposed to pass on.  May overlap with
        preferred_sectors for noisy/conflicting personas (rare but intentional).

    preferred_stages : list[str]
        Stage strings from VALID_STAGES the persona prefers.

    preferred_customer_types : list[str]
        Customer-type strings the persona prefers.

    preferred_business_models : list[str]
        Business-model strings the persona prefers (e.g. "subscription",
        "enterprise_license", "marketplace").

    preferred_geographies : list[str]
        Substring-match strings (e.g. "San Francisco", "United States").
        Empty list = geography-agnostic.

    lead_or_follow : str
        "lead", "follow", or "either".  Describes the persona's investment
        role preference, used when scoring engagement with a startup's
        lead_follow_score feature.

    preferred_traction_min : str
        Minimum traction tier from VALID_TRACTION_TIERS.  Pairs whose startup
        traction_strength_score falls below this tier are less likely to
        receive positive actions.

    noise_level : float
        Probability in [0.0, 1.0] that a given action ignores the latent
        preferences.  0.0 = deterministic; 0.15 = 15% noise (default);
        0.30 = noisy/conflicting persona.  Values above 0.30 are intentionally
        not used — they would make learning nearly impossible and are not
        realistic even for the noisiest real users.
    """

    preferred_sectors: list[str] = field(default_factory=list)
    avoided_sectors: list[str] = field(default_factory=list)
    preferred_stages: list[str] = field(default_factory=list)
    preferred_customer_types: list[str] = field(default_factory=list)
    preferred_business_models: list[str] = field(default_factory=list)
    preferred_geographies: list[str] = field(default_factory=list)
    lead_or_follow: str = "either"
    preferred_traction_min: str = "no_traction"
    noise_level: float = 0.15

    def validate(self) -> list[str]:
        """Return a list of validation error strings (empty if valid)."""
        errors: list[str] = []
        for stage in self.preferred_stages:
            if stage not in VALID_STAGES:
                errors.append(f"preferred_stages: unknown stage '{stage}'")
        if self.lead_or_follow not in VALID_LEAD_FOLLOW:
            errors.append(f"lead_or_follow: unknown value '{self.lead_or_follow}'")
        if self.preferred_traction_min not in VALID_TRACTION_TIERS:
            errors.append(f"preferred_traction_min: unknown tier '{self.preferred_traction_min}'")
        for ct in self.preferred_customer_types:
            if ct not in VALID_CUSTOMER_TYPES:
                errors.append(f"preferred_customer_types: unknown type '{ct}'")
        if not 0.0 <= self.noise_level <= 1.0:
            errors.append(f"noise_level must be in [0, 1]; got {self.noise_level}")
        return errors

    def to_dict(self) -> dict:
        return {
            "preferred_sectors": self.preferred_sectors,
            "avoided_sectors": self.avoided_sectors,
            "preferred_stages": self.preferred_stages,
            "preferred_customer_types": self.preferred_customer_types,
            "preferred_business_models": self.preferred_business_models,
            "preferred_geographies": self.preferred_geographies,
            "lead_or_follow": self.lead_or_follow,
            "preferred_traction_min": self.preferred_traction_min,
            "noise_level": self.noise_level,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "LatentPreferences":
        return cls(
            preferred_sectors=d.get("preferred_sectors", []),
            avoided_sectors=d.get("avoided_sectors", []),
            preferred_stages=d.get("preferred_stages", []),
            preferred_customer_types=d.get("preferred_customer_types", []),
            preferred_business_models=d.get("preferred_business_models", []),
            preferred_geographies=d.get("preferred_geographies", []),
            lead_or_follow=d.get("lead_or_follow", "either"),
            preferred_traction_min=d.get("preferred_traction_min", "no_traction"),
            noise_level=float(d.get("noise_level", 0.15)),
        )


@dataclass
class Persona:
    """A synthetic investor-side persona for the personalization simulator.

    ⚠️  Entirely synthetic.  No real investor is represented.
        Not investment advice.  Not a predictor of real outcomes.

    Fields
    ──────
    id : str
        Unique identifier, e.g. "persona_001".

    name : str
        Human-readable display name for reports.

    side : str
        Always "investor" in Phase 12.  "founder" is reserved for future work.

    anchored_investor_id : Optional[str]
        If set, this persona "acts as" the given investor from investors.json,
        meaning its candidate pool is drawn from that investor's eligible pairs.
        None → virtual investor; candidate pool is all 35 synthetic startups.

    latent_preferences : LatentPreferences
        Ground-truth preferences used by simulate_actions.py ONLY.
        ⚠️  personalize.py must not read this field.

    n_actions_simulated : int
        Total "shown" impressions to simulate.  Acted-on events are a subset.
        Low values (~5) test cold-start behaviour.

    notes : str
        Free-text description of the persona's archetype and design intent.
        Useful for report interpretation and regression testing.
    """

    id: str
    name: str
    side: str
    latent_preferences: LatentPreferences
    n_actions_simulated: int
    notes: str
    anchored_investor_id: Optional[str] = None

    def validate(self) -> list[str]:
        """Return a list of validation error strings (empty if valid)."""
        errors: list[str] = []
        if not self.id:
            errors.append("id must not be empty")
        if self.side not in VALID_SIDES:
            errors.append(f"side must be one of {VALID_SIDES}; got '{self.side}'")
        if self.n_actions_simulated <= 0:
            errors.append(f"n_actions_simulated must be positive; got {self.n_actions_simulated}")
        errors.extend(self.latent_preferences.validate())
        return errors

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "side": self.side,
            "anchored_investor_id": self.anchored_investor_id,
            "latent_preferences": self.latent_preferences.to_dict(),
            "n_actions_simulated": self.n_actions_simulated,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Persona":
        return cls(
            id=d["id"],
            name=d["name"],
            side=d["side"],
            anchored_investor_id=d.get("anchored_investor_id"),
            latent_preferences=LatentPreferences.from_dict(d["latent_preferences"]),
            n_actions_simulated=int(d["n_actions_simulated"]),
            notes=d.get("notes", ""),
        )
