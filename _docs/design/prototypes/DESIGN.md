# PickFlick Design System

Dark-cinema design system for a film club app. The active direction is **Projector Noir**: a monochrome noir foundation with one controlled amber-lit focal scene and a connected warm state route.

---

## Color Tokens

### Core (dark theme)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0c0c0c` | Page background |
| `--surface` | `#161616` | Cards, panels, sheets |
| `--surface-lit` | `#1e1e1e` | Elevated surface (hover, popovers) |
| `--fg` | `#eee9e5` | Primary text |
| `--muted` | `#7d7a76` | Captions and short metadata — borderline contrast on `--surface`. Avoid for long paragraphs |
| `--fg-secondary` | `#a6a19c` | Longer secondary text — Settings, Privacy, card descriptions, form hints |
| `--border` | `#2d2a27` | Default borders |
| `--border-lit` | `#403c38` | Elevated borders |

### Button tokens

| Token | Value | Role |
|---|---|---|
| `--button-primary-hover` | `#ddd7d1` | Primary button hover background (ivory-toned neutral, ~92% luminance) |

### Monochrome accent

The monochrome accent system — neutral greys, no colour. Used for text, borders, subtle hover states, and structural UI elements. Always safe, never competes with the warm layer.

| Token | Value | Role |
|---|---|---|
| `--accent` | `#eee9e5` | Monochrome accent — same as `--fg`; use for structural emphasis |
| `--accent-dim` | `#706a64` | Decorative inactive icons, subtle separators, disabled-looking ornament. Do not use for essential text below 18px |
| `--accent-glow` | `rgba(238,233,229,.08)` | Mono glow backgrounds |
| `--accent-soft` | `rgba(238,233,229,.06)` | Soft mono hover backgrounds |

### Warm accent (cinematic layer)

The warm accent system — gold and ivory, cinematic warmth. Used for ratings, achievements, interactions, watchlist, ticket bubble, and decorative glow. Lives on top of the monochrome layer; never replaces it.

| Token | Value | Role |
|---|---|---|
| `--warm-accent` | `var(--gold)` | Warm accent — maps to `--gold` |
| `--warm-accent-soft` | `var(--gold-soft)` | Soft warm background (progress badges, subtle warmth) |
| `--warm-accent-line` | `var(--gold-border)` | Warm borders (hover, active, selected) |

### Semantic colors

| Token | Value | Role |
|---|---|---|
| `--gold` | `#C89B55` | Cinematic gold — borders, active states, hover borders, ticket bubble |
| `--gold-light` | `#E0B87A` | Highlight edge / upper gradient stop |
| `--gold-dark` | `#8A6330` | Shadow edge / lower gradient stop |
| `--gold-soft` | `rgba(200,155,85,.14)` | Soft gold background (progress badges, subtle warmth) |
| `--gold-glow` | `rgba(200,155,85,.18)` | Gold glow (outside rings, achievement halos) |
| `--gold-border` | `rgba(200,155,85,.34)` | Gold borders (hover, active, selected) |
| `--ivory` | `#E8D8B8` | Warm light text — NOMINATION labels, achievement unlocked, soft labels, selected items |
| `--ivory-soft` | `rgba(232,216,184,.10)` | Soft ivory background |
| `--ivory-muted` | `rgba(232,216,184,.68)` | Muted ivory text |

### Projector Noir usage

- Warm density is organised by semantic groups, not a fixed percentage or a count of isolated accents.
- One focal film/session scene may keep restrained amber colour at rest.
- Active phase, selected navigation, progress, and the contextual action may form one connected warm route.
- Large statistics, ordinary cards, body copy, and unrelated controls stay monochrome.
- Avoid warm icon sets, gold-filled card grids, repeated glow, and simultaneous warm treatment of unrelated modules.
- Gold communicates state and direction; ivory is reserved for short warm labels inside that route.
| `--danger` | `#A94E4A` | Danger zone, kick, cancel, leave buttons |
| `--danger-hover` | `#B65A55` | Danger button hover fill |
| `--danger-border` | `rgba(169,78,74,.38)` | Danger zone card/button borders |
| `--danger-soft` | `rgba(169,78,74,.12)` | Danger zone backgrounds |
| `--danger-text` | `#D9A09B` | Danger zone heading text |
| `--success` | `#6F8A63` | Olive green — import/export success, completed states, "Copied!" |
| `--success-soft` | `rgba(111,138,99,.13)` | Soft success background |
| `--success-border` | `rgba(111,138,99,.34)` | Success borders |
| `--warn` | `#B9823A` | Aged amber — warning states, close to gold but distinct |
| `--warn-soft` | `rgba(185,130,58,.14)` | Soft warning background |
| `--warn-border` | `rgba(185,130,58,.34)` | Warning borders |

