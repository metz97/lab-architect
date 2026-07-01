import { describe, expect, it } from "vitest";

import {
  MAX_ARCHITECT_PROMPT_LENGTH,
  architectBriefSchema,
  type ArchitectBrief,
} from "@/lib/architect-schema";

const validBrief: ArchitectBrief = {
  summary: "A scalable e-commerce platform.",
  assumptions: ["Traffic is spiky", "Region: SEA"],
  recommendedStack: {
    frontend: "Next.js",
    backend: "Node.js",
    infra: "AWS",
  },
  awsServices: [
    { name: "CloudFront", rationale: "Edge caching" },
    { name: "Lambda", rationale: "Serverless compute" },
  ],
  database: "Aurora PostgreSQL",
  queues: "SQS",
  caching: "ElastiCache Redis",
  scalingStrategy: ["Horizontal scaling", "Multi-AZ"],
  architectureMermaid: "flowchart TD\n  a --> b",
};

describe("architectBriefSchema", () => {
  it("parses a fully valid brief", () => {
    const parsed = architectBriefSchema.parse(validBrief);
    expect(parsed.summary).toBe(validBrief.summary);
    expect(parsed.awsServices).toHaveLength(2);
  });

  it("throws when a required top-level field is missing", () => {
    const { summary: _omit, ...missingSummary } = validBrief;
    void _omit;
    expect(() => architectBriefSchema.parse(missingSummary)).toThrow();
  });

  it("throws when a nested stack field has the wrong type", () => {
    const bad = {
      ...validBrief,
      recommendedStack: { frontend: 123, backend: "x", infra: "y" },
    };
    expect(() => architectBriefSchema.parse(bad)).toThrow();
  });

  it("throws when awsServices entries are malformed", () => {
    const bad = {
      ...validBrief,
      awsServices: [{ name: "OnlyName" }],
    };
    expect(() => architectBriefSchema.parse(bad)).toThrow();
  });

  it("uses safeParse to report success/failure without throwing", () => {
    expect(architectBriefSchema.safeParse(validBrief).success).toBe(true);
    expect(architectBriefSchema.safeParse({}).success).toBe(false);
  });
});

describe("MAX_ARCHITECT_PROMPT_LENGTH", () => {
  it("is a positive integer constant", () => {
    expect(MAX_ARCHITECT_PROMPT_LENGTH).toBe(4000);
    expect(Number.isInteger(MAX_ARCHITECT_PROMPT_LENGTH)).toBe(true);
    expect(MAX_ARCHITECT_PROMPT_LENGTH).toBeGreaterThan(0);
  });
});
