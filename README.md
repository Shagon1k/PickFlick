# PickFlick

PickFlick helps private film clubs nominate, select, watch, rate, and remember films together,
while giving each registered user a personal film library.

The web app (Next.js) and API (NestJS) run with authentication, Clubs, the public site, and
Contact. Sessions, the film library, billing, and the rest of the product are future phases; see
the [Roadmap](ROADMAP.md).

## Start here

| Need                                                       | Source                                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Select or track actionable work                            | [GitHub Project 3](https://github.com/users/Shagon1k/projects/3)                       |
| Understand MVP scope, business rules, and phase sequencing | [ROADMAP.md](ROADMAP.md)                                                               |
| Implement or review the experience                         | [DESIGN.md](DESIGN.md) and the [prototype package](_docs/design/prototypes/index.html) |
| Understand proposed technical boundaries                   | [ARCHITECTURE.md](ARCHITECTURE.md)                                                     |
| Navigate repository guidance                               | [\_docs/README.md](_docs/README.md)                                                    |
| Contribute a change                                        | [CONTRIBUTING.md](CONTRIBUTING.md)                                                     |

## Run locally

Use the Node version pinned in `.node-version`, then enable the package manager pinned in
`package.json`:

```bash
corepack enable
cp .env.example .env
pnpm install --frozen-lockfile
pnpm services:up
pnpm migrate
pnpm seed
pnpm services:check
pnpm dev
```

The development command builds the internal packages, then starts the web app and API. Run the
quality gates with `pnpm verify`, database integration tests with `pnpm test:integration`, and the
Playwright UI suite with `pnpm ui:test`. The [environment reference](_docs/environment.md) covers
configuration, database safety, health endpoints, and logs; the [UI quality guide](_docs/ui-quality.md)
covers browser setup and baselines.

## Build and deploy

```bash
pnpm images:build
pnpm compose:check
```

`pnpm images:build` builds the web, API, and release images tagged with the short revision.
`pnpm compose:check` renders the local, deploy, and preview Compose files. After CI passes on
`main`, GitHub Actions deploys that revision to UAT; production promotion is a guarded manual
workflow. See the [UAT](_docs/uat-operations.md) and [production](_docs/production-operations.md)
guides.

## Delivery workflow

1. Select or create a focused issue in Project 3.
2. Use `Deferred` only with an observable activation trigger; ready work belongs in `Backlog`.
3. Branch from `main` using `PF-TYPE-SHORT-DESCRIPTOR`.
4. Open a focused PR that links the issue and reports acceptance evidence.
5. Squash merge after review.

Project 3 is the canonical tracker for actionable active and deferred delivery work. The Roadmap
remains the product and phase contract; it is not the task inbox.
