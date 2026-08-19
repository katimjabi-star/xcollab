# ADR 0001 — Service granularity

Status: accepted · Date: 2026-08-19

## Decision
Modular monolith for the work graph (`services/api`) plus a separate stateless
`services/ai-gateway`. `services/agent-runtime` and `services/knowledge` are
split out in V2, not before.

## Context
Single-digit engineering team; air-gapped deployment (every service is an
operational cost on k2); V2 agents need a typed internal API regardless of
process boundaries.

## Consequences
Domain modules inside services/api stay boundary-clean (enforced by
dependency-cruiser) so a V2 split is a move, not a rewrite. The gateway is a
separate process from day one because it is the model seam and the profile
boundary (Connected/Sovereign builds differ only there).
