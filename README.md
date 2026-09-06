# PickFlick

PickFlick helps private film clubs nominate, select, watch, rate, and remember films together,
while giving each registered user a personal film library.

The repository is greenfield. Its typed pnpm monorepo and web/API/worker entrypoints run, while
product features, data services, provider integrations, and deployment remain future work.

## Start here

| Need | Source |
| --- | --- |
| Select or track actionable work | [GitHub Project 3](https://github.com/users/Shagon1k/projects/3) |
| Understand MVP scope, business rules, and phase sequencing | [ROADMAP.md](ROADMAP.md) |
| Implement or review the experience | [DESIGN.md](DESIGN.md) and the [prototype package](_docs/design/prototypes/index.html) |
| Understand proposed technical boundaries | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Navigate repository guidance | [_docs/README.md](_docs/README.md) |
| Contribute a change | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Run the scaffold

Use the Node version pinned in `.node-version`, then enable the package manager pinned in
`package.json`:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The development command builds the internal packages, then starts the Next.js web app, NestJS API,
and worker together. Run the complete scaffold gate with `pnpm verify`. See [AGENTS.md](AGENTS.md#command-map)
for the full command map and the current migration/seed limitation.

## Delivery workflow

1. Select or create a focused issue in Project 3.
2. Use `Deferred` only with an observable activation trigger; ready work belongs in `Backlog`.
3. Branch from `main` using `PF-TYPE-SHORT-DESCRIPTOR`.
4. Open a focused PR that links the issue and reports acceptance evidence.
5. Squash merge after review.

Project 3 is the canonical tracker for actionable active and deferred delivery work. The Roadmap
remains the product and phase contract; it is not the task inbox.
