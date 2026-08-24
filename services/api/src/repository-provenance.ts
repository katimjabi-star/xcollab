import type { AppendInput } from "./repository.ts";

/**
 * Provenance of an assistant-confirmed mutation (spec §2.6): the chat model
 * that proposed it and the audit context (requestedBy, proposalId, …) merged
 * into the existing ledger row's input. No extra ledger row is written and
 * the hash-chain serialization is untouched — these are ordinary AppendInput
 * fields the routes already own.
 */
export interface MutationProvenance {
  modelId?: string;
  context: Record<string, unknown>;
}

export function enrichAppendInput(
  input: AppendInput,
  provenance: MutationProvenance,
): AppendInput {
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(input.input);
    payload =
      parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { value: parsed };
  } catch {
    payload = { raw: input.input };
  }
  payload["assistant"] = provenance.context;
  const modelId = input.modelId ?? provenance.modelId;
  return {
    ...input,
    ...(modelId === undefined ? {} : { modelId }),
    input: JSON.stringify(payload),
  };
}
