# Synthetic Matching Dataset

## ⚠️ Important — Read before using

| | |
|---|---|
| **Real user data?** | No. Every profile is entirely fictional. |
| **Investment advice?** | No. No label, score, or ranking here constitutes investment advice. |
| **Predicts startup success?** | No. Labels reflect profile-fit matching quality only. |
| **Fundability or return potential scores?** | No. Those do not exist anywhere in this dataset. |
| **Safe for production import?** | No. This data is for offline algorithm development only. |

---

## What this is

This folder holds a synthetic founder–investor matching dataset for VentraMatch algorithm development.
VentraMatch does not yet have real users. This dataset exists so the matching pipeline can be tested,
labeled, and iterated on before launch — without touching any real person's data.

**All startup and investor profiles are fictional.** Any resemblance to real companies, founders,
funds, or investors is coincidental.

---

## Files

| File / Directory | Contents |
|------|----------|
| `startups.json` | 35 synthetic startup profiles _(committed)_ |
| `investors.json` | 17 synthetic investor profiles _(committed)_ |
| `pairs.json` | 595 startup–investor pair features and labels _(generated, gitignored)_ |
| `embeddings/` | Pre-computed MiniLM text embeddings per profile _(generated, gitignored)_ |
| `artifacts/` | ML training report, confusion matrices, predictions _(generated, gitignored)_ |

`pairs.json`, `embeddings/*.json`, and `artifacts/*` are all generated at runtime and gitignored.
Only `.gitkeep` files are committed in `embeddings/` and `artifacts/` to anchor the directories.

---

## Full pipeline (Phase 7+)

```bash
# One-command: compute embeddings → regenerate pairs → train model
npm run prepare:synthetic-matches

# Or step by step:
npm run embeddings:synthetic-matches   # compute_embeddings.py → embeddings/*.json
npm run generate:synthetic-matches     # generate-synthetic-match-pairs.ts → pairs.json
npm run train:synthetic-matches        # train_synthetic_matching.py → artifacts/
```

### Regenerating pairs.json only

Or directly:

```bash
npx tsx scripts/generate-synthetic-match-pairs.ts
```

The script will:
1. Load `data/synthetic-matching/startups.json` and `investors.json`.
2. Load `data/synthetic-matching/embeddings/startups.json` and `investors.json` if present.
3. Generate all 595 startup–investor pairs (35 × 17 Cartesian product).
4. Call `computeMatchFeatures` from `lib/matching/features.ts` on each pair, passing embeddings.
5. Apply rule-based labeling to assign a fit label (0–4). Semantic similarity does NOT affect labels.
6. Write `data/synthetic-matching/pairs.json`.

The label distribution, thresholds, and weighting constants are defined at the top of the
generation script and are tunable without modifying any profile data.

---

## Embeddings (Phase 7)

Pre-computed using `sentence-transformers/all-MiniLM-L6-v2` by `scripts/ml/compute_embeddings.py`.

| File | Contents |
|------|----------|
| `embeddings/startups.json` | `{ "startup_id": [384 floats], ... }` |
| `embeddings/investors.json` | `{ "investor_id": [384 floats], ... }` |
| `embeddings/_metadata.json` | Model name, dim, versions, text fields used, generated timestamp |

**Text composition:**
- Startup: `one_liner + problem + solution + "Team: " + founder_background`
- Investor: `investment_thesis`

All vectors are L2-normalised. Cosine similarity = dot product.

**When to regenerate:** whenever `startups.json` or `investors.json` profile text changes.

**Notice:** Embeddings are SYNTHETIC and EXPERIMENTAL. They measure text similarity between
synthetic profiles for profile-fit matching only. They are NOT investment advice and do NOT
predict startup success.

---

## Label definitions

| Label | Name | Meaning |
|-------|------|---------|
| `0` | poor fit | Stage mismatch, sector conflict, anti-thesis hit, or no meaningful overlap |
| `1` | weak fit | One or two faint signal overlaps; most dimensions do not align |
| `2` | possible fit | Moderate overlap in some dimensions; meaningful gaps remain |
| `3` | strong fit | Solid alignment across sector, stage, check size, and customer type |
| `4` | excellent fit | High overlap across all major dimensions, no anti-thesis conflict |

**These labels represent profile-fit quality only.** They do not represent:
- The probability that this investor would fund this startup.
- The probability that this startup will succeed.
- The expected financial return of any investment.
- Any forward-looking statement about any real company or investor.

