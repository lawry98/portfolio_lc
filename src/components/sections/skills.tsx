"use client";

import { FadeIn } from "@/components/animations/fade-in";
import { Badge } from "@/components/ui/badge";

const skillGroups = [
  {
    label: "Languages",
    skills: ["JavaScript", "TypeScript", "Java", "Python", "SQL", "HTML5", "CSS3", "C/C++"],
  },
  {
    label: "Frontend & UX",
    skills: ["React", "Next.js", "Tailwind CSS", "Responsive Design", "WCAG 2.2 AA Accessibility", "React Email"],
  },
  {
    label: "Backend & Architecture",
    skills: ["Node.js", "REST APIs", "Microservices", "Spring Boot", "Spring Framework", "FastAPI", "Distributed Systems", "Software Design Patterns"],
  },
  {
    label: "Cloud, DevOps & Payments",
    skills: ["AWS (Lambda, S3, EC2)", "Docker", "Kubernetes", "Git", "GitHub Actions", "CI/CD Pipelines", "Stripe API", "PostgreSQL", "MongoDB", "MySQL", "Supabase", "JWT", "OAuth 2.0"],
  },
  {
    label: "AI Coding Assistants & GenAI",
    skills: ["Claude Code", "GitHub Copilot", "Cursor", "Gemini CLI", "OpenAI API", "Claude API", "Langfuse", "n8n"],
  },
];

export function Skills() {
  return (
    <section id="skills" className="py-24 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-4">
            Skills
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold mb-12">
            Tools I reach for
          </h2>
        </FadeIn>

        <div className="grid sm:grid-cols-2 gap-6">
          {skillGroups.map((group, index) => (
            <FadeIn key={group.label} delay={0.15 + index * 0.05}>
              <div className="p-6 rounded-2xl bg-background border border-border/50 h-full">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
