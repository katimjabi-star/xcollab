# XCollab — Development Charter

The specification of record is on Confluence (KPS space): "XCollab Feature Blueprint"
and "XCollab Architecture and Test Strategy". Where they conflict, Confluence wins.

## Architecture invariants (violations fail CI, not review)
1. Dependency DAG: clients → services/api → data. services/api → ai-gateway for
   inference ONLY; the gateway is stateless and never calls back into api.
2. services/api is the SOLE writer of the AI action ledger; an AI-originated
   mutation and its ledger row commit in one local transaction; ledger tables are
   append-only (UPDATE/DELETE revoked), hash-chained per workspace.
3. Two build profiles: Connected (hosted model key, synthetic data only) and
   Sovereign (in-boundary inference; hosted adapters excluded at compile time).
4. Arabic/English parity: every UI ships LTR+RTL together; every generation
   feature is evaluated in both languages.

## TDD — the only way code gets written
Red → green → refactor. Order per feature: (1) zod schema in packages/core
(OpenAPI is GENERATED from zod, never hand-written), (2) failing contract test,
(3) failing domain unit test, (4) minimum code to green, (5) integration test
against real Postgres. AI features follow eval-driven development: golden cases
first, then the prompt/adapter. Fast evals (<60s, heuristic-only) on every PR
touching prompts or the gateway.

## Quality gates (CI-enforced)
0 new issues; coverage ≥80% new code, ≥85% services/api domain logic; mutation
testing on authority check, RBAC decisions, hash chain; duplication ≤3%;
cognitive complexity ≤15 hard / ≤8 target. Search packages/* before writing
anything new; rule of three for extraction.

## Security (OWASP ASVS L2; defense product)
No secrets anywhere in the repo (env only). All queries parameterized; all input
zod-validated at the boundary; authz in services/api on every mutation. Deps
lockfile-pinned, license-checked, audited; justify every new dependency in the PR.
SBOM per build; boundary-cached base images only. Human review MANDATORY for
authn/authz, ledger, crypto, RBAC, model plane.

## Code standards
TypeScript strict; no `any`, no `@ts-ignore` without a linked issue. Functions do
one thing; files under ~300 lines; domain names (approval, verdict, teammate —
never manager/util/helper). No premature abstraction, dead code, commented-out
code, or TODO without an issue link. Errors typed, handled, never swallowed.
Comments state constraints code can't show — never narrate.

## Documentation discipline — HARD RULE
Markdown allowed: README.md (root, one), CLAUDE.md (this file), docs/adr/NNNN-*.md.
THAT IS ALL. Never create SUMMARY/PROGRESS/PHASE/NOTES/PLAN markdown. Status lives
in commits and PRs; decisions in ADRs; behavior in tests.

## Git discipline
Trunk-based; conventional commits (feat:/fix:/test:/refactor:/adr:); every commit
leaves CI green; PRs reviewable in 15 minutes. POC history: branch `poc-archive`.

## Definition of done (every PR)
Schema in core → tests first → gates green (fitness, unit, contract, integration,
fast-evals where AI-touching) → RTL verified where UI → ledger row asserted where
AI-mutating → zero new issues → reviewed → squash-merged.
