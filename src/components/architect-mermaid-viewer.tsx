"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  humanizeMermaidError,
  prepareMermaidSource,
} from "@/lib/mermaid-sanitize";
import { cn } from "@/lib/utils";

type Props = {
  definition: string;
  className?: string;
};

async function renderMermaid(
  id: string,
  source: string,
): Promise<string> {
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  });
  const { svg } = await mermaid.render(id, source);
  return svg;
}

export function ArchitectMermaidViewer({ definition, className }: Props) {
  const reactId = useId().replace(/:/g, "");
  const renderSeq = useRef(0);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [renderedSource, setRenderedSource] = useState<string | null>(null);

  const trimmed = definition.trim();

  useEffect(() => {
    let cancelled = false;

    if (!trimmed) {
      return;
    }

    (async () => {
      renderSeq.current += 1;
      const id = `architect-mermaid-${reactId}-${renderSeq.current}`;
      const prepared = prepareMermaidSource(trimmed);

      try {
        const out = await renderMermaid(id, prepared);
        if (!cancelled) {
          setSvg(out);
          setRenderedSource(prepared);
        }
        return;
      } catch (firstErr) {
        const firstMessage =
          firstErr instanceof Error ? firstErr.message : String(firstErr);

        if (prepared !== trimmed) {
          try {
            const out = await renderMermaid(`${id}-raw`, trimmed);
            if (!cancelled) {
              setSvg(out);
              setRenderedSource(trimmed);
            }
            return;
          } catch {
            // fall through to error UI
          }
        }

        if (!cancelled) {
          setError(humanizeMermaidError(firstMessage));
          setTechnicalError(firstMessage);
          setRenderedSource(prepared);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trimmed, reactId]);

  if (!trimmed) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Empty diagram
      </p>
    );
  }

  const copyText = (renderedSource ?? trimmed).trim();

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          LLM-generated draft, validate before production.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!copyText}
          onClick={() => void navigator.clipboard.writeText(copyText)}
        >
          Copy Mermaid
        </Button>
      </div>
      {error ? (
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          {technicalError ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none font-medium text-foreground/80">
                Technical details
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/50 bg-background/60 p-2 font-mono text-[11px] text-muted-foreground">
                {technicalError}
              </pre>
            </details>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground/90">
              Mermaid source (after cleanup)
            </p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/50 bg-background/60 p-3 font-mono text-[11px] text-muted-foreground">
              {copyText}
            </pre>
          </div>
        </div>
      ) : svg ? (
        <div
          className="overflow-x-auto rounded-lg border border-border/60 bg-card/50 p-4 [&_svg]:mx-auto [&_svg]:max-w-none"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          Rendering diagram…
        </div>
      )}
    </div>
  );
}
