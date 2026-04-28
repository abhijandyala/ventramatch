# DESIGN.md — VentraMatch

> Living design system. Read by the `impeccable` skill on every UI task. Update via `/impeccable document` or by hand — never let an AI rewrite it without a human reviewing the diff.

## Color

OKLCH only. Never `#000` or `#fff`. Every neutral tinted toward the brand hue (chroma 0.005–0.01).

### Strategy
**Restrained.** Tinted neutrals carry the surface. One accent (`brand-ink`) ≤10% of any view, used for the action that matters most: the match score, the "interested" affordance, and the readiness gauge fill. Nowhere else.

### Tokens

Brand hue is **deep ocean** — picked because finance categorical training-data reflexes ("navy + gold", "neon green") are forbidden by `/impeccable` shared laws. We sidestep both by going colder and more saturated.

```css
/* light theme */
--bg:            oklch(99% 0.005 235);   /* near-white, tinted toward brand */
--surface:       oklch(97% 0.008 235);   /* card / input bg */
--surface-2:     oklch(94% 0.01  235);   /* hover, raised */
--border:        oklch(88% 0.012 235);
--text:          oklch(22% 0.02  235);   /* never pure black */
--text-muted:    oklch(48% 0.018 235);
--text-faint:    oklch(65% 0.014 235);

--brand-ink:     oklch(45% 0.16  235);   /* the one accent */
--brand-ink-hov: oklch(40% 0.17  235);
--brand-tint:    oklch(94% 0.04  235);   /* score backgrounds, selected chip */

--success:       oklch(58% 0.13  155);   /* match formed, profile complete */
--warning:       oklch(72% 0.14   75);   /* readiness gaps */
--danger:        oklch(58% 0.18   25);   /* destructive only */

/* dark theme — invert lightness, hold chroma */
[data-theme="dark"] {
  --bg:            oklch(14% 0.012 235);
  --surface:       oklch(18% 0.014 235);
  --surface-2:     oklch(22% 0.016 235);
  --border:        oklch(28% 0.018 235);
  --text:          oklch(94% 0.012 235);
  --text-muted:    oklch(72% 0.016 235);
  --text-faint:    oklch(54% 0.014 235);
  --brand-ink:     oklch(72% 0.16  235);
  --brand-ink-hov: oklch(78% 0.17  235);
  --brand-tint:    oklch(28% 0.06  235);
}
```

### Theme commitment
Default is **light**. Founders fill profiles late at night on phones; investors review on bright monitors during work hours. Both groups in this composite skew toward bright environments. Dark mode is a user preference, not a default.

Concrete scene: *seed-stage founder reviewing their profile on a 13" MacBook in a coffee shop at 2pm in spring; angel investor scanning the feed on a 27" monitor at 10am Tuesday between calls.* Both force light.

## Typography

Pair: **Söhne** (or fallback **Inter**) for UI + **Tiempos Text** (or fallback **Source Serif 4**) for marketing long-form. Numbers always tabular.

Until we license Söhne / Tiempos, ship Inter (variable) + Source Serif 4 (variable) from Google Fonts. Both are next-step replaceable with one CSS swap.

### Scale (1.25 ratio, no flat scales)

```
display    48 / 56   weight 600   tracking -0.02em   serif (marketing only)
h1         36 / 44   weight 600   tracking -0.015em
h2         28 / 36   weight 600   tracking -0.012em
h3         22 / 30   weight 600   tracking -0.01em
h4         18 / 26   weight 600
body-lg    17 / 26   weight 400
body       15 / 24   weight 400
body-sm    13 / 20   weight 400
caption    12 / 16   weight 500   tracking 0.01em
mono-sm    13 / 20   weight 500   font-family: ui-monospace
```

Body line length capped at 65–75ch on long-form.

## Spacing

Base unit **4px**. Never invent spacing — use the scale: `4 8 12 16 20 24 32 40 56 72 96`. Vary it for rhythm; same padding everywhere is monotony.

Card padding: `20px` (compact list cards) or `28px` (feature card / profile sections). Section padding: `56px` mobile, `96px` desktop.

## Radius

```
--radius-sm:  6px   /* chips, badges, tags */
--radius:     10px  /* inputs, buttons */
--radius-md:  14px  /* cards, popovers */
--radius-lg:  20px  /* modals, big surfaces */
```

