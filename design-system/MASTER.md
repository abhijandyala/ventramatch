# Design System — VentraMatch (MASTER)

> Generated initial seed. Run `python3 .cursor/skills/ui-ux-pro-max/scripts/search.py "fundraising matchmaking SaaS for VCs and founders" --design-system --persist -p "VentraMatch"` to refresh from the ui-ux-pro-max skill.

This file is the **page-agnostic** source of truth for design tokens. Page-specific overrides go in `pages/<page-name>.md`.

The runtime token values live in [`/app/globals.css`](../app/globals.css) under `@theme`. This document explains *intent*; the CSS is the implementation.

## Pattern

`feature-rich showcase + signal-first cards` — deliberate hybrid. The marketing landing leans `feature-rich showcase` (founders need to understand what we are; investors need to see we're serious). The product surface leans `signal-first cards` (investor scans 100 startups in 5 minutes).

## Style register

`product` register, lightly inflected by `Soft UI Evolution` for the product surface, `Editorial Grid / Magazine` for the marketing landing.

Keywords: deliberate, scannable, calm authority, opinionated defaults.

## Color (Restrained strategy)

| Role | Light | Dark | Usage |
|---|---|---|---|
| `bg` | `oklch(99% 0.005 235)` | `oklch(14% 0.012 235)` | Page background |
| `surface` | `oklch(97% 0.008 235)` | `oklch(18% 0.014 235)` | Card / input bg |
| `surface-2` | `oklch(94% 0.01 235)` | `oklch(22% 0.016 235)` | Hover, raised |
| `border` | `oklch(88% 0.012 235)` | `oklch(28% 0.018 235)` | All borders |
| `text` | `oklch(22% 0.02 235)` | `oklch(94% 0.012 235)` | Body |
| `text-muted` | `oklch(48% 0.018 235)` | `oklch(72% 0.016 235)` | Secondary copy |
| `text-faint` | `oklch(65% 0.014 235)` | `oklch(54% 0.014 235)` | Captions, meta |
| `brand-ink` | `oklch(45% 0.16 235)` | `oklch(72% 0.16 235)` | THE accent (≤10%) |
| `brand-tint` | `oklch(94% 0.04 235)` | `oklch(28% 0.06 235)` | Score backgrounds, selected chips |
| `success` | `oklch(58% 0.13 155)` | same | Match formed, profile complete |
| `warning` | `oklch(72% 0.14 75)` | same | Readiness gaps |
| `danger` | `oklch(58% 0.18 25)` | same | Destructive only |

## Typography

| Token | Family | Size / Line | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `display` | serif | 48 / 56 | 600 | -0.02em | Marketing hero only |
| `h1` | sans | 36 / 44 | 600 | -0.015em | Page title |
| `h2` | sans | 28 / 36 | 600 | -0.012em | Section title |
| `h3` | sans | 22 / 30 | 600 | -0.01em | Subsection |
| `h4` | sans | 18 / 26 | 600 | normal | Card title |
| `body-lg` | sans | 17 / 26 | 400 | normal | Lead paragraph |
| `body` | sans | 15 / 24 | 400 | normal | Default body |
| `body-sm` | sans | 13 / 20 | 400 | normal | Dense lists |
| `caption` | sans | 12 / 16 | 500 | 0.01em | Meta, labels |
| `mono-sm` | mono | 13 / 20 | 500 | normal | Numbers, code |

Pair: Inter (variable) + Source Serif 4 (variable). Replaceable with Söhne + Tiempos Text once licensed.

## Spacing

`4 8 12 16 20 24 32 40 56 72 96` (px). Card padding `20` or `28`. Section padding `56` mobile / `96` desktop.

## Radius

`6 / 10 / 14 / 20` for `sm / default / md / lg`. Pills only on chips and avatars.

## Motion

- Curves: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart) for UI; `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for swipe-card discard.
- Durations: `120ms` micro / `220ms` standard / `360ms` macro.
- Animate `transform` and `opacity` only.
- Respect `prefers-reduced-motion`.

## Components — defaults

### Match score pill
```
[ 91% ]   bg: brand-ink, text: white, font: mono-sm, radius: sm, padding: 4px 8px
```
Number is the affordance. Hover reveals the one-line reason. Always paired with the reason text within 320px reading distance.

### Cards
- 1px border, surface bg, no shadow.
- Hover: surface-2.
- Never nested.
- Title is `h4`.

### Buttons
Three only: **primary** (brand-ink), **secondary** (bordered), **ghost** (text-muted, no border).

### Inputs
Border-only, `--brand-ink` 20% focus ring. Labels above, never floating.

### Empty states
One sentence + one action. No illustration.

## Icons

Lucide. Stroke 1.75. Inline 16px / standalone 20px.

## Bans

| Ban | Why |
|---|---|
| `border-left` colored stripe on cards | Side-stripe (impeccable absolute ban) |
| `background-clip: text` gradient text | Decorative non-meaning (impeccable absolute ban) |
| `backdrop-blur` as decoration | Glassmorphism reflex (impeccable absolute ban) |
| Hero with big number + small label trio | Hero-metric template (impeccable absolute ban) |
| 3-up grid of identical icon-heading-text cards | Identical card grids (impeccable absolute ban) |
| Modal as first answer | Use inline first |
| AI-purple-pink gradient | Category reflex |
| Emoji as functional icons | Use Lucide SVG |

## Pre-delivery checklist (apply before any merge)

- [ ] No emoji as icons (Lucide / Heroicons SVG only)
- [ ] `cursor: pointer` on every clickable element
- [ ] Hover states with 120–220ms ease-out transitions
- [ ] Light-mode text contrast ≥ 4.5:1
- [ ] Focus states visible on keyboard nav
- [ ] `prefers-reduced-motion: reduce` respected
- [ ] Responsive at 375 / 768 / 1024 / 1440
- [ ] Disclaimer present on any match-score surface
- [ ] No `#000` / `#fff` anywhere
- [ ] No invented spacing, radius, or color values

---

When this MASTER changes, regenerate any page overrides under `pages/` and refresh the corresponding `app/globals.css` token block.
