/**
 * Normalizes LLM-generated Mermaid so flowchart parsers accept it more often.
 */

export function stripMermaidFences(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:mermaid)?\s*\n?([\s\S]*?)\n?```$/i.exec(trimmed);
  return fence?.[1]?.trim() ?? trimmed;
}

/** Split `;`-separated statements when not inside `[]` or quotes. */
export function splitSemicolonStatements(source: string): string {
  if (!source.includes(";")) return source;

  const parts: string[] = [];
  let buf = "";
  let bracketDepth = 0;
  let inDouble = false;
  let inSingle = false;

  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const prev = source[i - 1];

    if (c === '"' && prev !== "\\" && !inSingle) inDouble = !inDouble;
    if (c === "'" && prev !== "\\" && !inDouble) inSingle = !inSingle;

    if (!inDouble && !inSingle) {
      if (c === "[") bracketDepth++;
      if (c === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    }

    if (
      c === ";" &&
      bracketDepth === 0 &&
      !inDouble &&
      !inSingle
    ) {
      const piece = buf.trim();
      if (piece) parts.push(piece);
      buf = "";
      continue;
    }
    buf += c;
  }

  const tail = buf.trim();
  if (tail) parts.push(tail);

  if (parts.length <= 1) return source;
  return parts.join("\n");
}

/** `flowchart TD mobileApp[...]` → header line + node on next line */
export function normalizeFlowchartHeader(source: string): string {
  const lines = source.split("\n");
  const out: string[] = [];
  let headerWritten = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const glued = trimmed.match(
      /^(flowchart|graph)\s+(TD|TB|BT|RL|LR|td|tb|bt|rl|lr)\s+(.+)$/i,
    );
    if (glued) {
      const [, kind, dir, rest] = glued;
      if (!headerWritten) {
        out.push(`${kind} ${dir.toUpperCase() === dir ? dir : dir.toUpperCase()}`);
        headerWritten = true;
      }
      out.push(rest.trim());
      continue;
    }

    if (/^(flowchart|graph)\s+(TD|TB|BT|RL|LR)/i.test(trimmed)) {
      if (!headerWritten) {
        out.push(trimmed);
        headerWritten = true;
      }
      continue;
    }

    out.push(line);
  }

  if (out.length === 0) return "flowchart TD";
  if (!headerWritten) return `flowchart TD\n${out.join("\n")}`;
  return out.join("\n");
}

/** `-->|HTTPS|> node` → `-->|HTTPS| node` (common LLM mistake) */
export function fixEdgeLabelSyntax(source: string): string {
  return source.replace(/-->\|([^|\n]+)\|>\s*/g, "-->|$1| ");
}

/** `["'Label'"]` → `["Label"]` */
export function cleanNodeLabels(source: string): string {
  return source
    .replace(/\["'([^'"]*)'"\]/g, '["$1"]')
    .replace(/\['([^'"]*)'\]/g, '["$1"]');
}

/** `Mobile App[React Native]` → `mobileApp["React Native"]` (per line, skips headers/edges) */
export function fixSpacedNodeIds(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (/^(flowchart|graph)\s/i.test(trimmed)) return line;
      if (/-->|---/.test(trimmed)) {
        return line.replace(
          /(^|[\s\n])([A-Za-z][A-Za-z0-9]*(?:\s+[A-Za-z][A-Za-z0-9]*)+)\[([^\]]+)\]/gm,
          (_m, prefix, idPart: string, label: string) =>
            `${prefix}${toCamelCaseId(idPart)}["${label.replace(/"/g, "'")}"]`,
        );
      }
      return line.replace(
        /(^|[\s\n])([A-Za-z][A-Za-z0-9]*(?:\s+[A-Za-z][A-Za-z0-9]*)+)\[([^\]]+)\]/gm,
        (_m, prefix, idPart: string, label: string) =>
          `${prefix}${toCamelCaseId(idPart)}["${label.replace(/"/g, "'")}"]`,
      );
    })
    .join("\n");
}

function toCamelCaseId(idPart: string): string {
  return idPart
    .split(/\s+/)
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}

export function prepareMermaidSource(raw: string): string {
  let s = stripMermaidFences(raw);
  s = splitSemicolonStatements(s);
  s = normalizeFlowchartHeader(s);
  s = fixEdgeLabelSyntax(s);
  s = cleanNodeLabels(s);
  s = fixSpacedNodeIds(s);
  return s.trim();
}

export function humanizeMermaidError(message: string): string {
  if (/parse error/i.test(message)) {
    const line = message.match(/line (\d+)/i)?.[1];
    const lineHint = line ? ` near line ${line}` : "";
    return `The architecture diagram could not be rendered${lineHint}. The model may have used invalid Mermaid (bad edge labels like -->|text|> node, spaces in node names, or semicolons instead of new lines). Use “Copy Mermaid” to edit the source, or regenerate — Gemini/Groq often produce cleaner diagrams than some open models.`;
  }
  return "The architecture diagram could not be rendered. Copy the Mermaid source below to fix it, or try generating again.";
}
