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
  techGroups?: TechGroup[];
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
    context:
      "Quill & Pigeon helps customers discover, personalize, schedule, and send handwritten cards created by independent New England artists.",
    contributionSummary:
      "I worked across the Next.js platform, Medusa commerce services, Stripe subscriptions and payments, AWS Lambda applications, search infrastructure, transactional email, shipping workflows, and context-aware AI agents.",
    metrics: [
      { value: "500+", label: "Users supported" },
      { value: "1,000+", label: "Transactions processed" },
      { value: "50%", label: "Faster page loads and processing" },
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
    techGroups: [
      { label: "Full stack", items: ["Next.js", "TypeScript", "Prisma", "PostgreSQL"] },
      {
        label: "Commerce and integrations",
        items: ["Medusa", "Stripe", "Meilisearch"],
      },
      { label: "AI", items: ["OpenAI API", "Claude API", "MCP"] },
      { label: "Platform", items: ["AWS", "Kysely", "GitHub Actions"] },
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
      "Built and maintained full-stack B2B web applications for Fortune 500 financial-services clients using React, Java, Spring, Node.js, and SQL.",
    highlights: [
      "Created 20+ reusable UI components and shared frontend patterns, reducing feature-development time by 30%.",
      "Improved application performance by 15%+ through database indexing, query optimization, and caching.",
      "Supported frontend development, backend services, production debugging, regression testing, and customer delivery, contributing to a 95% customer-satisfaction index for FY 2022.",
    ],
    technologies: ["Java", "Spring", "React", "Node.js", "SQL"],
  },
  {
    id: "cradiant-it-services",
    company: "Cradiant IT Services",
    role: "Software Engineer",
    location: "Pune, India",
    period: "Jun 2019 – Jul 2020",
    summary:
      "Built Java and Spring Boot REST APIs, a C/C++ file-compression utility, and Python data pipelines with Pandas and NumPy that reduced manual reporting time by 40% and surfaced market trends for business planning.",
    technologies: ["Java", "Spring Boot", "Python", "Pandas", "NumPy", "C/C++"],
  },
];

export const featuredExperience = experience.find((item) => item.featured);
export const earlierExperience = experience.filter((item) => !item.featured);
