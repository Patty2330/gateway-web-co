import { ScanForm } from "@/components/scan-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gateway } from "@/lib/gateway";
import { sitePath } from "@/lib/pages";

export default function CheckPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-accent">Free for local owners</p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl">
          When a customer asks AI who to hire, does it say your name?
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
          A lot of people now ask an AI who to hire: a plumber, a salon, or a diner. This check
          asks Perplexity, ChatGPT, and Gemini those questions for your business.
        </p>
        <p className="mt-4 max-w-xl leading-7">
          You get a score and the three fixes that matter most, free. The full report is $49.
          Watching it each month is $19. If the website is part of the problem, {gateway.name} can
          build it. {gateway.buildPitch}
        </p>
        <p className="mt-4 text-sm">
          <a className="underline underline-offset-4" href={sitePath("/")}>
            Back to {gateway.name}
          </a>
          {" · "}
          <a className="underline underline-offset-4" href={sitePath("/#pricing")}>
            Website pricing
          </a>
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-3xl">Run a free check</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Name, what you do, and your city. A website address helps, and you can leave it blank.
          </p>
        </CardHeader>
        <CardContent>
          <ScanForm />
        </CardContent>
      </Card>
    </main>
  );
}
