import { z } from "zod";

/** Max characters for the user’s system / product brief (server-enforced). */
export const MAX_ARCHITECT_PROMPT_LENGTH = 4000;

export const architectBriefSchema = z.object({
  summary: z.string(),
  assumptions: z.array(z.string()),
  recommendedStack: z.object({
    frontend: z.string(),
    backend: z.string(),
    infra: z.string(),
  }),
  awsServices: z.array(
    z.object({
      name: z.string(),
      rationale: z.string(),
    }),
  ),
  database: z.string(),
  queues: z.string(),
  caching: z.string(),
  scalingStrategy: z.array(z.string()),
  /** Valid Mermaid diagram source (e.g. flowchart LR with safe node IDs). */
  architectureMermaid: z.string(),
});

export type ArchitectBrief = z.infer<typeof architectBriefSchema>;

/** Human-readable JSON shape for LLM instructions (keep in sync with schema). */
export const ARCHITECT_JSON_SHAPE_DESCRIPTION = `
Return a single JSON object with exactly these keys (all required):
- "summary": string — 2–4 sentences executive summary.
- "assumptions": string[] — 3–8 explicit assumptions.
- "recommendedStack": object with "frontend", "backend", "infra" (each a short string).
- "awsServices": array of { "name": string, "rationale": string } — 4–12 items.
- "database": string — primary data store recommendation and why.
- "queues": string — messaging / async recommendation.
- "caching": string — caching layer and invalidation notes.
- "scalingStrategy": string[] — concrete bullets (horizontal scaling, regions, etc.).
- "architectureMermaid": string — valid Mermaid flowchart only (no markdown fences). Rules: line 1 is only "flowchart TD" (nothing else on that line); one statement per line; node ids camelCase (mobileApp["Mobile app"]); edges use A --> B or A -->|label| B (never -->|label|> B); no semicolons between statements.
`.trim();
