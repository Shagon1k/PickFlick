# PickFlick — Design Reference

> Current UI/UX direction, source authority, screen behavior, and design QA contract.
> Exact approved visual values are implemented in `packages/ui/styles/tokens.css`; the self-contained
> canonical design package remains their visual and interaction source.

| Document owner | Last reviewed |
| --- | --- |
| Product owner | 2026-07-22 |

## 1. Design Contract & Sources

- **This document owns:** experience direction, visual foundations, interaction patterns, screen behavior, source status, and design QA.
- **Roadmap owns:** product scope, routes, business rules, delivery phases, backlog, and unresolved product decisions.
- **Architecture owns:** system boundaries, data, APIs, authorization, infrastructure, and operational contracts.
- **Canonical design sources own:** exact approved tokens, responsive compositions, component appearance, and the latest inspectable visual state.
- **Production code owns:** implemented tokens/components, while remaining traceable to the source package.

When sources conflict:

1. Later explicit developer decisions override every artifact.
2. The canonical design package overrides the retired roadmap for product behavior and visual intent.
3. This document records clarifications where prototype fixture content is not a product requirement.
4. Product scope and technical topology do not come from incidental HTML implementation details.

### Design sources

| Source | Location | Authoritative for | Limitations / notes |
| --- | --- | --- | --- |
| Package index | [_docs/design/prototypes/index.html](_docs/design/prototypes/index.html) | Canonical package navigation and surface inventory. | Static prototype, not production routing or code. |
| Design system reference | [_docs/design/prototypes/design-system.html](_docs/design/prototypes/design-system.html) | Visual foundations, component states, navigation, forms, feedback, and responsive patterns. | Demonstrates representative content. |
| Exact design contract | [_docs/design/prototypes/DESIGN.md](_docs/design/prototypes/DESIGN.md) | Exact tokens, component rules, motion, accessibility, and interaction behavior. | Canonical until production tokens/components are approved. |
| UX flow map | [_docs/design/prototypes/ux-flow-map.html](_docs/design/prototypes/ux-flow-map.html) | Cross-screen journeys, roles, branches, and handoff gaps. | Roadmap resolves permissions and edge behavior previously marked future. |
| Responsive baselines | [_docs/design/prototypes/responsive-baselines.html](_docs/design/prototypes/responsive-baselines.html) | S/M/L/XL composition contract and representative viewport behavior. | Representative widths, not the only tested widths. |
| Asset catalog | [_docs/design/prototypes/asset-catalog.html](_docs/design/prototypes/asset-catalog.html) | Prototype asset usage and duplicate/fixture awareness. | Film images are fixtures and may not be licensed production assets. |
| Asset manifest | [_docs/design/prototypes/asset-manifest.json](_docs/design/prototypes/asset-manifest.json) | Prototype consumer-to-file mapping. | Prototype names differ from production-ready semantic names. |
| Brand specification | [_docs/design/prototypes/brand-spec.md](_docs/design/prototypes/brand-spec.md) | Brand intent and mascot usage. | Roadmap/product clarifications still apply. |
| Package handoff | [_docs/design/prototypes/FINAL-PACKAGE.md](_docs/design/prototypes/FINAL-PACKAGE.md) | Package structure and canonical/superseded-file status. | Historical roadmap was intentionally not retained. |
| Production-ready brand assets | [assets/brand/README.md](assets/brand/README.md) | Reusable mascot/logo image inventory and semantic filenames. | Embedded text in `panda-invited-2.webp` limits localization reuse. |

### Status legend

| Dimension | Values | Meaning of completion |
| --- | --- | --- |
| Design | `None` / `Draft` / `Approved` | `Approved` means the product owner accepted the visual/behavior direction. |
| Build | `Not started` / `Partial` / `Done` | `Done` means the documented contract is implemented. |
| QA | `Not checked` / `Passed` / `Issues` | `Passed` requires recorded comparison and applicable baseline evidence. |

The design package is **detailed and approved as direction**. Phase 2 tokens, semantic brand assets,
primitives, and shared responsive shells are built. Feature-owned product screens remain **not
started**. Prototype quality is not production QA.

## 2. Experience Direction

