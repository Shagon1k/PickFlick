# PickFlick

PickFlick helps private film clubs nominate, select, watch, rate, and remember films together,
while giving each registered user a personal film library.

The repository is greenfield. Its typed pnpm monorepo, web/API/worker entrypoints, local data
foundation, and runtime observability baseline run, while product features, provider integrations,
and provisioned deployment environments remain future work.

## Start here

| Need | Source |
| --- | --- |
| Select or track actionable work | [GitHub Project 3](https://github.com/users/Shagon1k/projects/3) |
| Understand MVP scope, business rules, and phase sequencing | [ROADMAP.md](ROADMAP.md) |
| Implement or review the experience | [DESIGN.md](DESIGN.md) and the [prototype package](_docs/design/prototypes/index.html) |
| Understand proposed technical boundaries | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Navigate repository guidance | [_docs/README.md](_docs/README.md) |
| Contribute a change | [CONTRIBUTING.md](CONTRIBUTING.md) |

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

The development command builds the internal packages, then starts the Next.js web app, NestJS API,
and worker together. Run the complete workspace gate with `pnpm verify`. See the
[environment and local data services reference](_docs/environment.md) for configuration, database
safety, health endpoints, runtime logs, and service commands.

## Build deployment artifacts

Build the immutable web, API, worker, and release image targets from the current revision:

```bash
pnpm images:build
pnpm compose:check
```

`pnpm images:build` tags local images with the first 12 characters of the full source revision.
`pnpm compose:check` renders the shared `compose.deploy.yaml` topology for synthetic UAT and
production inputs. It rejects published host ports, mutable image references, missing release
gates, and shared data networks, volumes, or storage buckets. See the
[environment and runtime operations reference](_docs/environment.md#deployment-images-and-compose)
before supplying real environment values.

## Delivery workflow

1. Select or create a focused issue in Project 3.
2. Use `Deferred` only with an observable activation trigger; ready work belongs in `Backlog`.
3. Branch from `main` using `PF-TYPE-SHORT-DESCRIPTOR`.
4. Open a focused PR that links the issue and reports acceptance evidence.
5. Squash merge after review.

Project 3 is the canonical tracker for actionable active and deferred delivery work. The Roadmap
remains the product and phase contract; it is not the task inbox.
