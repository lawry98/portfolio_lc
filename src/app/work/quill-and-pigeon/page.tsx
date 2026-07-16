import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricGrid } from "@/components/ui/metric-grid";
import { TechGroups } from "@/components/ui/tech-groups";
import { FlowDiagram } from "@/components/ui/flow-diagram";
import { FadeIn } from "@/components/animations/fade-in";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { featuredExperience } from "@/data/experience";
import type { TechGroup } from "@/data/experience";

export const metadata: Metadata = {
  title: "Quill & Pigeon Case Study | Lawrence Crasto",
  description:
    "Engineering case study: full-stack product development, subscription card-credit commerce, context-aware AI with an MCP server, search, transactional email, and platform integrations for the Quill & Pigeon multi-tenant commerce platform.",
};

const qp = featuredExperience!;

const caseStudyTech: TechGroup[] = [
  {
    label: "Full stack",
    items: [
      "Next.js",
      "React",
      "TypeScript",
      "Prisma",
      "Zod",
      "PostgreSQL",
      "Supabase",
    ],
  },
  {
    label: "Commerce and search",
    items: ["Medusa", "Stripe", "Meilisearch", "USPS APIs"],
  },
  {
    label: "AI and automation",
    items: [
      "OpenAI API",
      "Claude API",
      "MCP",
      "Langfuse",
      "n8n",
      "React Email",
    ],
  },
  {
    label: "Cloud and backend",
    items: ["AWS Lambda", "SQS", "SES", "Kysely", "GitHub Actions", "OIDC"],
  },
];