- **Primary users:** Friends coordinating recurring movie nights, people building personal film memory, Club Admins/Moderators running Sessions, and App Admins operating the service.
- **Core experience:** The current Club, screening, phase, participation progress, next action, and lasting result should always feel connected.
- **Visual character:** Editorial, cinematic, nocturnal, premium but friendly; high-contrast monochrome structure with restrained warmth and expressive panda illustrations.
- **Content voice:** Short, human, lightly theatrical, and film-aware. Privacy, billing, errors, permissions, and destructive actions are direct rather than playful.
- **UX non-goals:** Generic SaaS-dashboard styling, gold on every primary action, dense admin chrome in member flows, hover-only behavior, anonymous participation, and desktop layouts merely squeezed onto mobile.

### Design principles

| Principle | Practical consequence |
| --- | --- |
| One screening story | Nomination, Selection, Watching, Rating, and Completed are states of one Session detail experience, not unrelated pages. |
| Context before action | Every mutation shows the active Club/Session, role, current phase, effect, and recovery path. |
| Noir structure, warm meaning | Monochrome carries layout and primary hierarchy; ivory/gold mark ratings, achievements, selection, invitations, and connected focal moments. |
| Mobile is recomposed | Navigation, tables, controls, and information hierarchy adapt for touch; horizontal page scrolling is never the fallback. |
| Progress without pressure | Participation counts are clear, but incomplete Rating never blocks the next Session and Admin/Moderator may close it. |
| Permission boundaries are visible and enforced | Unavailable actions are hidden, disabled with explanation, or replaced by a safe state; the server remains the real boundary. |
| Reuse the cinematic language | Film strips, call sheets, sprockets, status banners, and mascot scenes recur consistently instead of being recreated ad hoc. |

## 3. Foundations

Production values live in [`packages/ui/styles/tokens.css`](packages/ui/styles/tokens.css) and remain
traceable to the [canonical design contract](_docs/design/prototypes/DESIGN.md). Do not copy partial
token sets into feature files.

