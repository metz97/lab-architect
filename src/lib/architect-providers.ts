import type { ArchitectProviderId } from "@/lib/architect-llm";

export const ARCHITECT_PROVIDER_OPTIONS: ReadonlyArray<{
  id: ArchitectProviderId;
  label: string;
}> = [
  { id: "gemini", label: "Google Gemini" },
  { id: "groq", label: "Groq" },
  { id: "nvidia", label: "NVIDIA NIM" },
] as const;

const PROVIDER_IDS = new Set(
  ARCHITECT_PROVIDER_OPTIONS.map((o) => o.id),
);

export function isArchitectProviderId(
  value: string,
): value is ArchitectProviderId {
  return PROVIDER_IDS.has(value as ArchitectProviderId);
}

export function labelForArchitectProvider(id: ArchitectProviderId): string {
  return (
    ARCHITECT_PROVIDER_OPTIONS.find((o) => o.id === id)?.label ?? id
  );
}