const developerTooling = ["Bruno", "Postman", "act", "Prettier", "Git"];

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <FadeIn>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
          {eyebrow}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">{title}</h2>
      </FadeIn>
      <div className="space-y-5 text-base text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 leading-relaxed">
          <span className="text-foreground/40 mt-1" aria-hidden="true">
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function QuillAndPigeonCaseStudy() {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <nav className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/#experience"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to portfolio
          </Link>
          <AnimatedThemeToggler
            variant="circle"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          />
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 sm:py-20">
        {/* Title */}
        <FadeIn>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4">
            Case Study
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            {qp.company}
          </h1>
          <p className="text-lg text-muted-foreground">
            {qp.role} · {qp.location} · {qp.period}
          </p>
        </FadeIn>

        {/* Screenshot */}
        {qp.image && (
          <FadeIn delay={0.1}>
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-border/50 bg-muted mt-10">
              <Image
                src={qp.image}
                alt={qp.imageAlt ?? qp.company}
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-cover object-top"
                priority
              />
            </div>
          </FadeIn>
        )}

        <div className="mt-16 space-y-16">
          {/* 1. Product overview */}
          <Section id="overview" eyebrow="01" title="Product overview">
            <p>{qp.context}</p>
            <p>
              I joined as a Full-Stack Software Engineer Co-op and worked across
              the customer-facing Next.js platform, Medusa commerce services,
              Stripe subscriptions and payments, AWS Lambda applications, search
              infrastructure, transactional email, shipping workflows, and
              context-aware AI agents.
            </p>
          </Section>

          {/* 2. Role and ownership */}
          <Section
            id="ownership"
            eyebrow="02"
            title="My role and areas of ownership"
          >
            <p>{qp.contributionSummary}</p>
            {qp.ownershipAreas && (
              <div className="grid sm:grid-cols-2 gap-4">
                {qp.ownershipAreas.map((area) => (
                  <div
                    key={area.title}
                    className="rounded-2xl border border-border/50 bg-card p-5"
                  >
                    <h3 className="font-semibold text-foreground mb-2">
                      {area.title}
                    </h3>
                    <p className="text-sm leading-relaxed">{area.description}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 3. Results and impact */}
          <Section id="results" eyebrow="03" title="Results and impact">
            {qp.metrics && <MetricGrid metrics={qp.metrics} />}
          </Section>

          {/* 4. Full-stack customer experience */}
          <Section
            id="customer-experience"
            eyebrow="04"
            title="Full-stack customer experience"
          >
            <p>
              Built accessible customer workflows across product discovery,
              personalization, recipients, reminders, subscriptions, checkout, and
              card delivery using Next.js, React, TypeScript, Prisma, Zod, Medusa,
              and PostgreSQL.
            </p>
            <p>
              These flows connected the storefront to commerce and fulfillment
              services so customers could discover cards, personalize them, manage
              recipients and important-date reminders, subscribe, check out, and
              track delivery — all with an accessible, WCAG 2.2 AA experience.
            </p>
          </Section>

          {/* 5. Commerce and subscription-credit architecture */}
          <Section
            id="commerce"
            eyebrow="05"
            title="Commerce and subscription-credit architecture"
          >
            <p>
              Medusa did not natively support Quill &amp; Pigeon&apos;s
              subscription card-credit model, so I extended its commerce and
              payment architecture to support it. Customers received card credits
              based on their subscription tier and could redeem those credits to
              receive included or free cards during checkout.
            </p>
            <p>
              Extended Medusa&apos;s commerce and payment architecture to support
              subscription card credits, allowing customers to redeem included
              cards during checkout while preserving Stripe-based payment workflows
              for standard purchases and remaining balances.
            </p>
            <Bullets
              items={[
                "Customers received card credits based on subscription tier.",
                "Credits could be used to receive included or free cards.",
                "Credit redemption was integrated directly into checkout.",
                "Custom Medusa functionality backed the credit model — it is not a native Medusa capability.",
                "Custom payment-provider behavior connected Stripe payment workflows and credit redemption.",
                "Checkout logic distinguished between credit-funded and standard paid purchases.",
                "Subscription lifecycle events updated customer-credit availability.",
              ]}
            />
            <h3 className="text-lg font-semibold text-foreground pt-2">
              Custom Stripe payment provider
            </h3>
            <p>
              Built custom payment-provider behavior that integrated subscription
              card-credit redemption with Stripe-backed payment and checkout
              workflows. The design keeps three concerns clearly separated: Stripe
              handled payment processing, the custom provider handled
              subscription-card credit redemption, and Medusa handled order
              creation. Card credits are an application-level entitlement — not
              cryptocurrency or a cash equivalent.
            </p>
            <FadeIn>
              <FlowDiagram
                ariaLabel="Commerce and subscription-credit workflow"
                className="pt-2"
                steps={[
                  "Subscription purchased",
                  "Stripe webhook",
                  "Subscription tier resolved",
                  "Card credits added",
                  "Customer selects a card",
                  "Checkout evaluates available credits",
                  "Custom Medusa payment behavior",
                  "Credit redeemed or Stripe payment collected",
                  "Order created",
                ]}
              />
            </FadeIn>
          </Section>

          {/* 6. Context-aware AI and MCP server */}
          <Section
            id="ai"
            eyebrow="06"
            title="Context-aware AI and MCP server"
          >
            <p>
              Built an MCP server that supplied AI agents with authenticated
              customer context, including subscription tier, available card
              credits, and relevant account information, allowing responses and
              recommendations to reflect the customer&apos;s actual product state.
            </p>
            <Bullets
              items={[
                "The AI could provide account-aware answers.",
                "Recommendations could consider the customer's subscription.",
                "The agent could determine whether the customer had credits available.",
                "Context did not need to be manually copied into each prompt.",
                "Context was exposed through controlled MCP tools.",
                "The AI did not receive unrestricted database access.",
              ]}
            />
            <p>
              Customer context was exposed through controlled MCP tools rather than
              direct, unrestricted access to the application database.
            </p>
            <p>
              Built AI-powered product and support workflows using the OpenAI API
              and Claude API, with provider failover and customer context supplied
              through the MCP server. Instrumented these AI workflows with Langfuse
              for prompt management, cost visibility, tracing, debugging, and
              understanding agent decisions — Langfuse provides observability
              around the workflows rather than making AI decisions itself.
            </p>
            <FadeIn>
              <FlowDiagram
                ariaLabel="Context-aware AI workflow"
                className="pt-2"
                steps={[
                  "Customer request",
                  "AI workflow",
                  "MCP server",
                  "Subscription tier",
                  "Available card credits",
                  "Relevant account context",
                  "OpenAI API or Claude API",
                  "Context-aware response",
                ]}
              />
            </FadeIn>
          </Section>

          {/* 7. Search and product discovery */}
          <Section
            id="search"
            eyebrow="07"
            title="Search and product discovery"
          >
            <p>
              Integrated Meilisearch to support fast product discovery and search
              across the commerce experience, keeping product lookups responsive as
              the catalog grew.
            </p>
          </Section>

          {/* 8. Email conversation chaining and human escalation */}
          <Section
            id="email"
            eyebrow="08"
            title="Email conversation chaining and human escalation"
          >
            <p>
              Implemented email conversation chaining so AI workflows received the
              relevant conversation history before reacting to inbound messages.
            </p>
            <p>
              Built conversation-aware inbound email handling that reconstructed
              the relevant message thread before invoking the AI workflow. Requests
              the agent could not safely or confidently resolve were escalated to
              the owners for human follow-up.
            </p>
            <Bullets
              items={[
                "Inbound emails were associated with their existing conversation.",
                "Prior messages were reconstructed or retrieved.",
                "The AI received the relevant thread context.",
                "The AI attempted to handle the request using the full conversation.",
                "Requests that could not be handled safely or confidently were escalated to the business owners.",
                "Human owners could continue the existing conversation.",
              ]}
            />
            <p>
              Branded transactional email templates were built with React Email and
              connected to automated customer workflows, covering communication such
              as event reminders, order emails, and subscription updates alongside
              conversation-aware inbound handling.
            </p>
            <FadeIn>
              <FlowDiagram
                ariaLabel="Inbound email workflow"
                className="pt-2"
                steps={[
                  "Inbound email",
                  "Conversation identified",
                  "Relevant thread reconstructed",
                  "Customer context retrieved",
                  "AI evaluates and drafts response",
                  "Handling decision",
                  "Automated response or owner escalation",
                ]}
              />
            </FadeIn>
          </Section>

          {/* 9. Data-access architecture */}
          <Section
            id="data-access"
            eyebrow="09"
            title="Data-access architecture"
          >
            <p>
              Prisma and Kysely served different architectural needs and were not
              used interchangeably in the same runtime.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border/50 bg-card p-5">
                <h3 className="font-semibold text-foreground mb-2">
                  Next.js platform application
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Used Prisma for typed data access in the Next.js platform and Zod
                  for validating application inputs, API payloads, and workflow
                  boundaries.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {["Prisma", "PostgreSQL", "Supabase", "Zod"].map((tech) => (
                    <Badge key={tech} variant="secondary">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border/50 bg-card p-5">
                <h3 className="font-semibold text-foreground mb-2">
                  AWS Lambda applications
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Used Kysely for typed SQL access in AWS Lambda applications,
                  keeping the serverless data layer lightweight while preserving
                  compile-time query safety.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {["Kysely", "AWS Lambda", "PostgreSQL"].map((tech) => (
                    <Badge key={tech} variant="secondary">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* 10. Shipping and fulfillment */}
          <Section
            id="shipping"
            eyebrow="10"
            title="Shipping and fulfillment integrations"
          >
            <p>
              Integrated USPS shipping estimates into the checkout and fulfillment
              experience so customers could see more accurate delivery
              expectations. These are estimated delivery windows, not guaranteed
              delivery dates.
            </p>
          </Section>

          {/* 11. CI/CD and developer experience */}
          <Section
            id="cicd"
            eyebrow="11"
            title="CI/CD and developer experience"
          >
            <p>
              Configured GitHub Actions workflows with AWS OIDC authentication and
              used act to run and debug CI workflows locally before pushing changes.
              act is a local GitHub Actions runner — not an AWS service, a
              replacement for GitHub Actions, or a production deployment platform.
            </p>
            <Bullets
              items={[
                "Reduced reliance on long-lived AWS credentials through OIDC authentication.",
                "Improved confidence when modifying workflows.",
                "Reduced iteration time when debugging GitHub Actions with act.",
                "Supported automated testing and AWS deployments.",
              ]}
            />
            <p>
              Validated API and application boundaries with Zod and tested service
              integrations using Bruno and Postman. Maintained consistent
              formatting and review quality using Prettier and automated repository
              checks.
            </p>
          </Section>

          {/* 12. Technology stack */}
          <Section id="stack" eyebrow="12" title="Technology stack">
            <TechGroups
              groups={caseStudyTech}
              className="grid gap-6 sm:grid-cols-2"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 pt-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Developer tooling
              </p>
              <div className="flex flex-wrap gap-2">
                {developerTooling.map((tool) => (
                  <Badge
                    key={tool}
                    variant="outline"
                    className="text-xs text-muted-foreground"
                  >
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          </Section>

          {/* 13. Visit live website */}
          {qp.website && (
            <Section id="visit" eyebrow="13" title="Visit live website">
              <a
                href={qp.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Visit live website
                <ExternalLink size={16} aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Section>
          )}
        </div>
      </main>
    </>
  );
}
