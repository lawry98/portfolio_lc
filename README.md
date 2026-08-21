# Byte — pet demo

A standalone, portfolio-grade one-page demo starring **Byte**, a little dev-robot
mascot that lives in the hero headline. Vite + vanilla TypeScript, no framework.

See [`docs/SPEC.md`](docs/SPEC.md) for the full design spec and
[`docs/TICKETS.md`](docs/TICKETS.md) for the build plan.

## Getting started

Node is pinned via [mise](https://mise.jdx.dev) (see `.tool-versions`). Run all
commands through it:

```bash
mise exec node@22 -- npm install
mise exec node@22 -- npm run dev
```

Open the URL Vite prints (fixed at [http://localhost:5180](http://localhost:5180)).

## Scripts

```bash
npm run dev            # start the Vite dev server
npm run build          # tsc --noEmit + production build
npm run preview        # preview the production build
npm run lint           # ESLint
npm run format         # Prettier — write
npm run format:check   # Prettier — check only
npm test               # Vitest (single run)
npm run test:watch     # Vitest (watch mode)
```

## Stack

Vite, TypeScript (strict), Vitest + jsdom, ESLint (typescript-eslint) + Prettier.
Three.js, GSAP, and Lenis are added in later tickets — see `docs/TICKETS.md`.
