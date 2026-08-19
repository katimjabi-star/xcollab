# ADR 0002 — AI action ledger ownership and write path

Status: accepted · Date: 2026-08-19

## Decision
`services/api` is the sole ledger writer. An AI-originated mutation and its
ledger row commit in one local Postgres transaction. Model reads (no mutation)
are ledgered by the calling service via an idempotency-keyed append endpoint on
services/api, using interaction metadata returned by the gateway. Ledger tables
are append-only: UPDATE/DELETE revoked at the database layer; hash chain is
per-workspace with a monotonic sequence, serialized by advisory lock; periodic
signed checkpoints export to WORM object storage.

## Context
A gateway-owned ledger would require a distributed transaction with the API's
mutations (two services, two connections). Auditability is quality goal #2 and
must not depend on 2PC or eventual consistency for mutations.

## Consequences
The gateway stays stateless. Every service that initiates model calls must
report them; the negative CI test "a mutation without its ledger row is
impossible" pins the guarantee. Full prompt and tool-call inputs are retained
(not digests) under per-classification retention policy.
