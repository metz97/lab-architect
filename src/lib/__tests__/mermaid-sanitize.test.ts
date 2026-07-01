import { describe, expect, it } from "vitest";

import {
  cleanNodeLabels,
  fixEdgeLabelSyntax,
  humanizeMermaidError,
  normalizeFlowchartHeader,
  prepareMermaidSource,
  splitSemicolonStatements,
  stripMermaidFences,
} from "@/lib/mermaid-sanitize";

describe("stripMermaidFences", () => {
  it("removes ```mermaid fences", () => {
    const raw = "```mermaid\nflowchart TD\n  a --> b\n```";
    expect(stripMermaidFences(raw)).toBe("flowchart TD\n  a --> b");
  });

  it("removes plain ``` fences", () => {
    const raw = "```\nflowchart TD\n```";
    expect(stripMermaidFences(raw)).toBe("flowchart TD");
  });

  it("leaves unfenced input untouched", () => {
    expect(stripMermaidFences("flowchart TD\n  a --> b")).toBe(
      "flowchart TD\n  a --> b",
    );
  });
});

describe("splitSemicolonStatements", () => {
  it("splits top-level semicolons onto new lines", () => {
    expect(splitSemicolonStatements("a --> b; b --> c")).toBe(
      "a --> b\nb --> c",
    );
  });

  it("does not split semicolons inside bracketed labels", () => {
    const out = splitSemicolonStatements('a["Label; with semicolon"]');
    expect(out).toBe('a["Label; with semicolon"]');
  });

  it("returns input unchanged when there are no semicolons", () => {
    expect(splitSemicolonStatements("a --> b")).toBe("a --> b");
  });
});

describe("normalizeFlowchartHeader", () => {
  it("splits a glued header + node onto separate lines", () => {
    const out = normalizeFlowchartHeader('flowchart TD mobileApp["Mobile"]');
    expect(out.split("\n")[0]).toBe("flowchart TD");
    expect(out).toContain('mobileApp["Mobile"]');
  });

  it("keeps only the first header when duplicated", () => {
    const out = normalizeFlowchartHeader(
      "flowchart TD\nflowchart TD\n  a --> b",
    );
    expect(out.match(/flowchart TD/g)?.length).toBe(1);
  });

  it("prepends a header when none exists", () => {
    expect(normalizeFlowchartHeader("a --> b")).toBe("flowchart TD\na --> b");
  });
});

describe("fixEdgeLabelSyntax", () => {
  it("fixes the -->|label|> node mistake", () => {
    expect(fixEdgeLabelSyntax("a -->|HTTPS|> b")).toBe("a -->|HTTPS| b");
  });

  it("leaves correct edge labels alone", () => {
    expect(fixEdgeLabelSyntax("a -->|HTTPS| b")).toBe("a -->|HTTPS| b");
  });
});

describe("cleanNodeLabels", () => {
  it("unwraps double-quoted single-quoted labels", () => {
    expect(cleanNodeLabels("a[\"'Label'\"]")).toBe('a["Label"]');
  });

  it("converts single-quoted labels to double-quoted", () => {
    expect(cleanNodeLabels("a['Label']")).toBe('a["Label"]');
  });
});

describe("prepareMermaidSource (end to end)", () => {
  it("cleans a messy LLM diagram into a valid-shaped flowchart", () => {
    const raw = [
      "```mermaid",
      "flowchart TD Mobile App[React Native]",
      "mobileApp -->|HTTPS|> apiGw[API Gateway]; apiGw --> db[Database]",
      "```",
    ].join("\n");

    const out = prepareMermaidSource(raw);

    // fence stripped
    expect(out).not.toContain("```");
    // header on its own first line
    expect(out.split("\n")[0]).toBe("flowchart TD");
    // broken edge-label syntax (-->|label|>) is repaired
    expect(out).not.toContain("|>");
    expect(out).toContain("-->|HTTPS|");
    // semicolon-separated statements are split onto their own lines
    expect(out).toContain("apiGw --> db[Database]");
    expect(out.split("\n").length).toBeGreaterThan(3);
    // spaced node id collapsed to camelCase
    expect(out).toContain("mobileApp");
  });

  it("produces at least a header for empty-ish input", () => {
    expect(prepareMermaidSource("   ")).toBe("flowchart TD");
  });
});

describe("humanizeMermaidError", () => {
  it("references the line number on parse errors", () => {
    const msg = humanizeMermaidError("Parse error on line 3: something");
    expect(msg).toContain("near line 3");
  });

  it("returns a generic message for non-parse errors", () => {
    const msg = humanizeMermaidError("some other failure");
    expect(msg).toContain("could not be rendered");
    expect(msg).not.toContain("near line");
  });
});
