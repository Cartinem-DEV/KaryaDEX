# BunkMatKar Design System

A living reference for UI work in this app. Distilled from the project's own
`constants/theme.ts` tokens, shaped by two curated design-system references:
**Expo** (quietly-confident developer platform, Inter + JetBrains Mono, 8px CTA
radius, black-as-the-only-action-color discipline) and **Vercel** (monochrome
precision, negative tracking on display type, restrained surfaces broken by one
expressive device). Consult this file before building or restyling any screen.

---

## 1. Visual Philosophy

- **Refined glassmorphism** with a strict 3-tier surface hierarchy — hero/cards,
  list rows, and small controls each sit on their own glass tier. Never invent a
  fourth.
- **Atmospheric ambient lighting** — soft colored orbs behind the canvas
  (violet/blue in light mode; amber + electric cyan in dark). The gradient wash
  is background atmosphere, never a brand action color (Expo's "sky gradient in
  the hero only" rule, applied to our orbs).
- **Material/iOS-level polish, restrained.** Subtle translucent borders, soft
  diffused shadows, gentle top/inner highlights. One memorable element per
  screen; everything around it stays quiet.
- **Single accent voltage.** Violet (`brand.violet` `#7C3AED`) is the only
  brand action fill. In dark mode the tab-bar capsule's electric cyan
  (`#00E5FF`) is the sole navigation highlight — don't mix accent languages
  within one screen (Expo: "black is the only CTA fill"; Vercel: monochrome
  broken deliberately, not decoratively).

## 2. Color

All tokens live in `constants/theme.ts`. **Always reference tokens by name —
never inline raw hex in components.**

### Brand
| Token | Value | Role |
|---|---|---|
| `brand.violet` | `#7C3AED` | Primary CTA fill, selected state |
| `brand.violetLight` | `#A78BFA` | Secondary brand touch |
| `brand.violetDark` | `#5B21B6` | Pressed / deep variant |
| `brand.violetSoft` / `violetGlow` | rgba 10% / 18% | Tinted fills, glow |
| `brand.indigo` (+`Soft`/`Glow`) | `#6366F1` | Companion accent, gradients |
| `brand.accent` | `#8B5CF6` | Highlight accent |

### Semantic status (attendance/academic signals)
| Token | Value | Meaning |
|---|---|---|
| `status.safe` | `#10B981` | On-track, attended, done |
| `status.watch` | `#F59E0B` | At-risk, pending |
| `status.danger` | `#EF4444` | Breach, failed, destructive |
| `status.info` | `#3B82F6` | Neutral information |

Each status ships with `Bg` (10% tint fill), `Glass` (12%), and `Border` (24%)
companion tokens — use the set together; a status color never appears raw on
canvas without its tinted context.

### Surfaces — light mode
| Token | Value | Notes |
|---|---|---|
| `light.background` | `#F6F8FC` | Cool near-white canvas |
| `light.surface` | `#FFFFFF` | Cards, sheets |
| `light.surfaceSecondary/Tertiary` | `#EEF2F9` / `#E2E8F4` | Chips, wells, dividers |
| `light.text` | `#0F172A` | Ink — display + emphasis |
| `light.textSecondary` | `#475569` | Default running text |
| `light.textTertiary` | `#94A3B8` | Captions, placeholder |
| `light.border` / `borderStrong` | slate rgba 8% / 16% | Hairlines (Expo's 1px-hairline discipline) |

### Surfaces — dark mode
| Token | Value | Notes |
|---|---|---|
| `dark.background` | `#05070B` | Near-black, blue-tinted — not pure #000 |
| `dark.surface` → `surfaceTertiary` | `#0A0E1A` → `#161E34` | Rising steps of one navy-ink ramp |
| `dark.text` | `#F8FAFC` | On-dark ink |
| `dark.textSecondary/Tertiary` | `#94A3B8` / `#64748B` | Stepped down |
| dark tab active | `#00E5FF` cyan capsule | The dark mode's single signal color |

### Liquid glass tiers (both modes have full token sets)
| Tier | Use | Examples |
|---|---|---|
| `glassPrimary` | Hero cards, modals, bottom nav | Highest translucency + strongest shadow stack |
| `glassSecondary` | Subject/task cards, schedule blocks, list rows | Mid translucency |
| `glassTertiary` | Pills, inputs, tags, small buttons | Near-solid, tightest shadow |

Each tier has matching `Border`, `Highlight` (inner top glow), and `Shadow`
tokens. Pick the tier by component class, not by taste.

### Ambient orbs
Light: violet `0.09`, blue `0.08`, violet-soft `0.06` — barely-there.
Dark: amber `0.22`, cyan `0.22`, amber `0.10` — the onboarding pairing.
Orbs are background-only, low-opacity, and never carry text contrast duties.

## 3. Typography

- **Family:** Inter (web) / System (iOS) / Roboto (Android) via
  `typography.fontFamily`; every code/numeric-technical surface uses
  `typography.fontFamilyMono` (JetBrains Mono on web) — Expo's rule: mono
  belongs on all code surfaces.
- **Display weight cap: 600** (`semibold`). Bold 700+ is reserved for
  emphasis-in-place, not headlines. Vercel/Expo both run display at 600.
- **Negative tracking on large text:** `letterSpacing.tight` (−0.5) at `xl`+
  sizes; zero below. Never letter-space body copy.

| Token | Size | Use |
|---|---|---|
| `sizes.xs` / `sm` | 11 / 13 | Captions, badge labels, micro-labels |
| `sizes.base` / `md` | 15 / 17 | Body, list rows |
| `sizes.lg` | 20 | Section titles |
| `sizes.xl` / `2xl` | 24 / 30 | Screen headers, hero numerals |
| `sizes.3xl` / `4xl` | 36 / 48 | Onboarding display, dashboard stat heroes |

Line heights: `tight` 1.2 (display), `normal` 1.4 (UI), `relaxed` 1.6 (prose).
Avoid the templated tells: no all-caps labels everywhere, no single-word
italic/color accents in headlines, no decorative eyebrow above every section.

## 4. Layout & Spacing

- **Base unit 4px.** Scale: `spacing.xs 4 → sm 8 → md 12 → base 16 → lg 20 →
  xl 24 → 2xl 32 → 3xl 40 → 4xl 48 → 5xl 64`.
- Screen gutters: `base` (16) minimum; card internals: `lg`–`xl` (20–24).
- Vertical rhythm between sections: `2xl`–`3xl` on mobile (the 96px web
  section rhythm of Expo/Vercel compresses to mobile pacing).
- One column on phone; the web export (`expo export:web` / `npm run web`) caps
  content ~1200px and may go 2–3-up card grids ≥1024px.
- Radii: `xs 4` inline tags · `sm 8` inputs/small buttons (CTA dialect) ·
  `md 12` standard cards · `lg 16`/`xl 20` hero cards, modals · `full` pills
  for badges/chips **only** — primary buttons keep `sm`/`md` (Expo: pills are
  for badges, not CTAs).

## 5. Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | canvas + 1px `border` hairline | Default rows, dividers |
| `shadows.sm` | 1–3px soft drop | Chips, tertiary glass |
| `shadows.md` | 8–10px diffuse | Secondary cards, popovers |
| `shadows.lg` + tier `Shadow` stack | layered ambient + inset highlight | Primary glass, modals, tab bar |
| Dark inversion | `dark.surface*` ramp | Modals over `overlay` |

Depth comes from the **inset top highlight inside translucent borders**, not
from heavy drop shadows — max one shadow tier of lift at a time. Web uses
`boxShadow`; native uses `shadow*` + `elevation` — `shadows.*` tokens already
branch on `Platform.OS`; never hand-roll platform shadow objects in components.

## 6. Component Contracts

- **Primary button:** `brand.violet` fill, white text, radius `sm`/`md`,
  ≥44px touch height, press state `brand.violetDark`. Disabled = 40% opacity
  fill, `textTertiary` label. One primary per view.
- **Secondary button:** surface + 1px `borderStrong`, ink text, same radius.
- **Tab bar (floating glass):** `tabBar` background, `tabBarBorder`,
  `tabBarShadow`; active tab = capsule (`tabBarActiveCapsule*`; light: white
  capsule + ink text, dark: cyan capsule + `#00E5FF` text). No per-icon
  gradients.
- **Cards:** choose tier by content class (see §2). Padding 20–24, radius
  12–20, no nested glass.
- **Status badge / attendance ring:** always the status token triad
  (`status.X` text/icon + `status.XBg` fill + `status.XBorder` outline).
  Never a status color off its named pair.
- **Inputs:** `glassTertiary`, ink text, radius `sm`, 44px min height; focus =
  `borderStrong` + violet glow, not a colored fill.
- **Micro-labels:** `caption-uppercase` pattern (11px/600/+0.88 tracking) only
  where a real category signal exists — not as decoration.

## 7. Do

- Reference every color, radius, space via `theme.ts` tokens (`{colors.*}`,
  `{spacing.*}` mindset from the Expo/Vercel DESIGN.md format).
- Spend boldness in one place per screen (mascot moment, big stat, gradient
  orb) — keep chrome disciplined.
- Respect reduced motion and dark mode as first-class: every new component
  defines both schemes from its tokens.
- Keep WCAG AA contrast: ink on canvas passes; `textTertiary` is caption-only;
  status colors on their own 10% tints are the tested pairing.
- Name things in the user's language ("Attendance," "Backlog risk"), not the
  system's ("rows," "sync queue").

## 8. Don't

- No new saturated accent colors beyond the brand + status tables. Violet is
  the only CTA fill.
- No full-pill CTAs; no gradient text; no glass stacked on glass.
- No display weight below 600 or above 700; no mono type for prose.
- No ambient orbs in front of, or inside, content cards.
- No raw hex in component files — add the token to `theme.ts` first.
- No hover-only affordances (this ships on touch), and no motion that isn't
  answering a user action or introducing the one hero moment.

## 9. Agent Prompt Guide

When asked to build or change UI in `bunkmatkar/`:

1. Read this file, then `constants/theme.ts` (single source of truth — tokens
   here are summarized, the code is canonical).
2. Pick the glass tier, radius, and status triad by component class (§2, §6)
   before writing style code.
3. Draft a one-paragraph plan (surface tier, accent placement, type roles),
   sanity-check it against §7/§8, then implement.
4. Verify light + dark both render correctly; for web-visible work, screenshot
   via the Playwright skills (`playwright-cli`, `web-design-guidelines`) at
   390px and 1280px.
5. Critique one thing to cut before finishing (Chanel rule): if a decoration
   doesn't encode information, remove it.

---
*Derived from Expo and Vercel DESIGN.md analyses (VoltAgent/awesome-design-md,
alpha) adapted to BunkMatKar's mobile glassmorphism system. Update this file
when theme tokens change.*