Avoid `border-radius: 9999px` (pills) for everything. Pills only on chips and avatars.

## Elevation

We use **borders + tinted surfaces**, not shadows, for hierarchy. One purposeful shadow on the floating action panel (`shadow-pop`).

```css
--shadow-pop:    0 8px 32px -12px oklch(22% 0.04 235 / 0.16),
                 0 2px 6px  -2px  oklch(22% 0.04 235 / 0.08);
```

No glassmorphism. No backdrop-blur as decoration. (See impeccable absolute bans.)

## Motion

- All transitions ease out: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart) or `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for swipe cards.
- Durations: `120ms` micro (hover, focus), `220ms` standard (panel open, page section), `360ms` macro (route transition, card discard).
- Never animate `width`, `height`, `top`, `left`. Animate `transform` and `opacity`.
- Respect `prefers-reduced-motion: reduce` — disable all non-essential motion.
- No bounce, no elastic, no spring overshoot.

## Components — opinionated defaults

### Match score
Inline pill with the brand-ink fill. Numeric + tabular. The number is the affordance — it carries hover state and tooltip with the one-line reason.

```
[ 91% ]  ← brand-ink bg, white text, radius-sm, mono-sm font
```

Never two scores side by side without the explanation visible.

### Cards
- Border `1px solid var(--border)`, surface `var(--surface)`, no shadow.
- Hover: surface shifts to `--surface-2`, border unchanged.
- **Never** nest cards. (impeccable absolute ban.)
- Card title is `h4`, not `h3`.

### Buttons
Three variants only:

- **Primary** — brand-ink bg, white text. One per view max.
- **Secondary** — bordered, transparent bg, brand-ink text on hover.
- **Ghost** — text-muted, no border, used for tertiary actions (Pass, Skip).

No "filled-tonal", no "outlined-tonal", no shadcn `outline-secondary-ghost-12` proliferation. Three.

### Inputs
- Border `1px solid var(--border)`, surface `var(--surface)`, radius `--radius`.
- Focus: 2px ring in `--brand-ink` at 20% opacity, no border color change.
- Labels above inputs, never floating. Floating labels are gimmick.

### Chips
- Industry / stage tags. Tinted bg `--brand-tint`, brand-ink text, radius-sm.
- Selectable chips on profile forms get a check icon (Lucide), no checkbox square.

### Empty states
Required on every list. One sentence + one action. No illustrations.

> "No matches yet. Complete your profile to be visible." [Complete profile →]

### Notifications / toasts
Bottom-left on desktop, top on mobile. Auto-dismiss `4s`, swipe to dismiss. Never persistent toast for important info — that's a banner.

## Iconography

Lucide. Never emoji as icons. Stroke width `1.75`. Default size `16px` inline, `20px` standalone.

## Photography / illustration

**No stock startup illustrations.** No floating laptops, no rockets, no abstract gradient orbs. Marketing imagery is one of:

1. Real product screenshots (cropped tight, no chrome).
2. Subtle data visualization fragments as background motifs.
3. Set-in-marble serif word marks for hero typography.

Profile avatars: the platform shows initials in a `--brand-tint` square (radius-sm) by default. Logos and headshots are uploaded by users; we never auto-generate avatars.

## Anti-patterns we will police

These will be flagged by `/impeccable polish` — write them once and someone reverts:

- Hero with `display` text + `body-lg` subtitle + two big buttons centered. SaaS cliché.
- "AI-powered ✨" badge anywhere.
- Purple→pink linear gradient on anything.
- Large rounded square cards in a 3-up grid for "features".
- Stat row of three numbers with `text-4xl` numerals and `text-sm` labels (the hero-metric template — impeccable absolute ban).
- Modal as the first answer to a UX question. Inline first.
- Side-stripe colored borders on alerts. (impeccable absolute ban.)
- Gradient text via `background-clip: text`. (impeccable absolute ban.)

## Tokens file

Tokens live in `app/globals.css` as CSS custom properties on `:root` and `[data-theme="dark"]`. Tailwind v4 `@theme` block maps utilities to those CSS vars. **Never** write a hex color in a component. If a value isn't in the token list above, add it here first, then use it.
