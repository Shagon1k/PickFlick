# PickFlick Production Brand Assets

Normalized, implementation-ready starting inventory for the Projector Noir panda identity. The machine-readable inventory is [manifest.json](manifest.json).

## Usage contract

- Treat these semantic filenames as the production asset names; prototype hash-like filenames remain only inside `_docs/design/prototypes` so the prototype package stays self-contained.
- Preserve transparency and aspect ratio. Use CSS sizing/cropping rather than rewriting originals for each screen.
- Choose an illustration because its scene supports the content, not merely to fill empty space.
- Decorative instances use empty alternative text. Meaningful instances use concise contextual alternative text and must not repeat nearby headings.
- Do not bake new localized copy into images. `panda-invited-2.webp` already contains English lettering and is unsuitable for locale-neutral reuse.
- `panda-logo.webp` is the large illustrated mark. `panda-mark.png` is the flat black-and-white icon source: transparent, with a thin white outline so the black hat and ears read on dark browser chrome. The favicon and every `icons/` derivative come from it.
- The web app serves `favicon.ico` (16/32/48), `icon.png` (192), and `apple-icon.png` (180, opaque `--bg`) through Next.js file conventions in `apps/frontend/src/app`. `icons/` holds the future PWA manifest set: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (mark inside the 80% safe zone on `--bg`), and `apple-touch-icon-180.png`.
- Film posters/stills in the prototype package are fixtures, not part of this production brand inventory.
- Confirm asset provenance/licensing before public launch; “production-ready” here means naming/format/visual readiness, not a recorded legal rights audit.

## Inventory

| File | Pixels | Suggested semantic use | Notes |
| --- | ---: | --- | --- |
| [panda-mark.png](panda-mark.png) | 512×512 | Favicon/PWA icon source | Flat mark with white outline; derivatives live in `icons/`. |
| [icons/icon-192.png](icons/icon-192.png) · [icon-512.png](icons/icon-512.png) | 192/512 | PWA `any` icons | Transparent. |
| [icons/icon-maskable-512.png](icons/icon-maskable-512.png) | 512×512 | PWA `maskable` icon | Opaque `--bg`, 80% safe zone. |
| [icons/apple-touch-icon-180.png](icons/apple-touch-icon-180.png) | 180×180 | Apple touch icon | Opaque `--bg`. |
| [favicon.png](favicon.png) | 300×300 | Illustrated square app icon | Detailed; too busy below 48 px, so no longer the favicon source. |
| [panda-logo.webp](panda-logo.webp) | 350×350 | Brand mark, compact identity | Transparent. |
| [panda-hero.webp](panda-hero.webp) | 750×400 | Landing hero | Widest illustration. |
| [panda-404.webp](panda-404.webp) | 604×381 | 404/error recovery | Use error-specific copy in HTML. |
| [panda-analytic.webp](panda-analytic.webp) | 308×358 | Analytics/admin insights | Production-only addition. |
| [panda-basic.webp](panda-basic.webp) | 340×392 | Free/basic plan | Production-only addition. |
| [panda-projectionist.webp](panda-projectionist.webp) | 281×361 | Pro plan/projection scene | Works as paid-plan counterpoint. |
| [panda-chill.webp](panda-chill.webp) | 434×351 | Calm/empty/waiting state | Avoid for urgent errors. |
| [panda-choosing.webp](panda-choosing.webp) | 435×300 | Selection/decision scene | Production-only addition. |
| [panda-scales.webp](panda-scales.webp) | 400×360 | Tie-break/selection balance | Supports deterministic-choice explanation. |
| [panda-poll-master.webp](panda-poll-master.webp) | 355×360 | Poll/achievement/selection | Use where voting is the focal action. |
| [panda-watching.webp](panda-watching.webp) | 348×240 | Watching/member scene | Compact wide composition. |
| [panda-session.webp](panda-session.webp) | 460×350 | Create/manage Session | Good task-scene asset. |
| [panda-rating.webp](panda-rating.webp) | 435×250 | Rating prompt | Wide/short. |
| [panda-rating-2.webp](panda-rating-2.webp) | 470×315 | Rating results/alternate | Do not treat as a numeric UI control. |
| [panda-critic.webp](panda-critic.webp) | 305×375 | Reviews/ratings commentary | Portrait composition. |
| [panda-collection.webp](panda-collection.webp) | 440×300 | Library/collection | General collection scene. |
| [panda-coffee-collection.webp](panda-coffee-collection.webp) | 455×305 | Library/achievements alternate | Production-only addition. |
| [panda-privacy.webp](panda-privacy.webp) | 270×270 | Privacy/data controls | Production-only addition. |
| [panda-settings-1.webp](panda-settings-1.webp) | 400×400 | Settings/profile | Square composition. |
| [panda-settings-2.webp](panda-settings-2.webp) | 450×325 | Settings/subscription alternate | Wide composition. |
| [panda-invited.webp](panda-invited.webp) | 400×300 | Club/Session invitation | Locale-neutral. |
| [panda-invited-2.webp](panda-invited-2.webp) | 400×290 | Invitation campaign alternate | Contains embedded English text; restricted reuse. |
| [panda-zoom.webp](panda-zoom.webp) | 464×385 | Search/discovery/inspection | Normalized from duplicate prototype sources. |

## Prototype relationship

- Seventeen normalized production images are byte-identical to corresponding hash-named prototype assets.
- The prototype package intentionally retains its local copies and names so every HTML page remains portable and inspectable.
- `panda-zoom.webp` consolidates two byte-identical prototype files; do not copy that duplicate into application assets.
- The remaining production-only illustrations provide additional starting scenes not currently wired into canonical prototype HTML.

When an asset is optimized, recolored, or replaced, update `manifest.json`, affected design guidance, and visual regression evidence in the same task.
