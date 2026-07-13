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
        "AI agent that generates comprehensive F1 race weekend briefings, orchestrating live telemetry, news, and weather data through a LangGraph pipeline and synthesizing it with Claude into expert-level pre-race analysis.",
      tags: ["Python", "Next.js", "LangGraph", "Three.js"],
      github: "https://github.com/lawry98/f1-application",
      featured: true,
    },
  ];
  
  export const featuredProjects = projects.filter((p) => p.featured);