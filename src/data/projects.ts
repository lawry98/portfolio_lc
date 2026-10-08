export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  highlights?: string[];
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
    highlights: [
      "Gemini picks the tools; they run in parallel",
      "Streams the briefing token by token over SSE",
      "OpenF1 results, OpenWeather, Tavily news",
    ],
    image: "/projects/f1-briefing-agent.webp",
    imageAlt:
      "A generated briefing for the 2026 Singapore Grand Prix: round 17 at Marina Bay beside a red outline of the circuit, then the start of the briefing text.",
    github: "https://github.com/lawry98/f1-application",
    featured: true,
  },
  {
    id: "ai-code-review",
    title: "AI-Powered Code Review Tool",
    description: "Claude reviews code in 12 languages with line-level fixes.",
    tags: ["Next.js", "TypeScript", "Claude API", "Tailwind CSS"],
    highlights: [
      "Flags bugs, security, and performance issues",
      "Each issue gets a severity, line, and fix",
      "Scores code 1–10, rewrites it if needed",
    ],
    image: "/projects/codereview-ai.webp",
    imageAlt:
      "A review scoring a JavaScript handler 2 out of 10, followed by a critical off-by-one bug on line 10 with its explanation, a suggestion, and the fixed loop.",
    github: "https://github.com/lawry98/codereview-ai",
  },
  {
    id: "realtime-kanban",
    title: "Real-Time Collaborative Kanban Board",
    description: "Drag-and-drop boards that sync live, with role-based access.",
    tags: ["Next.js", "Supabase", "Prisma", "PostgreSQL"],
    highlights: [
      "Server-checked Owner, Editor, Viewer roles",
      "Supabase Realtime syncs every open tab",
      "Card moves are instant, with rollback",
    ],
    image: "/projects/kanban-board.webp",
    imageAlt:
      "A task card being dragged from In Progress toward Review on a four-column demo board, with priority, label, due-date and assignee chips on each card.",
    github: "https://github.com/lawry98/kanban-board",
  },
];

export const featuredProjects = projects.filter((p) => p.featured);
export const supportingProjects = projects.filter((p) => !p.featured);
