import {
  ARCHITECT_JSON_SHAPE_DESCRIPTION,
  architectBriefSchema,
  type ArchitectBrief,
} from "@/lib/architect-schema";

export type ArchitectProviderId = "gemini" | "groq" | "nvidia";

const SYSTEM_PROMPT = `You are a senior solution architect. The user describes a system or product to build.
Respond with JSON only — no markdown, no code fences, no prose outside the JSON object.
${ARCHITECT_JSON_SHAPE_DESCRIPTION}
Ground recommendations in the user’s brief. If the brief is vague, state reasonable assumptions in "assumptions".
For "architectureMermaid", output a clear high-level flowchart (clients, API, services, data stores, queues, cache). Roughly 8–20 nodes. Mermaid rules: line 1 must be exactly "flowchart TD"; one statement per line; camelCase node ids; edges are A --> B or A -->|HTTPS| B (never A -->|HTTPS|> B); no semicolons. Example:
flowchart TD
  mobileApp["Mobile app"]
  apiGw["API Gateway"]
  mobileApp --> apiGw
  apiGw -->|HTTPS| lambdaFn["Lambda"]`;

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function parseBrief(text: string): ArchitectBrief {
  const jsonStr = extractJsonObject(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Model returned invalid JSON");
  }
  return architectBriefSchema.parse(parsed);
}

/** Walk `error.cause` so TLS/proxy failures surface instead of a bare "fetch failed". */
function formatNetworkError(error: unknown): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (current instanceof Error) {
      const line =
        "code" in current &&
        typeof (current as NodeJS.ErrnoException).code === "string"
          ? `${current.message} (${(current as NodeJS.ErrnoException).code})`
          : current.message;
      if (!seen.has(line)) {
        seen.add(line);
        parts.push(line);
      }
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return parts.length ? parts.join(" → ") : String(error);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    throw new Error(formatNetworkError(err));
  } finally {
    clearTimeout(id);
  }
}

export async function generateArchitectBrief(
  userBrief: string,
  options: {
    provider: ArchitectProviderId;
    timeoutMs: number;
  },
): Promise<{ brief: ArchitectBrief; provider: ArchitectProviderId }> {
  const { provider, timeoutMs } = options;

  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key?.trim()) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const model =
      process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const body = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userBrief }],
        },
      ],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json",
      },
    };

    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Gemini API error ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`,
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
      "";
    if (!text.trim()) throw new Error("Empty response from Gemini");
    return { brief: parseBrief(text), provider };
  }

  if (provider === "groq") {
    const key = process.env.GROQ_API_KEY;
    if (!key?.trim()) {
      throw new Error("GROQ_API_KEY is not configured");
    }
    const model =
      process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userBrief },
          ],
        }),
      },
      timeoutMs,
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Groq API error ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new Error("Empty response from Groq");
    return { brief: parseBrief(text), provider };
  }

  if (provider !== "nvidia") {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const nim = getNvidiaNimConfig();
  const url = `${nim.baseUrl.replace(/\/$/, "")}/chat/completions`;

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${nim.apiKey}`,
      },
      body: JSON.stringify({
        model: nim.model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userBrief },
        ],
      }),
    },
    timeoutMs,
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `NVIDIA NIM API error ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("Empty response from NVIDIA NIM");
  return { brief: parseBrief(text), provider: "nvidia" };
}

function getNvidiaNimConfig(): {
  apiKey: string;
  baseUrl: string;
  model: string;
} {
  const apiKey =
    process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "NVIDIA_API_KEY is not configured for provider nvidia",
    );
  }
  return {
    apiKey,
    baseUrl:
      process.env.NVIDIA_BASE_URL?.trim() ||
      "https://integrate.api.nvidia.com/v1",
    model:
      process.env.NVIDIA_MODEL?.trim() ||
      "meta/llama-3.1-8b-instruct",
  };
}

export function resolveArchitectProvider(
  requested?: string | null,
): ArchitectProviderId {
  if (requested?.trim()) {
    const normalized = requested.trim().toLowerCase();
    if (normalized === "groq") return "groq";
    if (normalized === "nvidia" || normalized === "nim") return "nvidia";
    if (normalized === "gemini") return "gemini";
  }

  const raw = process.env.ARCHITECT_PROVIDER?.trim().toLowerCase();
  if (raw === "groq") return "groq";
  if (raw === "nvidia" || raw === "nim") return "nvidia";
  return "gemini";
}

export function isProviderConfigured(provider: ArchitectProviderId): boolean {
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY?.trim());
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY?.trim());
  return Boolean(
    process.env.NVIDIA_API_KEY?.trim(),
  );
}

export function listConfiguredArchitectProviders(): ArchitectProviderId[] {
  const all: ArchitectProviderId[] = ["gemini", "groq", "nvidia"];
  return all.filter((id) => isProviderConfigured(id));
}