### Focus

For dark-UI accessibility — softer than a white browser outline, keeps the cinematic atmosphere.

| Token | Value | Role |
|---|---|---|
| `--focus` | `rgba(232,216,184,.72)` | Focus ring colour (ivory-toned) |
| `--focus-ring` | `0 0 0 3px rgba(232,216,184,.18)` | Focus ring shadow |

Usage:
```css
:focus-visible {
  outline: 1px solid var(--focus);
  box-shadow: var(--focus-ring);
}
```

### Background gradients

```
Page body: radial-gradient + linear-gradient(#0c0c0c, #090909)
Page body (Hub): one restrained amber projector wash behind the club header and Screening Call Sheet, fading to the neutral page before the overview modules
Film grain: fixed overlay, opacity 0.025, micro-noise pattern
```

---

## Typography

### Font stacks

| Token | Value | Role |
|---|---|---|
| `--font-display` | `'Iowan Old Style', 'Charter', Georgia, 'Times New Roman', serif` | Emotional hierarchy: page titles, club names, movie titles, large stats, empty states |
| `--font-body` | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` | Product UI: buttons, forms, tabs, settings, navigation, cards, body text |
| `--font-mono` | `ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace` | Metadata: dates, counters, ratings, badges, phase labels, frame counters, technical captions (*JetBrains Mono is optional*) |

### Typography rules

- **Display serif** is for emotional moments — not controls, dense cards, labels, navigation, or settings UI.
- **Body sans** is for product clarity — buttons, forms, tabs, menus, descriptions.
- **Mono** is for "film archive" metadata — sparingly. Never for body paragraphs, button labels, long menu items, or settings descriptions.
- **Avoid all-caps** except for short labels, pills, technical metadata, and phase states.
- **Long titles** should use serif but cap at 2–3 lines with balanced line-height.
- **Navigation and menu labels** stay sans-serif, title case, not uppercase.

### Type scale

#### Marketing / landing

| Token | Value | Use |
|---|---|---|
| `--fs-hero` | `clamp(44px, 6vw, 76px)` | Hero titles (landing, empty states) |
| `--fs-section` | `clamp(32px, 4vw, 48px)` | Section headings (landing) |

#### App UI

| Token | Value | Use |
|---|---|---|
| `--fs-app-title` | `clamp(32px, 9vw, 48px)` | Club/movie titles on mobile app screens |
| `--fs-app-section` | `24px` | Section headings inside app |
| `--fs-card-title` | `20px` | Cards, popovers, achievement names |
| `--fs-lead` | `19px` | Lead paragraphs |
| `--fs-body` | `16px` | Body text |
| `--fs-body-sm` | `14px` | Compact body |
| `--fs-meta` | `13px` | Captions, metadata |
| `--fs-caption` | `12px` | Compact labels |
| `--fs-micro` | `11px` | Footer labels, frame counters |
| `--fs-nav` | `12px` | Navigation labels |

### Line height

| Token | Value | Use |
|---|---|---|
| `--lh-tight` | `1.05` | Display titles, large stats |
| `--lh-title` | `1.12` | Card titles, section headings |
| `--lh-body` | `1.55` | Body copy, descriptions |
| `--lh-ui` | `1.3` | Buttons, pills, form elements |
| `--lh-caption` | `1.2` | Captions, metadata, nav labels |

### Letter spacing

| Token | Value | Use |
|---|---|---|
| `--tracking-tight` | `-0.025em` | Display titles |
| `--tracking-normal` | `0` | Body text |
| `--tracking-wide` | `0.06em` | Subtle spacing for UI labels |
| `--tracking-caps` | `0.12em` | ALL-CAPS labels (pills, badges, phase labels) |

### Numeric formatting

- **Large stats** (overview, library): `font-family: var(--font-display); font-variant-numeric: lining-nums;`
- **Compact UI numbers** (badges, counters, frame counts): `font-family: var(--font-mono); font-variant-numeric: tabular-nums;`
- **Rating values, timecodes, session counts**: `font-variant-numeric: tabular-nums;` for alignment

### Usage examples

```css
h1 {
  font-family: var(--font-display);
  font-size: var(--fs-app-title);
  line-height: var(--lh-tight);
  letter-spacing: var(--tracking-tight);
}