| Area | Intent / usage contract | Canonical source | Design | Build | QA |
| --- | --- | --- | --- | --- | --- |
| Color and themes | Dark-only MVP; `#0c0c0c` family for structure, neutral text/borders, ivory and connected gold `#C89B55` for warm semantic emphasis. | [DESIGN.md foundations](_docs/design/prototypes/DESIGN.md#1-foundations) | Approved | Done | Not checked |
| Typography | Iowan/Charter/Georgia-style editorial display, system sans for readable product copy, mono for metadata/status. | [DESIGN.md typography](_docs/design/prototypes/DESIGN.md#2-typography) | Approved | Done | Not checked |
| Spacing and layout | Shared scale, content containers, gutters, sectional rhythm, flat hierarchy, and deliberate negative space. | [DESIGN.md layout](_docs/design/prototypes/DESIGN.md#3-spacing--layout) | Approved | Done | Not checked |
| Breakpoints and responsive behavior | Four named modes: S below 576, M from 768, L from 1024, XL from 1400; test the gaps between named pivots too. | [Responsive baseline](_docs/design/prototypes/responsive-baselines.html) | Approved | Partial | Component and all seven shell previews automated; feature screens pending |
| Radii, borders, and elevation | Restrained radii and low-contrast borders; elevation belongs to overlays, tickets, and focused cinematic scenes. | [Design system](_docs/design/prototypes/design-system.html) | Approved | Done | Not checked |
| Iconography | Fine-line, consistent stroke treatment with accessible names on actions; decorative sprockets/film glyphs remain non-semantic. | [DESIGN.md components](_docs/design/prototypes/DESIGN.md#4-components) | Approved | Not started | Not checked |
| Imagery and illustration | Transparent noir panda assets provide emotional/scene cues; film-provider imagery is data, not brand chrome. | [Brand assets](assets/brand/README.md) | Approved | Done | Not checked |
| Motion | Short feedback and reveal motion; no layout-jolting decoration; honor reduced motion and preserve focus. | [DESIGN.md interaction contract](_docs/design/prototypes/DESIGN.md#5-interaction-contract) | Approved | Done | Component preview automated; owner review pending |

### Experience baselines

| Area | Project contract | Canonical source |
| --- | --- | --- |
| Accessibility | Semantic controls, visible focus, keyboard-operable tabs/menus/dialogs/ratings, focus trap/return, live regions, contrast review, 44px touch targets, reduced-motion support. | [DESIGN.md interaction contract](_docs/design/prototypes/DESIGN.md#5-interaction-contract) |
| Localization | English MVP; externalize user-facing copy, use locale-aware dates/numbers/currency, tolerate expansion, and do not bake text into new images. | [Roadmap localization baseline](ROADMAP.md#4-baseline-web-app-considerations) |
| Content overflow | Prefer wrapping; truncate only where full content remains accessible; tables use local scroll containers rather than page overflow; user/provider text must be tested long. | [Responsive baseline](_docs/design/prototypes/responsive-baselines.html) |
| Input and device support | Mouse, keyboard, and touch are first-class; hover is enhancement only; the initial matrix is established in Phase 2 and finalized for PWA/UAT in Phases 22–24. | [Design system](_docs/design/prototypes/design-system.html) |

## 4. Experience Structure

### App shells and navigation

| Context | Shell / navigation | Responsive behavior | Source |
| --- | --- | --- | --- |
| Public marketing | Brand header, page links, sign-in/get-started actions, cinematic sectional landing/pricing/contact content. | Condensed header/menu; scenes stack; CTAs stay reachable. | [Landing](_docs/design/prototypes/landing.html) and [Pricing](_docs/design/prototypes/pricing.html) |
| Auth/setup scene | Focused cinematic scene, minimal escape navigation, single task card/form. | Artwork and form reorder/scale without hiding essential context. | [Login](_docs/design/prototypes/login.html), [Invite](_docs/design/prototypes/invite.html), [Create Club](_docs/design/prototypes/create-group.html) |
| Authenticated product | Global search, notifications, avatar menu, Club switcher, Call Sheet/feature context, product tabs. | Fixed bottom navigation with film-strip submenus and mobile notification/search surfaces. | [Club Hub](_docs/design/prototypes/app.html) |
| Session detail | Back to Hub, phase/status banner, hero metadata/actions, phase content, shared account shell. | Preserve primary phase action and participant progress above secondary detail. | [Session family](_docs/design/prototypes/session-detail-nomination.html) |
| Personal settings/library | Authenticated global shell plus local tabs/sidebar, tables/cards, stable feedback regions. | Sidebar becomes mobile menu; tables scroll inside bounded regions. | [Library](_docs/design/prototypes/library.html), [Settings](_docs/design/prototypes/settings.html) |
| App administration | Protected admin sidebar, overview panels, searchable tables, operational settings, typed confirmations. | Admin views remain task-complete through mobile admin menu and bounded tables. | [Admin Panel](_docs/design/prototypes/admin-panel.html) |

The reusable shells live under `apps/web/src/components/shells`. `/shell-preview` exposes public,
setup, product, Session, Settings, Library, and App Admin compositions without feature data. The
shells default to canonical product routes; the preview supplies its own route map.

### Key user flows

```text
Landing -> Google/Apple sign in -> No Clubs -> Create Club -> Club Hub
Club invite -> Sign in if needed -> Accept -> Club Hub
```

```text
Club Hub -> Create Session -> Nomination -> Selection -> Watching -> Rating -> Completed
                                  |            |                         |
                                  + auto close + auto close              + auto/manual close
```

```text
Club Hub -> Log Past Session -> Attendees + optional historical data -> Completed
Global Search -> Movie Details -> Personal Rating or Watchlist -> My Library
Pricing/Settings -> Paddle Checkout -> Success/failure return -> Subscription state
```

The [UX flow map](_docs/design/prototypes/ux-flow-map.html) is the visual source. Product edge rules live in [ROADMAP.md](ROADMAP.md#5-business-product--monetization-rules).

## 5. Screens & States

### Screen coverage

All canonical screens are MVP. Their design direction is approved; implementation and QA status are
recorded per surface.

| Route / view | Purpose | Primary design source | Design | Build | QA |
| --- | --- | --- | --- | --- | --- |
| `/` | Explain the ritual and move visitors toward registration. | [landing.html](_docs/design/prototypes/landing.html) | Approved | Done | Passed locally |
| `/pricing` | Compare Free/Pro and enter checkout. | [pricing.html](_docs/design/prototypes/pricing.html) | Approved with clarifications | Done; checkout disabled until billing | Passed locally |
| `/contact` | Send a concise message with stable validation/success feedback. | [contact.html](_docs/design/prototypes/contact.html) | Approved | Not started | Not checked |
| `/login` | Register/sign in with Google or Apple and continue intent. | [login.html](_docs/design/prototypes/login.html) | Approved | Not started | Not checked |
| `/invite/club/[token]` | Preview and accept/decline a Club invitation; handle expiry/auth. | [invite.html](_docs/design/prototypes/invite.html) | Approved | Not started | Not checked |
| `/invite/session/[token]` | Accept a member-only Session invitation or show privacy-safe denial. | [Club Hub invite ticket](_docs/design/prototypes/app.html) plus written clarification | Approved with clarification | Not started | Not checked |
| `/app` with no Clubs | Orient a registered user and create/join the first Club. | [app-no-clubs.html](_docs/design/prototypes/app-no-clubs.html) | Approved | Not started | Not checked |
| `/clubs/new` | Create a Club and choose its Selection score scale. | [create-group.html](_docs/design/prototypes/create-group.html) | Approved with configurable-scale clarification | Not started | Not checked |
| `/clubs/[clubId]` | Operate and understand one Club across six Hub views. | [app.html](_docs/design/prototypes/app.html) | Approved with concurrency clarification | Not started | Not checked |
| `/clubs/[clubId]/sessions/new` | Create full-cycle or pre-selected Session and invite members. | [create-session.html](_docs/design/prototypes/create-session.html) | Approved | Not started | Not checked |
| `/clubs/[clubId]/sessions/past/new` | Record a past screening with partial historical evidence. | [create-past-session.html](_docs/design/prototypes/create-past-session.html) | Approved | Not started | Not checked |
| `/sessions/[sessionId]` — Nomination | Search/choose one film, see allowed nominations, follow progress. | [session-detail-nomination.html](_docs/design/prototypes/session-detail-nomination.html) | Approved | Not started | Not checked |
| `/sessions/[sessionId]` — Selection | Score every nomination, submit once, follow progress. | [session-detail-selection.html](_docs/design/prototypes/session-detail-selection.html) | Approved with copy clarification | Not started | Not checked |
| `/sessions/[sessionId]` — Watching | Focus on the selected film/screening and let an operator open Rating. | [session-detail-watching.html](_docs/design/prototypes/session-detail-watching.html) | Approved | Not started | Not checked |
| `/sessions/[sessionId]` — Rating | Submit 1–10 plus optional comment; show permitted results/rivals. | [session-detail-rating.html](_docs/design/prototypes/session-detail-rating.html) | Approved | Not started | Not checked |
| `/sessions/[sessionId]` — Completed | Preserve the screening, ratings, rivals, attendees, and notes. | [session-detail.html](_docs/design/prototypes/session-detail.html) | Approved | Not started | Not checked |
| `/library` | Search personal Ratings/Watchlist and understand personal statistics/achievements. | [library.html](_docs/design/prototypes/library.html) | Approved | Not started | Not checked |
| `/movies/[tmdbId]` | Inspect a film, edit Personal Rating/Watchlist, and discover related films. | [movie-details.html](_docs/design/prototypes/movie-details.html) | Approved | Not started | Not checked |
| `/settings` | Control profile, notifications, subscription, privacy, and import/export. | [settings.html](_docs/design/prototypes/settings.html) | Approved with policy clarification | Not started | Not checked |
| `/admin` | Operate PickFlick users, Clubs, metrics, and service settings. | [admin-panel.html](_docs/design/prototypes/admin-panel.html) | Approved with role/billing fixture clarification | Not started | Not checked |
| `not-found` / `error` | Recover from missing routes and application failure. | [error.html](_docs/design/prototypes/error.html) | Approved | Not started | Not checked |

### Source clarifications that implementation must preserve

| Prototype evidence | Canonical interpretation |
| --- | --- |
| Club Hub shows Nomination, Selection, and Rating rows together under “Active Sessions.” | These are examples of possible row states. A Club has only one concurrent Nomination/Selection/Watching Session; unlimited Rating Sessions may remain open. |
| Manage Club shows one Active Session and multiple Active Ratings. | This reflects the actual concurrency rule and is the preferred management composition. |
| Pricing says Pro has unlimited nomination rounds. | Superseded. Free and Pro both have one blocking Session per Club. Pro value comes from Club/member limits, configurable result visibility, grace period, and extended analytics. |
| Selection copy says “rank” and one summary says three films while five scored rows appear. | Users score every nomination on the Club-configured inclusive range; this is not ordinal drag ranking. |
| Prototype score buttons use 0–3. | The control is generated from the Club’s `0..N` or `1..N` setting, where the upper bound is at most 10. |
| Session invite appears beside Club invite. | A Session invite is valid only for an already registered Club member; non-members see no Session details and are told to join the Club first. |
| Admin table includes a Support role. | Fixture only. App roles are User and App Admin. Club roles are separate. |
| Admin subscription mix includes annual Pro. | Fixture only. MVP sells monthly Pro at €5. |
| Settings deletion copy says all Club/Session history is removed. | Superseded. Shared history is preserved with anonymized attribution; remaining members are notified if a Club becomes adminless. |
| Settings makes fixed deletion/cookie/legal claims. | Visual structure is approved; final policy copy must match implemented behavior and legal/privacy review. |
| Settings language field mentions Russian coming later. | English is MVP; localization-ready structure is required, Russian is post-MVP. |
| [`settings-subscription.html`](_docs/design/prototypes/settings-subscription.html) exists. | Superseded reference study only; canonical subscription UI is the Subscription panel in `settings.html`. |

### Cross-screen state contract

Every production data surface implements applicable states rather than shipping only the populated prototype:

| State | Expected UI and recovery |
| --- | --- |
| Loading | Stable layout, local skeleton/progress, descriptive status for assistive technology, and no duplicate mutation. |
| Empty | Explain why the area is empty and offer the next useful authorized action. |
| Validation | Field-adjacent message, summary/focus when useful, preserved input, and no color-only meaning. |
| Provider/network error | Plain cause when known, safe retry, preserved non-sensitive input, and alternate navigation. |
| Unauthorized | Reveal no protected Club/Session data; explain membership/role requirement without leaking details. |
| Read-only entitlement | Preserve visible history, explain the exceeded limit/downgrade state, and link the Admin to recovery. |
| Offline | Keep safe cached/read-only context if available; disable network mutations with a clear reconnect instruction. |
| Success | Stable inline confirmation or toast with the resulting state; move focus only when context changed. |
| Destructive confirmation | Name the target and consequence; typed-name confirmation for high-impact App Admin actions; restore focus on cancel. |

## 6. Components & Patterns

### Component inventory

| Component | Purpose | Variants / states | Design source | Design | Build | QA |
| --- | --- | --- | --- | --- | --- | --- |
| Public/App header | Brand, global entry/navigation, search, notifications, account. | Public, authenticated, admin; desktop/mobile. | [Design system](_docs/design/prototypes/design-system.html) | Approved | Done | Shell automation passed; owner review pending |
| Film-strip menu / mobile bar | Compact cinematic secondary navigation. | Hub, Library, Settings, Admin; open/closed/active. | [DESIGN.md](_docs/design/prototypes/DESIGN.md) | Approved | Done | Shell automation passed; owner review pending |
| Club switcher / Call Sheet | Preserve Club and current-screening context. | Multiple Clubs, no Session, each phase, image/no image. | [Club Hub](_docs/design/prototypes/app.html) | Approved | Not started | Not checked |
| Tabs / vertical tabs | Switch local views without losing shell context. | Horizontal/vertical/mobile menu; active/focus/disabled. | [Design system](_docs/design/prototypes/design-system.html) | Approved | Partial | Not checked |
| Buttons | Primary, secondary, danger, secondary-danger, icon. | Default/hover/focus/pressed/loading/disabled/success. | [DESIGN.md](_docs/design/prototypes/DESIGN.md) | Approved | Done | Not checked |
| Form controls | Text, textarea, select, date/time, toggle, file, segmented mode. | Empty/filled/focus/error/disabled/read-only/help/success. | [Design system](_docs/design/prototypes/design-system.html) | Approved | Partial | Not checked |
| Movie search result/card | TMDB discovery and selection. | Loading/results/empty/error/selected/removed. | [Create Session](_docs/design/prototypes/create-session.html) | Approved | Not started | Not checked |
| Score selector | Score every nomination on configured scale. | Generated range, incomplete, submitted/locked, keyboard/touch. | [Selection](_docs/design/prototypes/session-detail-selection.html) | Approved | Done | Not checked |
| Rating control | Submit/edit 1–10 personal or Session score. | Empty/hover/focus/selected/submitted/locked. | [Rating](_docs/design/prototypes/session-detail-rating.html) | Approved | Done | Not checked |
| Progress film strip | Show `N/N` phase participation. | Compact/full, determinate, complete. | [Club Hub](_docs/design/prototypes/app.html) | Approved | Done | Not checked |
| Status banner / phase stamp | Make lifecycle and recovery explicit. | Nomination/Selection/Watching/Rating/Completed/error/read-only. | [Session family](_docs/design/prototypes/session-detail-nomination.html) | Approved | Done | Not checked |
| Invite ticket/popover | Review Club/Session invitations. | Multiple/empty/accept/decline/expired/forbidden. | [Club Hub](_docs/design/prototypes/app.html) | Approved | Not started | Not checked |
| Notification popover | Review recent in-app events. | Read/unread/empty/loading/error/mobile. | [Settings](_docs/design/prototypes/settings.html) | Approved | Partial | Shell overlay behavior passed; feature states pending |
| Dialog / confirmation | Phase moves, edits, participant removal, cancellation, destructive admin actions. | Standard/destructive/typed-name/loading/error. | [Design system](_docs/design/prototypes/design-system.html) | Approved | Partial | Not checked |
| Stat / leaderboard / table | Summaries, histories, rankings, usage, admin lists. | Populated/empty/sorted/filtered/loading/read-only/mobile scroll. | [Club Hub](_docs/design/prototypes/app.html) | Approved | Partial | Not checked |
| Achievement card/filter | Show earned/progress/locked personal or Club goals. | Unlocked/in progress/not started/filtered. | [Library](_docs/design/prototypes/library.html) | Approved | Not started | Not checked |
| Privacy accordion | Explain data behavior and expose rights actions. | Open/closed/focus/loading/action error. | [Settings](_docs/design/prototypes/settings.html) | Approved | Not started | Not checked |

### Interaction patterns

| Pattern | Contract / expected behavior | Canonical source | Status |
| --- | --- | --- | --- |
| Forms and validation | Validate at sensible blur/submit boundaries; preserve values; focus the first actionable error; use stable help/error regions. | [DESIGN.md](_docs/design/prototypes/DESIGN.md) | Approved |
| Loading and progress | Prefer local feedback and stable geometry; lock repeated submissions; announce long-running transitions/exports. | [Design system](_docs/design/prototypes/design-system.html) | Approved |
| Empty and error states | Specific, calm, and recoverable; always offer an authorized next action or safe navigation. | [error.html](_docs/design/prototypes/error.html) | Approved |
| Notifications and feedback | In-app inbox is durable; toast/inline messages confirm local actions; email follows user preferences and critical-policy exceptions. | [settings.html](_docs/design/prototypes/settings.html) | Approved |
| Dialogs and overlays | One header popover at a time; focus enters/traps/returns; Escape dismisses non-blocking dialogs; outside click follows component semantics. | [DESIGN.md](_docs/design/prototypes/DESIGN.md) | Approved |
| Destructive actions | Separate danger action, name exact effect and irreversibility, typed target for sensitive App Admin mutations. | [admin-panel.html](_docs/design/prototypes/admin-panel.html) | Approved |
| Permissions and unavailable actions | Do not expose protected data; hide irrelevant actions, disable with explanation when educational, and use explicit read-only states for entitlements. | [Roadmap access rules](ROADMAP.md#identity-and-access) | Approved |

## 7. Design Decision Log

| ID | Area | Decision / question | Status | Rationale or next trigger | Source |
| --- | --- | --- | --- | --- | --- |
| DES-001 | Authority | Canonical design pages take priority over the retired roadmap; later explicit developer decisions take priority over both. | Decided | Preserves the most mature month-long UX work without treating fixtures as policy. | Developer direction |
| DES-002 | Visual system | Projector Noir replaces legacy color/type direction. | Decided | Canonical package is cohesive and cross-screen. | [Design package](_docs/design/prototypes/design-system.html) |
| DES-003 | Responsive | S/M/L/XL behavior is first-class MVP, not a post-MVP polish phase. | Decided | Every canonical page contains responsive composition. | [Responsive baseline](_docs/design/prototypes/responsive-baselines.html) |
| DES-004 | Concurrency examples | Multiple active rows demonstrate view variants; only Rating may coexist without limit. | Decided | Avoids encoding fixture layout as a domain invariant. | Developer decision 8 |
| DES-005 | Selection | Generated inclusive score range replaces hard-coded 0–3 and stale “rank three” copy. | Decided | Supports Club configuration and accurate interaction language. | Developer decision 2 |
| DES-006 | Session invite privacy | Non-members see no details and must join the Club first. | Decided | Maintains the Club privacy boundary. | Developer decision 10 |
| DES-007 | Ratings | Historical Session Rating and editable Personal Rating are separate concepts. | Decided | Preserves history while allowing personal opinion to change. | Developer decision 12 |
| DES-008 | Legal copy | Layout is approved; numeric retention/deletion/cookie assertions are provisional until implementation and review agree. | Deferred | Policy accuracy is higher priority than prototype prose. | Phase 19 / 23 review |
| DES-009 | Production contact identity | Publish `hello@pick-flick.app`; send production application email as `PickFlick <notifications@pick-flick.app>` with replies directed to the public contact. Use `PickFlick UAT <notifications@uat.pick-flick.app>` only for UAT. | Decided | One stable public address supports Contact and legal copy while distinct sender identities keep UAT out of production delivery. | [ADR-009](_docs/decisions/README.md#adr-009--use-one-public-contact-and-environment-specific-resend-senders) |

## 8. Design QA & Maintenance

| Check | Target / coverage | Evidence | Status |
| --- | --- | --- | --- |
| Source parity | Every canonical screen and shared component compared against package source. | Four component-preview, 28 shell, and eight Landing/Pricing S/M/L/XL baselines are committed. The new page captures were compared locally with their canonical sources; other feature screens remain pending. | In progress |
| Responsive layout | Continuous widths plus representative 390, 768, 1024, and 1440 modes; portrait/landscape where material. | Component, shell, Landing, and Pricing checks cover 390, 640, 768, 900, 1024, 1200, and 1440. All seven shells and both implemented public pages have S/M/L/XL captures. | In progress |
| Keyboard and focus | Auth, Club creation, Session lifecycle, search, menus, dialogs, rating/score controls, settings, admin confirmations. | Automation covers shared and shell controls plus Pricing FAQ expansion, focus preservation, public destinations, and the unavailable checkout control. Other feature flows remain pending. | In progress |
| Accessibility | Semantic structure, names, focus, contrast, live regions, target sizes, reduced motion, automated checks. | Axe scans all seven shells, Landing, and Pricing at 390 and 1440. Automated checks cover visible focus, 44px shell targets, local table scrolling, and reduced motion; manual review remains pending. | In progress |
| Dynamic content | Empty/loading/error/read-only/offline, long Club/Movie/user text, large nomination/member lists, provider failures. | Fixture matrix and captures required; none yet. | Not checked |
| Localization readiness | English expansion, locale-safe dates/numbers/currency, no newly embedded copy in images. | Phase 2 foundation plus Phase 22/24 review; none yet. | Not checked |
| Browser and input support | Final supported modern-browser/device matrix, mouse/keyboard/touch. | Chromium component and shell automation is active; the final browser/device and UAT matrix remains pending. | In progress |

Update this document whenever an authoritative design changes, visible behavior is clarified, a surface/component is added, implementation status changes, or QA changes accepted behavior. Do not mark production QA passed because a static prototype looks correct.
