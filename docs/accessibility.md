# Accessibility — VentraMatch

## Current status

Sprint 15.E establishes the baseline. Automated axe-core auditing and
manual keyboard/screen-reader testing are ongoing.

## Standards

- Target: **WCAG 2.1 AA**.
- All interactive elements must be keyboard-reachable with visible focus.
- All images and icons must have `alt` text or `aria-label`.
- Color contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for large text.
- No information conveyed by color alone.

## Tooling

- **axe-core**: run via `@axe-core/playwright` in E2E tests (when added).
  For manual spot-checks, use the axe DevTools browser extension.
- **Lighthouse accessibility**: target ≥ 95 on `/`, `/sign-up`, `/dashboard`,
  `/feed`, `/p/[userId]`.

## Common patterns in this codebase

| Pattern | How we handle it |
|---|---|
| Modals / dialogs | Native `<dialog>` element — focus trap + Esc built in. |
| Icon-only buttons | Always have `aria-label` (e.g. kebab menu, notification bell). |
| Status pills / badges | Include text content, not just color. Screen readers read the text. |
| Form inputs | Wrapped in `<label>` elements, or use `aria-label` for icon-only inputs. |
| Avatars | `role="img"` + `aria-label` on initials fallback; `alt` on `<Image>`. |
| Skip link | Exists in root layout (`SkipLink` component). |
| Focus management | After modal close, focus returns to the trigger button. |

## Known gaps (to fix as they're found)

- [ ] Filter panel chips on `/feed` — keyboard nav between chips needs tab stops.
- [ ] Report dialog reason radio buttons — need `fieldset` + `legend` for screen readers.
- [ ] Notification bell dropdown — needs `aria-live="polite"` for real-time badge updates.
- [ ] Mobile drawer — test with VoiceOver on iOS; may need `aria-modal="true"` adjustment.
- [ ] Dark mode — not implemented; when it is, verify all contrast ratios.

## How to audit a page

1. Open the page in Chrome.
2. Open axe DevTools → "Analyze" → review violations.
3. Fix anything critical or serious.
4. Tab through the entire page — every interactive element should be reachable.
5. Turn on VoiceOver (Cmd+F5 on Mac) → navigate the page → verify all content is announced.
6. Check Lighthouse accessibility score → target ≥ 95.
