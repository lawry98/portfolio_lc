export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  image?: string;
  imageAlt?: string;
  github?: string;
  live?: string;
  featured?: boolean;
}

export const projects: Project[] = [
  {
    id: "f1-application",
    title: "F1 Race Weekend Briefing Agent",
    description:
      "A LangGraph agent that uses Gemini to turn race results, standings, weather, and news into streamed race-weekend briefings, with a Three.js viewer that paints a 3D car in each team's color.",
    tags: ["LangGraph", "Gemini API", "FastAPI", "Three.js"],
    github: "https://github.com/lawry98/f1-application",
    featured: true,
  },
  {
    id: "ai-code-review",
    title: "AI-Powered Code Review Tool",
    description: "Claude reviews code in 12 languages with line-level fixes.",
    tags: ["Next.js", "TypeScript", "Claude API", "Tailwind CSS"],
    github: "https://github.com/lawry98/codereview-ai",
  },
  {
    id: "realtime-kanban",
    title: "Real-Time Collaborative Kanban Board",
    description: "Drag-and-drop boards that sync live, with role-based access.",
    tags: ["Next.js", "Supabase", "Prisma", "PostgreSQL"],
    github: "https://github.com/lawry98/kanban-board",
  },
];

export const featuredProjects = projects.filter((p) => p.featured);
export const supportingProjects = projects.filter((p) => !p.featured);
