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
      "A LangGraph agent that turns F1 results, standings, weather, and news into streamed race-weekend briefings, with a 3D car viewer in Three.js.",
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
