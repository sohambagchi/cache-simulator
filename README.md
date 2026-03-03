# Multi-Level Cache Simulator

Deterministic, browser-only simulator for exploring multi-level cache behavior (L1-L3), workload parsing, validation gating, and step/run timeline playback.

## Local development

Install dependencies:

```bash
bun install
```

Run local dev server:

```bash
bun run dev
```

## Local verification commands

Run these commands locally as the core completion gate:

```bash
bun run lint
bun run test
bun run test:e2e
bun run build
bun run preview
```

Core completion gate is local verification only (lint, tests, build, preview startup check).

## Deployment status

Deployment is an optional follow-up after local verification is green. It is not required for core completion.

If you deploy on Vercel, use:

- Framework preset: `Vite`
- Output directory: `dist`
- SPA routing fallback: `vercel.json` routes to `/index.html`

Optional deployment command (post-verification):

```bash
vercel --prod
```
