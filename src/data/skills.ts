export interface SkillGroup {
  label: string;
  skills: string[];
}

/** Primary, high-emphasis skill groups shown as cards. */
export const skillGroups: SkillGroup[] = [
  {
    label: "Frontend",
    skills: [
      "React",
      "Next.js",
      "TypeScript",
      "JavaScript",
      "Tailwind CSS",
      "shadcn/ui",
      "Responsive Design",
      "Accessibility",
    ],
  },
  {
    label: "Backend and data",
    skills: [
      "Node.js",
      "Java",
      "Spring Boot",
      "Python",
      "REST APIs",
      "PostgreSQL",
      "Supabase",
      "Prisma",
      "Kysely",
      "Zod",
      "Meilisearch",
    ],
  },
  {
    label: "AI and automation",
    skills: [
      "OpenAI API",
      "Claude API",
      "MCP",
      "LangGraph",
      "Langfuse",
      "n8n",
      "AI Agents",
      "Prompt Evaluation",
    ],
  },
  {
    label: "Commerce and integrations",
    skills: ["Stripe", "Medusa", "React Email", "USPS APIs"],
  },
  {
    label: "Cloud and delivery",
    skills: [
      "AWS",
      "AWS Lambda",
      "SQS",
      "SES",
      "Docker",
      "GitHub Actions",
      "OIDC",
      "CI/CD",
      "Vercel",
    ],
  },
];

/** Lower-emphasis developer tooling, rendered as a subtle row. */
export const developerTooling: string[] = [
  "Git",
  "Bruno",
  "Postman",
  "act",
  "Prettier",
];
