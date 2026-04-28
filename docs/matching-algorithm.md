# Matching Algorithm

> Source of truth for how we score founder–investor fit. The implementation lives in [`lib/matching/score.ts`](../lib/matching/score.ts).

## v1 — weighted heuristic

```
score = 0.30 * sector_match
      + 0.25 * stage_match
      + 0.20 * check_size_match
      + 0.15 * geography_match
      + 0.10 * traction_compatibility
```

Each sub-score is `0.0–1.0`. Final `score` is rendered as `Math.round(score * 100)` percent.

### Sub-scores

| Sub-score | Logic |
|---|---|
| `sector_match` | 1 if startup industry exactly matches one of investor's `sectors`, else 0. (v1.1: fuzzy / synonym match.) |
| `stage_match` | 1 if startup stage is in investor's `stages` array, else 0. |
| `check_size_match` | 1 if `raise_amount` falls within `[check_min, check_max]`. Otherwise linear falloff toward 0 as it leaves the band. |
| `geography_match` | 1 if startup `location` substring-matches one of investor's `geographies`. 0.4 if any geography is set but none match (geography is rarely a hard filter for angels). 0 if no geographies. |
| `traction_compatibility` | v1 stub: presence + length signal on the `traction` text. v1.1 will parse metrics. |

### Output

```ts
{
  score: 91,
  reason: "Invests in fintech and check size fits.",
  breakdown: {
    sector: 1,
    stage: 1,
    check: 1,
    geography: 0.4,
    traction: 0.6,
  }
}
```

### Reason rules

- Use only the top 2 sub-scores that hit 1.0.
- Plain English. No marketing words. No "AI says...".
- If nothing hits 1.0, return: *"Low overall fit. Improve profile or check filters."*

## What we will not do in v1

- ML-trained ranking. Behavior data is too thin and the legal posture (no investment advice) gets harder to defend.
- "Attractiveness scores" based on view-vs-like ratios. (Tinder's `US12105941B2` claim 1 territory.)
- Cross-platform inference (LinkedIn graph, Twitter follower counts). Privacy + scope creep.

## v1.1 (post-MVP) plan

- Sector synonyms via a curated mapping (`fintech` ↔ `financial services`, `dev tools` ↔ `developer tools`, etc.).
- Traction parsing — extract `MRR`, `WAU`, `paying customers`, `enterprise pilots` and weight against investor's stage expectations.
- Investor activity signal — was the investor active on the platform / cap-table announcements in the last 30 days?
- Negative signals — explicit anti-thesis ("no consumer hardware", "no crypto") matches subtract from the score.
- OpenAI 1-line reason rewriter — only for the explanation, never to change the score itself.

## v2 (post product-market fit) plan

- Learning-to-rank on accepted intros only, never on swipes alone.
- Per-investor calibration — some investors say yes to 5%, others to 30%; normalize.
- Cohort analysis — "investors like you funded X".

## Disclaimer (mandatory in UI)

Every surface that shows a score must render:

> *Informational only. Not investment advice. Match scores reflect publicly stated investor preferences and self-reported startup data.*

See [`docs/legal.md`](legal.md) for why this disclaimer is non-negotiable.
