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
      "An AI-powered web application that uses LangGraph and the Claude API to transform telemetry, weather, news, and session results into concise race-weekend briefings, paired with an interactive Three.js experience.",
    tags: ["LangGraph", "Claude API", "Three.js", "React Three Fiber"],
    github: "https://github.com/lawry98/f1-application",
    featured: true,
  },
  {
    id: "ai-code-review",
    title: "AI-Powered Code Review Tool",
    description:
      "A full-stack developer tool that analyzes code across 10+ programming languages and produces AI-generated feedback on security, performance, and engineering standards, with authentication and review-history tracking.",
    tags: ["Next.js", "TypeScript", "OpenAI API", "PostgreSQL"],
  },
  {
    id: "realtime-kanban",
    title: "Real-Time Collaborative Kanban Board",
    description:
      "A real-time collaborative project-management application featuring WebSocket synchronization, drag-and-drop workflows, role-based permissions, and optimistic UI updates.",
    tags: ["React", "WebSockets", "Node.js", "PostgreSQL"],
  },
];

export const featuredProjects = projects.filter((p) => p.featured);
export const supportingProjects = projects.filter((p) => !p.featured);
