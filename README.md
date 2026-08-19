# XCollab Platform

AI-native, air-gapped program orchestration. Monorepo:

- `packages/core` — zod schemas, types, contracts (the single source of truth)
- `packages/synthesizer` — deterministic program synthesizer (zero-connectivity guarantee, eval baseline)
- `services/ai-gateway` — the single model seam (adapters, prompt packs, rate control)
- `services/api` — work graph + governance fabric (sole AI-action-ledger writer)
- `apps/web` — Next.js program workspace
- `eval-harness` — golden datasets + eval gates
- `docs/adr/` — architecture decision records

## Development

```bash
pnpm install
docker compose up -d      # Postgres16+pgvector, MinIO, Keycloak
pnpm test                 # all workspaces
pnpm typecheck && pnpm lint
```

Connected profile needs `ANTHROPIC_API_KEY` in your environment (synthetic data
only — see CLAUDE.md). Everything runs without it via the deterministic synthesizer.

The pre-monorepo prototype lives on branch `poc-archive`.
