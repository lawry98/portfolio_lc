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
      "Angular",
      "TypeScript",
      "JavaScript",
      "Tailwind CSS",
    ],
  },
  {
    label: "Backend and data",
    skills: [
      "Node.js",
      "Java",
      "Spring Boot",
      "C#/.NET",
      "Python",
      "FastAPI",
      "C/C++",
      "PostgreSQL",
      "MongoDB",
      "DynamoDB",
      "Supabase",
      "Prisma",
      "Stripe",
    ],
  },
  {
    label: "AI",
    skills: ["OpenAI API", "Claude API", "MCP", "LangGraph"],
  },
  {
    label: "Cloud and delivery",
    skills: ["AWS", "AWS Lambda", "Docker", "GitHub Actions"],
  },
];
