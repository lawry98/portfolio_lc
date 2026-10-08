export interface SkillGroup {
  label: string;
  skills: string[];
}

/** Core skills, shown as cards. Kept short so the section scans quickly. */
export const skillGroups: SkillGroup[] = [
  {
    label: "Frontend",
    skills: [
      "React",
      "Next.js",
      "TypeScript",
      "JavaScript",
      "Tailwind CSS",
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
      "Prisma",
      "Stripe",
    ],
  },
  {
    label: "AI",
    skills: ["OpenAI API", "Claude API", "MCP", "LangGraph", "AI Agents"],
  },
  {
    label: "Cloud and delivery",
    skills: ["AWS", "AWS Lambda", "Docker", "GitHub Actions", "CI/CD"],
  },
];