The expected synthetic label distribution is approximately:
- ~35–45% poor fit (0)
- ~20–30% weak fit (1)
- ~15–25% possible fit (2)
- ~8–15% strong fit (3)
- ~3–8% excellent fit (4)

This is intentional. Most startup–investor pairs in any real market are not good fits.
An overly positive distribution would produce a biased training signal.

---

## Sector taxonomy

Both `startups[].sectors` and `investors[].sectors` use the canonical sector labels from
`lib/profile/sectors.ts` (`STARTUP_SECTORS`). The same module is used in production matching.

When adding new synthetic profiles, use only the canonical labels (e.g., `"AI / ML"`,
`"Healthtech"`, `"Climate / Cleantech"`, `"DevTools"`) to ensure compatibility with sector
overlap scoring in `lib/matching/features.ts`.

Canonical labels as of this sprint:

```
"AI / ML", "Fintech", "SaaS", "Climate / Cleantech", "Healthtech", "Biotech",
"DevTools", "Cybersecurity", "Consumer", "EdTech", "Marketplace", "E-commerce",
"Hardware", "Robotics", "Defense", "Logistics", "Real estate / Proptech", "Gaming",
"Industrial", "Data infra", "Web3 / Crypto", "Future of Work", "Govtech", "Media",
"Space / Aerospace", "Mobility", "Deep Tech", "Other"
```

---

## Connecting to production matching

### The safe baseline

`lib/matching/score.ts` (`scoreMatch`) is the live production heuristic. It is not modified
by this sprint. The synthetic pipeline does not call `scoreMatch` directly because the
synthetic `SyntheticStartup` and `SyntheticInvestor` types are intentionally richer than the
production `Database["public"]["Tables"]["startups"]["Row"]` and `investors["Row"]` types.

`scoreMatch` remains the safe fallback for all production feed ranking until an experimental
replacement has been validated against real interaction data.

### The experimental path (post-launch)

After launch, the planned progression is:

1. **Collect real interaction data** — likes, passes, and mutual matches from real
   founder–investor pairs, with explicit consent and in compliance with the platform's
   privacy policy.
2. **Run feature extraction on real profiles** — call `computeMatchFeatures` on real pairs
   and compare the feature distributions to this synthetic baseline to detect distribution shift.
3. **Add embeddings** — replace the `semantic_similarity_placeholder` field (null in this
   sprint) in `lib/matching/features.ts` with real text embeddings (e.g., `text-embedding-3-small`
   or a self-hosted `all-MiniLM-L6-v2` model) computed over thesis, one-liner, and founder
   background text.
4. **Train an experimental ranking model** — only after the feature set is validated on real
   data. Candidate approaches: gradient boosted trees (XGBoost/LightGBM) or a lightweight
   two-tower MLP. Model is trained on interaction outcomes (mutual match = positive), not on
   the synthetic labels here.
5. **Feature-flagged A/B test** — the experimental model runs behind a feature flag and is
   compared against `scoreMatch` on quality metrics (match-to-intro rate, intro-to-meeting
   rate) before any production change.

`scoreMatch` is never removed or demoted without validated replacement evidence.

---

## Synthetic profile design notes

### Why some profiles are intentionally weak

The dataset includes 5–6 deliberately weak startup profiles (e.g., startup_001, startup_023,
startup_032–035). These exist to ensure the labeling logic produces realistic distributions of
poor and weak labels. Without them, the pair distribution skews optimistic because every
startup would be a plausible match for at least some investors.

Weak profile indicators in this dataset:
- Idea-stage raise requests far above typical angel/pre-seed check sizes (e.g., $8–10M ask at idea stage)
- Vague or generic descriptions with no concrete problem/solution
- Pivoted business models with no traction evidence
- Mismatched customer type and business model for the stage

### Why investors have strict anti-thesis fields

Several investors (e.g., investor_005 Prism Consumer, investor_008 Sentinel Cyber,
investor_015 Latitude Crypto) have narrow mandates and strict anti-thesis fields. These exist
to drive the `anti_thesis_conflict_score` in `lib/matching/features.ts` and to test the
capping logic in the labeling script (direct anti-thesis conflict → label capped at 1).

---

## What this dataset is not

- Not a training set for any currently deployed model.
- Not a benchmark of real investor behavior or preferences.
- Not a substitute for real user feedback and interaction data.
- Not a set of claims about any real investor's thesis, sectors, or check size.
- Not suitable as input for any production system without explicit review and approval.
- Not investment advice in any form.
