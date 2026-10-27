# PickFlick

PickFlick helps private film clubs nominate, select, watch, rate, and remember films together, and
gives each registered user a personal film library.

Today the frontend (Next.js) and backend (NestJS) run the public site, Contact, sign-in, Clubs
(Hub, invitations, members, settings), film search and details, and Sessions through Watching,
historical Session Ratings and automatic or partial completion. Nomination deadlines, shared
member joining, immutable Selection ballots and deterministic winner resolution are included.
Phase 13 is active; Rating still requires hosted-preview review. Full Completed history and Hub
Rating views, the film library, billing and the rest follow the [Roadmap](ROADMAP.md#8-phase-plan).

## Run locally

You need Docker and the Node version in `.node-version`.

```bash
corepack enable
cp .env.example .env
pnpm install --frozen-lockfile
pnpm services:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://127.0.0.1:3000`. `pnpm services:up` starts PostgreSQL, Redis and MinIO; `pnpm dev` builds the
shared packages and starts the frontend on port 3000 and the backend on port 3001.

Before you open a pull request, run:

```bash
pnpm verify
```

It runs the production dependency audit, lint, knip, formatting, type-checks, unit tests and builds. [Develop locally](_docs/local-development.md)
covers the other checks and common problems, and [Add a feature end to end](_docs/adding-a-feature.md)
walks through every layer.

## Repository

```text
apps/frontend      Next.js app and UI kit
apps/backend       NestJS API
packages/          contracts (zod schemas), database (Prisma), config, eslint-config
tests/             Playwright suites
_docs/             guides, decisions, design prototypes
```

## Where to look

| Need                                  | Document                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Pick up or track work                 | [GitHub Project 3](https://github.com/users/Shagon1k/projects/3)                                                            |
| Scope, business rules, phases         | [ROADMAP.md](ROADMAP.md)                                                                                                    |
| Screens, components, design QA        | [DESIGN.md](DESIGN.md) and the [prototypes](_docs/design/prototypes/index.html)                                             |
| System structure and delivery         | [ARCHITECTURE.md](ARCHITECTURE.md)                                                                                          |
| Configuration, CI, images, deployment | [Environment reference](_docs/environment.md), [UAT](_docs/uat-operations.md), [production](_docs/production-operations.md) |
| Code style and contribution workflow  | [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md)                                                               |
| Everything else                       | [Documentation map](_docs/README.md)                                                                                        |

After CI passes on `main`, GitHub Actions deploys that revision to `https://uat.pick-flick.app`.
Production promotion is a manual workflow that stays disabled until the owner enables it.