.card-title {
  font-size: var(--fs-card-title);
  line-height: var(--lh-title);
}

.body-copy {
  font-size: var(--fs-body);
  line-height: var(--lh-body);
}

.nav-label {
  font-size: var(--fs-micro);
  line-height: var(--lh-caption);
}

.eyebrow, .pill, .meta-caps {
  font-family: var(--font-mono);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
}

.stat-value-large {
  font-family: var(--font-display);
  font-variant-numeric: lining-nums;
}

.badge-count, .frame-counter {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.film-frame b {
  font-size: 12px;
  font-weight: 600;
}
```

---

## Spacing

| Token | Value | Equivalent |
|---|---|---|
| `--gap-xs` | `8px` | Micro gap |
| `--gap-sm` | `12px` | Small gap |
| `--gap-md` | `20px` | Default gap |
| `--gap-lg` | `32px` | Section gap |
| `--gap-xl` | `56px` | Large section gap |
| `--gap-2xl` | `96px` | Hero spacing |

---

## Layout

| Token | Value | Notes |
|---|---|---|
| `--container` | `1120px` | Max content width |
| `--gutter` | `24px` | Horizontal padding |
| `--radius` | `12px` | Default border radius |
| `--radius-lg` | `18px` | Large radius (cards, modals) |
| `--hit` | `44px` | Minimum touch target |

### Grid helpers
- `.grid-2` — 2 equal columns, collapses to 1 below the `L` breakpoint (`1024px`)
- `.grid-3` — 3 equal columns, collapses to 1 below the `L` breakpoint (`1024px`)
- `.row` — flex row, center-aligned
- `.row-between` — flex row, space-between

### Responsive contract

PickFlick is one fluid responsive web product with four canonical modes. Use these breakpoints for new implementation work and verify the visual system at the representative widths shown below:

| Mode | Breakpoint | Representative width | Required layout behavior |
|---|---:|---:|---|
| `S` | `< 576px` | `390px` | Compact mobile composition, stacked content, fixed mobile product navigation, and `44px` minimum touch targets |
| `M` | `≥ 768px` | `768px` | Tablet composition with broader content regions; mobile navigation remains acceptable where the desktop shell does not fit |
| `L` | `≥ 1024px` | `1024px` | Desktop header, sidebars, tabs, and primary multi-column layouts become canonical |
| `XL` | `≥ 1400px` | `1440px` | Full desktop composition with restrained max-width content and viewport-wide cinematic canvas effects |

The `576–767px` interval is a fluid bridge, not a fifth mode: retain the `S` composition and let spacing and type scale fluidly until `M` activates at `768px`.

The canonical visual reference is [`responsive-baselines.html`](responsive-baselines.html). Verify that every production route has no horizontal page scroll at `390`, `768`, `1024`, and `1440px`. Tables, poster rails, and other intentionally dense modules may scroll only inside a clearly bounded component.

#### Breakpoint discipline

- New layouts must use only `576`, `768`, `1024`, and `1400px` media-query boundaries.
- Prefer fluid `clamp()`, flexible grids, wrapping, and container-aware composition over adding one-off viewport breakpoints.
- Existing prototype-only thresholds are implementation drift, not part of the design contract; consolidate them when each screen is rebuilt for production.

#### Responsive implementation rules

- Mobile is recomposed, not scaled down: prioritize content and replace desktop navigation patterns with the mobile product shell.
- Use fluid `clamp()` sizing for display typography and canvas spacing between the four modes. Component-specific fixed values remain acceptable where they preserve stable controls or poster geometry.
- Keep core content inside `--container`. Full-bleed projector light, film grain, and controlled cinematic scenes may extend to the viewport.
- Preserve readable line length and input/action hierarchy at wide widths; do not stretch panels merely because space is available.
- The current prototypes use media queries. Container queries may be introduced during implementation for reusable self-contained modules, but must preserve the same visual thresholds and behavior.

---

## Components

### Buttons

Buttons are a shared component. Every standalone page copies this exact class contract; do not create page-local primary or secondary variants with inline colors.

**Base** (`.btn`): 44px minimum height, `11px 20px` padding, 16px body-sans label, medium weight, 8px content gap, centered contents.
**Primary** (`.btn-primary`): Used for the single main CTA or submit action in a region. Default: `var(--fg)` background, `var(--bg)` text. Hover: `var(--button-primary-hover)` background (`#ddd7d1`, ivory-toned neutral). Primary stays monochrome; do not replace it with gold by default.
**Secondary** (`.btn-secondary`): Transparent background with `var(--border)` outline. Hover changes only the border to `var(--fg)`. Used for supporting actions such as Manage Moderators, Invite, Change photo, Your Rating, Watchlist, and “See how it works”.
**Small** (`.btn-sm`): 36px minimum height, `6px 14px` padding, 13px label. Combine with either `.btn-primary` or `.btn-secondary`; never use `.btn-sm` alone with inline color styles.
**Focus**: all variants use a 2px gold outline with 3px offset on `:focus-visible`. This is an interaction state, not decorative warm styling.
**Disabled**: prefer the native `disabled` attribute. For links, use `aria-disabled="true"` only together with removal of navigation/click behavior; opacity, pointer behavior, and cursor come from the shared component.
**Ghost** (`.btn-ghost`): No border, subtle hover. Used for: Back to main.
**Icon** (`.btn-icon`): Square button, icon-only. Used for: gear, close.
**Secondary Danger** (`.btn-secondary-danger`): Transparent bg, danger-soft fill, danger-text label, danger-border. Hover → danger border intensifies, danger-soft bg deepens. Used for reversible or pre-confirmation destructive actions: Kick, Leave, Cancel Session, Cancel Subscription. Never uses solid-danger fill — keeps the action legible but not final.

**Primary Danger** (`.btn-danger`): Solid danger fill, white text, danger border. Used only inside the final confirmation step for irreversible actions: Delete Club, Delete Account, permanently remove data. On the outer page, the trigger button should use `.btn-secondary-danger`; the final confirm button inside the modal uses `.btn-danger`.

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 11px 20px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  font-family: var(--font-body);
  font-size: var(--fs-body);
  font-weight: 500;
  line-height: var(--lh-ui);
  letter-spacing: var(--tracking-tight);
  text-decoration: none;
  cursor: pointer;
  transition: transform .05s ease, color .15s ease,
              background-color .15s ease, border-color .15s ease;
}
.btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.btn:active { transform: translateY(1px); }
.btn-primary { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.btn-primary:hover { background: var(--button-primary-hover); border-color: var(--button-primary-hover); }
.btn-secondary { background: transparent; color: var(--fg); border-color: var(--border); }
.btn-secondary:hover { border-color: var(--fg); }
.btn-sm { min-height: 36px; padding: 6px 14px; font-size: var(--fs-meta); }
.btn[disabled],
.btn[aria-disabled="true"] { opacity: .42; pointer-events: none; cursor: not-allowed; }

/* Danger variants keep their separate red semantics. */
.btn-danger {
  color: #fff4f2;
  background: var(--danger);
  border-color: var(--danger);
}
.btn-danger:hover {
  background: var(--danger-hover);
}
```

### Cards
- `.card` — surface background, border, radius-lg
- Stats cards: display font, centered, muted label below
- Achievement cards: icon circle, status pill, title, description, progress bar + counter

### Rating Stars
- 10 stars, hover fills all stars up to hovered one
- Click locks selection, label shows "N/10"
- On mobile: horizontal scroll
- Pop animation (`@keyframes pipPop`) on click

### Pills & Chips
- `.pill` — rounded tag (phase: Nomination, Selection, Rating)
- `.rating-pill` — rating display (globe + score + label)
- `.ach-status` — achievement status (Unlocked, In progress, Not started)

### Ticket Bubble
- Fixed bottom-right, SVG concave ticket shape
- Default: dark monochrome fill; hover: warm-accent fill (`--gold-light` → `--gold` → `--gold-dark`)
- `--warm-accent-line` for the ticket border on hover
- Stub slides partially out of viewport, reveals on hover
- Popover opens on click with invite list

### Film-Strip Menus
- Used in: mobile footer nav groups, avatar popover, gear popover
- `.film-strip` — flat deep-black stock, thin neutral outline, clear ivory perforations, film-frame items with icons
- `.film-tail` — visually continuous deep-black tab with the same neutral outline
- Hover stays neutral graphite; no gold fill
- Active item uses ivory text plus one thin gold line; gold is not repeated on every item
- Open with a directional `clip-path` reveal and slight translate over `0.34s`; never scale the contents or distort icons

### Sprocket Separator
- `.sprocket-sm` — 3 dots + dashed lines, used between sections
- `.sprocket` — larger version for Session Details

### Modals
- Full-screen dark overlay
- Centered card with title, content, action buttons
- Gear popover → Next Phase / Change details / Kick / Cancel session

### Checkboxes
- Custom 20×20px, rounded, dark border
- Checked: white border, white checkmark, transparent bg
- Used in: Manage Club Settings, Kick participant modal

### Header
- Sticky topbar, backdrop blur
- Desktop: logo left, nav center, search + bell + avatar right
- Mobile: logo centered, search icon right-aligned with 16px gutter
- Avatar popover: film-strip with Settings → Privacy → Pricing → Contact Us → Sign out; App Admin adds `Admin Panel` as the first row

### Footer (Mobile)
- Fixed bottom, 4 buttons: Hub (clapperboard), My Library (film reel), Alerts (bell), Settings (gear)
- App Admin surfaces add a fifth `Admin` item beside Settings; it opens the same film-strip submenu pattern
- 63px height, backdrop blur
- Each opens film-strip menu
- "My Library" sub-menu: My Ratings, Watchlist, Achievements

### Global Search
- Search icon in header (desktop: next to bell, mobile: right edge)
- Panel slides down, covers header
- Centered input, search by film title
- 20-film database, real-time results

---

## Page-Specific Rules

### Hub (app.html)
- Club carousel, responsive Screening Call Sheet, tabs: Overview → Sessions → Ratings → Members → Achievements → Manage Club
- Switching club updates the complete Call Sheet: picture, sheet number, date, time, runtime, genre, phase, nomination metadata, attendance, and still
- Ticket bubble bottom-right
- Avatar chips in active sessions
- Tab content fade-in animation

### Session Detail page family
- `session-detail.html`, `session-detail-nomination.html`, `session-detail-selection.html`, `session-detail-watching.html`, and `session-detail-rating.html` are states of one page, not separate visual concepts.
- Shared components must be structurally and visually identical across all five states: header, `Back to Hub`, status banner, hero shell, action group, account/gear film-strip menus, genre chips, film information, section transition, Session Details rows, metric treatment, buttons, and responsive thresholds.
- Phase-specific differences are limited to content and workflow: nomination search, selection ranking, watching/live-chat state, rating form, and completed results.
- Status banner: transparent monochrome surface, neutral border, left info icon, and monospace text. Only the message changes by phase.
- Header: no center navigation; use the canonical compact secondary `Back to Hub` action. Gear matches the secondary Invite treatment; Leave uses the secondary-danger treatment.
- Film-strip menus use the same flat black stock, ivory perforations, graphite hover, thin gold active cue, and `clip-path` reveal as the account menu in `app.html`. Never distort their contents with `scaleY`.
- Film hero: poster (grayscale, hover → color + zoom when an image exists), trailer, credits, and synopsis share one grid and one flat surface treatment.
- Genre chips use a transparent fill with restrained ivory text/border.
- Session Details uses one row system and one metric system. Values may change (`9.2`, `3/5`, `4/5`, `—`); geometry and typography do not.
- The separator before Session Details uses one restrained monochrome reel-break composition. Phase mascots may differ, but share the same optical area, mask, and placement.

### Movie Details
- Poster + trailer + credits + synopsis
- Your Rating (stars, popover) + Global rating + Watchlist. Unsaved bookmark uses a subtle smoky-ivory fill and neutral outline; gold is reserved for the saved state
- "See also" links row + "You may also like" scroll carousel

### My Library
- Stats row: Films rated, Rated this year, Avg rating, Total watch time, Favorite genre, Top director, Top actor, On watchlist
- Tabs: My Ratings, Watchlist, Achievements
- Mascot panda behind stats
- Film grain overlay

### Landing
- Scene sections with reveal-on-scroll animation
- Sprocket separators
- 4-button footer

### Settings
- Left sidebar with link icons
- Smooth tab transitions
- Accordion in Privacy section
- Import & Export tab with CSV handling

---

## Motion & Animation

| Element | Animation |
|---|---|
| Tab content | `fadeIn` — opacity 0→1, 0.25s |
| Film-strip menus | Directional `clip-path` reveal + slight translate, 0.34s cubic-bezier; content remains undistorted |
| Ticket bubble | Stub slide 78px, 0.3s ease |
| Score pips / stars / toggles | `pipPop` — scale 0.85→1.05→1, 0.3s ease |
| Landing reveal | `revealSection` — translateY + opacity, 0.6s ease |
| Poster hover | Grayscale removal + scale(1.02), 0.3s ease |
| Call Sheet hover/focus | Document lines gain contrast first, then the still returns from grayscale to its original colour; no glow or container movement, 0.3–0.4s ease |
| Notifications badge | `pulse` — opacity pulse, 2s infinite |

### Interaction contract

This section defines intended production behavior. The HTML prototypes are visual references; implementation must also provide the keyboard, focus, dismissal, and reduced-motion behavior below.

| Pattern | Trigger and visual response | Keyboard / focus | Dismissal and state |
|---|---|---|---|
| Tabs | Activate the selected label, move the thin active line, and fade the corresponding panel over `0.25s` | `Tab` reaches the tablist; arrow keys move between tabs; `Enter` / `Space` activates; focus remains on the selected tab | One panel is active at a time; selection must be exposed through `aria-selected` |
| Film-strip menu | Click/tap opens a directional `clip-path` + slight translate reveal over `0.34s`; icons and labels never scale or distort | Trigger uses `aria-expanded`; opening focuses the first actionable row; closing returns focus to the trigger | Close on outside click, `Escape`, route selection, or opening a mutually exclusive popover |
| Header search | Search control replaces/overlays the header search area and focuses the input; results update while typing | `Escape` closes; arrow keys move through results; `Enter` opens the active result; closing returns focus to the search trigger | Clear transient query/result state when the panel fully closes unless the user navigated to a result |
| Notification popover | Bell toggles the shared notification list without moving surrounding chrome | Use the same popover focus/dismissal contract as film-strip menus | Only one header popover may be open at a time |
| Modal / confirmation | Overlay fades in; the modal stays stationary and becomes the sole interaction context | Move focus to the title or first control; trap focus; `Escape` closes non-blocking dialogs; closing returns focus to the opener | Destructive actions require a separate final `.btn-danger`; Admin suspend/delete/transfer requires exact-name confirmation |
| Accordion | Header toggles the adjacent answer/body without introducing a nested card or decorative glow | Header is a real button; `Enter` / `Space` toggles; focus remains on the header | Preserve each item’s `aria-expanded`; Privacy may keep multiple items open unless the flow explicitly requires one-at-a-time behavior |
| Rating control | Pointer hover previews all values up to the target; click locks the value and plays `pipPop` | Arrow keys adjust the value; `Home` / `End` jump to limits; the current value is announced | Submitted state replaces the form in place and must not create a new heavy card or layout jump |
| Toggle / checkbox | State changes immediately with a compact `pipPop`; warm color is not required for ordinary settings | `Space` toggles; expose the state with native input semantics or the corresponding ARIA role | Disabled controls remain legibly distinct and cannot receive interaction |
| Screening Call Sheet | Switching club updates the complete sheet as one state. Hover/focus first raises line contrast, then restores the still’s original color | The Call Sheet or linked picture must be reachable by keyboard if it performs navigation | `Create new club` hides the sheet rather than retaining the previous club’s data |
| Form submit / success | Submit action shows loading without changing its dimensions; success appears inside the existing submit zone | Announce pending/error/success changes through an appropriate live region; move focus only when an error summary requires it | Preserve form geometry to avoid layout shift; keep user input on recoverable errors |

### Motion timing and restraint

- `0.12–0.18s` — local color, border, and hover feedback.
- `0.25s` — tab/panel content changes.
- `0.30s` — score pip, ticket stub, and poster color transitions.
- `0.34s cubic-bezier(.22,.8,.3,1)` — film-strip popovers and mobile submenus.
- `0.60s` — landing/editorial section reveal only.
- Do not animate layout dimensions when opacity, color, clip, or a short translate can communicate the change.
- Do not use scale reveals on menus, icons, text, or film perforations.
- Only one ambient loop may attract attention in a scene (for example the Watching live dot). Avoid simultaneous pulsing badges, glows, and progress loops.

### Reduced motion

Every page must implement `@media (prefers-reduced-motion: reduce)`:

- Remove decorative translate, scale, poster zoom, pulsing size, and continuous reveal animation.
- Keep state changes immediate or use a near-instant opacity change (`0.01ms` is acceptable in the prototypes).
- Preserve color, border, selected, loading, and focus states so motion is never the only signal.
- Programmatic scrolling must use immediate behavior when reduced motion is active.

---

## CSS Variables — canonical `:root`

This is the single source of truth. Every page should import these tokens.

```css
:root {
  /* ============================================================ */
  /*  Core (dark theme)                                           */
  /* ============================================================ */
  --bg: #0c0c0c;
  --surface: #161616;
  --surface-lit: #1e1e1e;
  --fg: #eee9e5;
  --muted: #7d7a76;
  --fg-secondary: #a6a19c;
  --border: #2d2a27;
  --border-lit: #403c38;

  --button-primary-hover: #ddd7d1;

  /* ============================================================ */
  /*  Monochrome accent (neutral greys, structural UI)            */
  /* ============================================================ */
  --accent: #eee9e5;
  --accent-dim: #706a64;
  --accent-glow: rgba(238, 233, 229, 0.08);
  --accent-soft: rgba(238, 233, 229, 0.06);

  /* ============================================================ */
  /*  Warm accent (cinematic layer — gold + ivory)                */
  /* ============================================================ */
  --gold: #C89B55;
  --gold-light: #E0B87A;
  --gold-dark: #8A6330;
  --gold-soft: rgba(200, 155, 85, 0.14);
  --gold-glow: rgba(200, 155, 85, 0.18);
  --gold-border: rgba(200, 155, 85, 0.34);

  --ivory: #E8D8B8;
  --ivory-soft: rgba(232, 216, 184, 0.10);
  --ivory-muted: rgba(232, 216, 184, 0.68);

  --warm-accent: var(--gold);
  --warm-accent-soft: var(--gold-soft);
  --warm-accent-line: var(--gold-border);

  /* ============================================================ */
  /*  Semantic — danger / success / warn                          */
  /* ============================================================ */
  --danger: #A94E4A;
  --danger-hover: #B65A55;
  --danger-border: rgba(169, 78, 74, 0.38);
  --danger-soft: rgba(169, 78, 74, 0.12);
  --danger-text: #D9A09B;

  --success: #6F8A63;
  --success-soft: rgba(111, 138, 99, 0.13);
  --success-border: rgba(111, 138, 99, 0.34);

  --warn: #B9823A;
  --warn-soft: rgba(185, 130, 58, 0.14);
  --warn-border: rgba(185, 130, 58, 0.34);

  /* ============================================================ */
  /*  Focus (accessibility)                                       */
  /* ============================================================ */
  --focus: rgba(232, 216, 184, 0.72);
  --focus-ring: 0 0 0 3px rgba(232, 216, 184, 0.18);

  /* ============================================================ */
  /*  Fonts                                                       */
  /* ============================================================ */
  --font-display: 'Iowan Old Style', 'Charter', Georgia, 'Times New Roman', serif;
  --font-body: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: ui-monospace, 'JetBrains Mono', 'SF Mono',
    Menlo, Consolas, 'Liberation Mono', monospace;
  /* JetBrains Mono is optional; system monospace fallback is acceptable. */

  /* ============================================================ */
  /*  Type scale — marketing / landing                            */
  /* ============================================================ */
  --fs-hero: clamp(44px, 6vw, 76px);
  --fs-section: clamp(32px, 4vw, 48px);

  /* ============================================================ */
  /*  Type scale — app UI                                         */
  /* ============================================================ */
  --fs-app-title: clamp(32px, 9vw, 48px);
  --fs-app-section: 24px;
  --fs-card-title: 20px;
  --fs-lead: 19px;
  --fs-body: 16px;
  --fs-body-sm: 14px;
  --fs-meta: 13px;
  --fs-caption: 12px;
  --fs-micro: 11px;
  --fs-nav: 12px;

  /* ============================================================ */
  /*  Line height                                                 */
  /* ============================================================ */
  --lh-tight: 1.05;
  --lh-title: 1.12;
  --lh-body: 1.55;
  --lh-ui: 1.3;
  --lh-caption: 1.2;

  /* ============================================================ */
  /*  Letter spacing                                              */
  /* ============================================================ */
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.06em;
  --tracking-caps: 0.12em;

  /* ============================================================ */
  /*  Spacing                                                     */
  /* ============================================================ */
  --gap-xs: 8px;
  --gap-sm: 12px;
  --gap-md: 20px;
  --gap-lg: 32px;
  --gap-xl: 56px;
  --gap-2xl: 96px;

  /* ============================================================ */
  /*  Layout                                                      */
  /* ============================================================ */
  --container: 1120px;
  --gutter: 24px;
  --radius: 12px;
  --radius-lg: 18px;
  --hit: 44px;
}
```

---

## Image Assets

The canonical visual inventory is [`asset-catalog.html`](asset-catalog.html); its machine-readable source is [`asset-manifest.json`](asset-manifest.json). The final package contains only assets referenced by its canonical HTML surfaces. The catalog owns filenames, dimensions, current consumers, proposed semantic names, fixture status, and duplicate candidates. Do not duplicate the full manifest here.

### Asset classes

| Class | Contract |
|---|---|
| Production | Brand and mascot artwork referenced by current root screens. Preserve the supplied SVG/raster character and transparent optical bounds |
| Fixture | Movie posters/stills used to demonstrate product behavior. These do not define production licensing or provider ownership |
| Reference | Historical captures and visual research are excluded from the final package and must never ship in the application bundle |
| Duplicate candidate | Byte-identical file. Consolidate references during implementation only after every current consumer has been verified |

### Key production assets

| Current file | Role |
|---|---|
| `mquu6sau-panda-logo.webp` | Header/logo panda |
| `mqveizyr-panda-hero.webp` | Landing hero mascot |
| `mr7eoope-panda-session.webp` | Create-session / setup mascot |
| `mr2147pl-panda-rating.webp` | Watching and Rating phase mascot |
| `mr213zta-panda-collection.webp` | Nomination phase mascot |
| `mr213zt9-panda-rating-2.webp` | Selection phase mascot |
| `mqva38c9-panda-404.webp` | Error-state mascot |
| `mqutuz0p-panda-critic.webp` | Contact and supporting product mascot |

### Image treatment

- Preserve user-supplied mascot artwork. CSS may adjust grayscale, brightness, scale, or optical bounds; it must not replace the subject or redraw the character.
- Movie posters use `object-fit: cover` with a deliberate focal position. Grayscale-at-rest → original-color-on-hover is a component behavior, not a destructive asset edit.
- Reference captures are intentionally absent from this final package and must not be imported into production source bundles.
- Fixture posters currently reused under multiple movie titles are flagged in `asset-manifest.json` and must be replaced with distinct provider fixtures before implementation.

## Nomination suggestions

The compact suggestions carousel beside Nomination search reuses the current user's own
nominations from earlier Sessions in the current Club with a resolved winner, where that Movie
was not selected. Suggestions come from Nomination history. Selecting a card uses the normal
nomination flow and its one-nomination-per-participant rule. There is no separate saved-film
entity or manual add/remove UI. Fixture cards illustrate the layout, not eligible history.
