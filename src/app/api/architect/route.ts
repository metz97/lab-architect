import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { MAX_ARCHITECT_PROMPT_LENGTH } from "@/lib/architect-schema";
import {
  generateArchitectBrief,
  isProviderConfigured,
  listConfiguredArchitectProviders,
  resolveArchitectProvider,
  type ArchitectProviderId,
} from "@/lib/architect-llm";
import {
  ARCHITECT_PROVIDER_OPTIONS,
  isArchitectProviderId,
} from "@/lib/architect-providers";
import {
  checkRateLimit,
  getClientIp,
  isRateLimitConfigured,
} from "@/lib/rate-limit";

const TIMEOUT_MS = 55_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OkBody = {
  ok: true;
  data: import("@/lib/architect-schema").ArchitectBrief;
  provider: string;
};

type ErrBody = {
  ok: false;
  error: string;
  code?: string;
};

export async function GET(): Promise<NextResponse> {
  const configured = listConfiguredArchitectProviders();
  const defaultProvider = resolveArchitectProvider(null);
  const effectiveDefault = configured.includes(defaultProvider)
    ? defaultProvider
    : configured[0] ?? defaultProvider;

  return NextResponse.json({
    providers: ARCHITECT_PROVIDER_OPTIONS.map((o) => ({
      id: o.id,
      label: o.label,
      configured: configured.includes(o.id),
    })),
    defaultProvider: effectiveDefault,
  });
}

export async function POST(req: Request): Promise<NextResponse<OkBody | ErrBody>> {
  if (!isRateLimitConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Rate limiting is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
        code: "rate_limit_not_configured",
      },
      { status: 503 },
    );
  }

  const ip = getClientIp(req);
  let rate;
  try {
    rate = await checkRateLimit(`architect:post:${ip}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Rate limit check failed";
    return NextResponse.json(
      { ok: false, error: message, code: "rate_limit_error" },
      { status: 503 },
    );
  }

  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Rate limit exceeded. You can run ${rate.limit} architecture brief${rate.limit === 1 ? "" : "s"} per window. Try again in ${rate.retryAfterSeconds} seconds.`,
        code: "rate_limited",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", code: "bad_request" },
      { status: 400 },
    );
  }

  const record =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;

  const brief =
    record && typeof record.brief === "string" ? record.brief : null;

  if (!brief?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Missing non-empty \"brief\" string", code: "bad_request" },
      { status: 400 },
    );
  }

  if (brief.length > MAX_ARCHITECT_PROMPT_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `Brief exceeds ${MAX_ARCHITECT_PROMPT_LENGTH} characters`,
        code: "too_long",
      },
      { status: 400 },
    );
  }

  const requestedProvider =
    record && typeof record.provider === "string" ? record.provider : null;

  if (requestedProvider && !isArchitectProviderId(requestedProvider)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unknown provider "${requestedProvider}". Use gemini, groq, or nvidia.`,
        code: "bad_request",
      },
      { status: 400 },
    );
  }

  const provider: ArchitectProviderId =
    resolveArchitectProvider(requestedProvider);

  if (!isProviderConfigured(provider)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Provider "${provider}" is not configured on the server. Add the API key env vars from the README, or choose another provider.`,
        code: "not_configured",
      },
      { status: 503 },
    );
  }

  try {
    const { brief: data, provider: used } = await generateArchitectBrief(
      brief.trim(),
      { provider, timeoutMs: TIMEOUT_MS },
    );
    return NextResponse.json({ ok: true, data, provider: used });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The model returned JSON that did not match the expected schema. Try again with a clearer brief.",
          code: "invalid_model_json",
        },
        { status: 502 },
      );
    }
    if (
      e instanceof Error &&
      e.message === "Model returned invalid JSON"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The model did not return valid JSON. Try again or switch provider.",
          code: "invalid_model_json",
        },
        { status: 502 },
      );
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        ok: false,
        error: aborted ? "Request timed out" : message,
        code: aborted ? "timeout" : "upstream_error",
      },
      { status: aborted ? 504 : 502 },
    );
  }
}
