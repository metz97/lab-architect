"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ArchitectMermaidViewer } from "@/components/architect-mermaid-viewer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ArchitectBrief } from "@/lib/architect-schema";
import { MAX_ARCHITECT_PROMPT_LENGTH } from "@/lib/architect-schema";
import type { ArchitectProviderId } from "@/lib/architect-llm";
import {
  ARCHITECT_PROVIDER_OPTIONS,
  labelForArchitectProvider,
} from "@/lib/architect-providers";
import { cn } from "@/lib/utils";

type ApiOk = { ok: true; data: ArchitectBrief; provider: string };
type ApiErr = { ok: false; error: string; code?: string };

type ProvidersResponse = {
  providers: Array<{
    id: ArchitectProviderId;
    label: string;
    configured: boolean;
  }>;
  defaultProvider: ArchitectProviderId;
};

function downloadJson(data: ArchitectBrief) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "architecture-brief.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function ArchitectAssistantClient() {
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArchitectBrief | null>(null);
  const [lastProvider, setLastProvider] = useState<ArchitectProviderId | null>(
    null,
  );
  const [provider, setProvider] = useState<ArchitectProviderId>("gemini");
  const [providerOptions, setProviderOptions] = useState(
    ARCHITECT_PROVIDER_OPTIONS.map((o) => ({ ...o, configured: false })),
  );
  const [providersReady, setProvidersReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/architect");
        if (!res.ok) return;
        const data = (await res.json()) as ProvidersResponse;
        if (cancelled) return;
        setProviderOptions(
          data.providers.map((p) => ({
            id: p.id,
            label: p.label,
            configured: p.configured,
          })),
        );
        setProvider(data.defaultProvider);
        setProvidersReady(true);
      } catch {
        if (!cancelled) setProvidersReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLastProvider(null);
    const trimmed = brief.trim();
    if (!trimmed) {
      setError("Describe the system you want to architect.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/architect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: trimmed, provider }),
      });
      const json = (await res.json()) as ApiOk | ApiErr;

      if (!json.ok) {
        setError(json.error);
        return;
      }

      setResult(json.data);
      setLastProvider(json.provider as ArchitectProviderId);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <Card className="border-border/60 bg-card/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Your brief</CardTitle>
          <CardDescription>
            Describe the product or platform (users, scale, region, compliance).
            Max {String(MAX_ARCHITECT_PROMPT_LENGTH)} characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="architect-provider"
                className="text-sm font-medium text-foreground"
              >
                AI provider
              </label>
              <select
                id="architect-provider"
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as ArchitectProviderId)
                }
                disabled={loading || !providersReady}
                className={cn(
                  "flex h-10 w-full max-w-sm rounded-md border border-input bg-background/80 px-3 py-2 text-sm",
                  "text-foreground shadow-sm outline-none transition-colors",
                  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {providerOptions.map((opt) => (
                  <option
                    key={opt.id}
                    value={opt.id}
                    disabled={providersReady && !opt.configured}
                  >
                    {opt.label}
                    {providersReady && !opt.configured
                      ? " (not configured)"
                      : ""}
                  </option>
                ))}
              </select>
              {!providersReady ? (
                <p className="text-xs text-muted-foreground">
                  Loading provider options…
                </p>
              ) : null}
            </div>
            <textarea
              name="brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              maxLength={MAX_ARCHITECT_PROMPT_LENGTH}
              rows={6}
              placeholder="Example: Build scalable e-commerce for Southeast Asia with mobile-first checkout, promos, and COD…"
              className={cn(
                "flex min-h-[140px] w-full resize-y rounded-md border border-input bg-background/80 px-3 py-2 text-sm",
                "text-foreground shadow-sm outline-none transition-colors",
                "placeholder:text-muted-foreground",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              disabled={loading}
              aria-label="System or product brief"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Generating…
                  </>
                ) : (
                  "Generate architecture brief"
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                {String(brief.length)} / {String(MAX_ARCHITECT_PROMPT_LENGTH)}
              </span>
            </div>
          </form>
          {error ? (
            <p
              className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <div className="space-y-8">
          {lastProvider ? (
            <p className="text-xs text-muted-foreground">
              Generated with{" "}
              <span className="font-medium text-foreground">
                {labelForArchitectProvider(lastProvider)}
              </span>
            </p>
          ) : null}

          <Card className="border-border/60 bg-card/40">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Summary</CardTitle>
                <CardDescription>Executive overview</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadJson(result)}
              >
                Download JSON
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                {result.summary}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/40">
            <CardHeader>
              <CardTitle>Assumptions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {result.assumptions.map((a, i) => (
                  <li key={`a-${i}`}>{a}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/40">
            <CardHeader>
              <CardTitle>Recommended stack</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Frontend
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.recommendedStack.frontend}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Backend
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.recommendedStack.backend}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Infra
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.recommendedStack.infra}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/40">
            <CardHeader>
              <CardTitle>AWS services</CardTitle>
              <CardDescription>
                Illustrative mapping — verify against your org standards.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.awsServices.map((s, i) => (
                <div
                  key={`aws-${i}-${s.name}`}
                  className="rounded-md border border-border/50 bg-background/40 px-3 py-2"
                >
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.rationale}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border-border/60 bg-card/40 lg:col-span-1">
              <CardHeader>
                <CardTitle>Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">Database</p>
                  <p className="mt-1">{result.database}</p>
                </div>
                <Separator />
                <div>
                  <p className="font-semibold text-foreground">Queues</p>
                  <p className="mt-1">{result.queues}</p>
                </div>
                <Separator />
                <div>
                  <p className="font-semibold text-foreground">Caching</p>
                  <p className="mt-1">{result.caching}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/40 lg:col-span-2">
              <CardHeader>
                <CardTitle>Scaling strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                  {result.scalingStrategy.map((s, i) => (
                    <li key={`scale-${i}`}>{s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60 bg-card/40">
            <CardHeader>
              <CardTitle>Architecture diagram</CardTitle>
              <CardDescription>Mermaid (rendered in the browser)</CardDescription>
            </CardHeader>
            <CardContent>
              <ArchitectMermaidViewer
                key={result.architectureMermaid}
                definition={result.architectureMermaid}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
