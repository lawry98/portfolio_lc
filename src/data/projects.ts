export interface Project {
    id: string;
    title: string;
    description: string;
    tags: string[];
    image?: string;
    github?: string;
    live?: string;
    featured?: boolean;
  }
  
  export const projects: Project[] = [
    {
      id: "f1-application",
      title: "F1 Race Weekend Briefing Agent",
      description:
        "An AI agent built on LangGraph and Claude that synthesizes live telemetry, news, and weather into expert-level F1 race weekend briefings — paired with a Three.js-powered 3D car showcase and scroll-driven teardown that put front-end craft on full display.",
      tags: ["LangGraph", "Claude AI", "Three.js", "React Three Fiber"],
      github: "https://github.com/lawry98/f1-application",
      featured: true,
    },
  ];
  
  export const featuredProjects = projects.filter((p) => p.featured);