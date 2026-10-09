export interface ExperienceMetric {
  value: string;
  label: string;
}

export interface OwnershipArea {
  title: string;
  description: string;
}

export interface TechGroup {
  label: string;
  items: string[];
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  location: string;
  period: string;
  summary: string;
  context?: string;
  contributionSummary?: string;
  highlights?: string[];
  technologies?: string[];
  featured?: boolean;
  image?: string;
  imageAlt?: string;
  website?: string;
  caseStudyHref?: string;
  metrics?: ExperienceMetric[];
  ownershipAreas?: OwnershipArea[];
}

export const experience: Experience[] = [
  {
    id: "quill-and-pigeon",
    company: "Quill & Pigeon",
    role: "Full-Stack Software Engineer Co-op",
    location: "Portland, Maine",
    period: "Jan 2025 – Aug 2025",
    featured: true,
    summary:
      "Built customer-facing product features, commerce workflows, AI-powered experiences, and production infrastructure for a multi-tenant platform connecting customers with independent greeting-card artists.",
    highlights: [
      "Built the customer-facing AI assistant on the Vercel AI SDK and the platform's n8n orchestration workflows, with OpenAI/Claude provider failover and Langfuse tracing on model calls.",
      "Designed a Medusa and Stripe subscription-credit system with a per-credit ledger, line-item reservations, atomic rollbacks, and idempotent webhooks.",
      "Built an AWS serverless inbound-email pipeline (SES, SNS, SQS, Lambda) with MIME parsing, conversation threading, and Postgres persistence.",
    ],
    context:
      "Quill & Pigeon helps customers discover, personalize, schedule, and send handwritten cards created by independent New England artists.",
    contributionSummary:
      "I worked across the Next.js platform, Medusa commerce services, Stripe subscriptions and payments, AWS Lambda applications, search infrastructure, transactional email, shipping workflows, and context-aware AI agents.",
    metrics: [
      { value: "500+", label: "Registered users" },
      { value: "1,000+", label: "Completed orders" },
      { value: "50%", label: "Faster page loads" },
      { value: "WCAG 2.2 AA", label: "Accessible customer experience" },
    ],
    ownershipAreas: [
      {
        title: "Full-stack product development",
        description:
          "Built accessible customer experiences for product discovery, personalization, recipients, reminders, subscriptions, checkout, and card delivery using Next.js, React, TypeScript, Prisma, Zod, and PostgreSQL.",
      },
      {
        title: "Commerce, subscriptions, and card credits",
        description:
          "Extended Medusa with custom subscription-credit and payment-provider functionality so customers could redeem included card credits during checkout while Stripe handled subscription and standard payment workflows.",
      },
      {
        title: "Context-aware AI workflows",
        description:
          "Built AI-powered customer workflows using the OpenAI API and Claude API, including an MCP server that provided agents with user context such as subscription tier and available card credits.",
      },
      {
        title: "Platform integrations and delivery",
        description:
          "Developed AWS Lambda services with Kysely, integrated Meilisearch and USPS delivery estimates, and improved CI/CD and local GitHub Actions testing with OIDC and act.",
      },
    ],
    technologies: [
      "Next.js",
      "TypeScript",
      "PostgreSQL",
      "Medusa",
      "Stripe",
      "AWS Lambda",
      "Claude API",
      "MCP",
    ],
    image: "/projects/quill-and-pigeon-homepage.webp",
    imageAlt: "Quill & Pigeon storefront featuring handcrafted greeting cards",
    website: "https://www.quillandpigeon.com/",
    caseStudyHref: "/work/quill-and-pigeon",
  },
  {
    id: "tata-consultancy-services",
    company: "Tata Consultancy Services",
    role: "Full-Stack Web Application Developer",
    location: "Pune, India",
    period: "Aug 2020 – Aug 2023",
    summary:
      "Delivered full-stack features for a large U.S. investment-management client's tax and transaction-processing systems.",
    highlights: [
      "Promoted twice in three years; ran biweekly releases through dev → QA → UAT → production and mentored 4 junior developers.",
      "Built 20+ reusable Angular and React UI components that teammates reused to build new screens.",
      "Cut processing time ~15% on average across .NET batch and MongoDB/DynamoDB workflows through batching, reference-data reuse, and query/index tuning.",
    ],
    technologies: [
      "C#/.NET",
      "ASP.NET Core",
      "Angular",
      "React",
      "Node.js",
      "MongoDB",
      "DynamoDB",
    ],
  },
  {
    id: "cradiant-it-services",
    company: "Cradiant IT Services",
    role: "Software Engineer",
    location: "Pune, India",
    period: "Jun 2019 – Jul 2020",
    summary:
      "Built Java/Spring Boot REST APIs on Oracle, a Python/Pandas reporting pipeline that cut manual reporting time ~40%, and a C/C++ compression utility that shrank ~1 GB reports to ~280 MB.",
    technologies: [
      "Java",
      "Spring Boot",
      "Oracle",
      "Python",
      "Pandas",
      "NumPy",
      "C/C++",
    ],
  },
];

export const featuredExperience = experience.find((item) => item.featured);
export const earlierExperience = experience.filter((item) => !item.featured);
