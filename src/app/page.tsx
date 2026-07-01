import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ArchitectAssistantClient } from "@/components/architect-assistant-client";
import { FadeIn } from "@/components/fade-in";
import { Button } from "@/components/ui/button";
import { pageTitle } from "@/lib/site-meta";

export const metadata: Metadata = {
  ...pageTitle("AI Solution Architect"),
  description:
    "Describe a system and get stack suggestions, AWS-oriented services, scaling notes, and a Mermaid architecture diagram — via a secure Next.js API route.",
};

export default function ArchitectLabPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <FadeIn>
        <Button asChild variant="ghost" className="mb-6 gap-2 px-0 text-primary">
          <Link href={process.env.NEXT_PUBLIC_PORTFOLIO_URL ?? "#"}>
            <ArrowLeft className="h-4 w-4" />
            Back to portfolio
          </Link>
        </Button>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Labs · AI integration
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          AI Solution Architect Assistant
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base text-muted-foreground">
          Use it as a brainstorming assistant, always validate diagrams and service choices
          before real design reviews.
        </p>
      </FadeIn>

      <FadeIn className="mt-10" delay={0.06}>
        <ArchitectAssistantClient />
      </FadeIn>
    </div>
  );
}
